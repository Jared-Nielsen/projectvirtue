export class PerlinNoise {
  private perm: Uint8Array;

  constructor(seed: number) {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    let s = seed | 0;
    for (let i = 255; i > 0; i--) {
      s = Math.imul(s, 1664525) + 1013904223;
      const j = (s >>> 0) % (i + 1);
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) !== 0 ? -u : u) + ((h & 2) !== 0 ? -v : v);
  }

  sample(x: number, y: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this.fade(xf);
    const v = this.fade(yf);
    const a = this.perm[xi] + yi;
    const b = this.perm[xi + 1] + yi;

    return this.lerp(
      this.lerp(
        this.grad(this.perm[a], xf, yf),
        this.grad(this.perm[b], xf - 1, yf),
        u
      ),
      this.lerp(
        this.grad(this.perm[a + 1], xf, yf - 1),
        this.grad(this.perm[b + 1], xf - 1, yf - 1),
        u
      ),
      v
    );
  }

  octave(x: number, y: number, octaves: number, persistence: number, scale: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1 / scale;
    let max = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.sample(x * frequency, y * frequency) * amplitude;
      max += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return value / max;
  }
}
