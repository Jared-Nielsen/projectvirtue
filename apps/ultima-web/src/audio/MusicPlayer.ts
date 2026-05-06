import { Midi } from '@tonejs/midi';

// Tracks small enough to be stubs (track_49 is 47 bytes — empty)
const MIN_TRACK_BYTES = 200;

// All extracted track filenames (served from public/music/)
const ALL_TRACKS = [
  4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,
  20,21,22,23,24,25,26,27,28,29,30,31,32,33,
  34,35,36,37,38,39,40,41,42,43,44,45,46,47,
  48,52,53,54,55,56,57,58,59,
].map(n => `music/track_${String(n).padStart(2,'0')}.mid`);

export class MusicPlayer {
  private ctx!: AudioContext;
  private master!: GainNode;
  private shuffled: string[] = [];
  private idx = 0;
  private running = false;
  private stopped = false;

  /** Must be called from a user-gesture handler (click / keydown). */
  start(): void {
    if (this.running) return;
    this.running = true;

    this.ctx    = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.12;

    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value     = 4;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    this.reshuffle();
    this.advance();
  }

  stop(): void {
    this.stopped = true;
    this.master?.gain.setValueAtTime(0, this.ctx.currentTime);
  }

  private reshuffle(): void {
    this.shuffled = [...ALL_TRACKS].sort(() => Math.random() - 0.5);
    this.idx = 0;
  }

  private advance(): void {
    if (this.stopped) return;
    if (this.idx >= this.shuffled.length) this.reshuffle();
    const url = this.shuffled[this.idx++];
    this.playTrack(url)
      .catch(() => {/* skip broken track */})
      .finally(() => {
        if (!this.stopped) setTimeout(() => this.advance(), 800);
      });
  }

  private async playTrack(url: string): Promise<void> {
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf  = await res.arrayBuffer();
    if (buf.byteLength < MIN_TRACK_BYTES) return; // stub

    const midi = new Midi(buf);
    if (midi.duration < 2) return;               // too short

    const t0 = this.ctx.currentTime + 0.05;

    for (const track of midi.tracks) {
      const isDrums = track.channel === 9;
      if (isDrums) continue;

      // Choose waveform: channel 0 gets a brighter lead tone
      const wave: OscillatorType = track.channel === 0 ? 'triangle' : 'sine';
      const chVol = track.channel === 0 ? 0.55 : 0.35;

      for (const note of track.notes) {
        this.scheduleNote(note.midi, note.velocity * chVol, t0 + note.time, note.duration, wave);
      }
    }

    return new Promise(resolve => setTimeout(resolve, (midi.duration + 0.3) * 1000));
  }

  private scheduleNote(
    midi: number, vel: number,
    start: number, dur: number,
    wave: OscillatorType,
  ): void {
    const freq   = 440 * Math.pow(2, (midi - 69) / 12);
    const osc    = this.ctx.createOscillator();
    const gain   = this.ctx.createGain();

    osc.type            = wave;
    osc.frequency.value = freq;

    const atk = 0.025;
    const rel = Math.min(0.12, dur * 0.25);
    gain.gain.setValueAtTime(0,   start);
    gain.gain.linearRampToValueAtTime(vel,   start + atk);
    gain.gain.setValueAtTime(vel,            start + Math.max(atk, dur - rel));
    gain.gain.linearRampToValueAtTime(0,     start + dur);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.01);
  }
}
