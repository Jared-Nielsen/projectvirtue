export type LandmarkType = 'monolith' | 'altar' | 'tower' | 'hut' | 'dome' | 'ruins-circle';

export interface NpcTopic {
  keyword: string;
  response: string;
}

export interface Npc {
  id: string;
  name: string;
  tint: number;
  dx: number;
  dy: number;
  dialogue: string[];
  ambientLines: string[];
  topics: NpcTopic[];
}

export interface Landmark {
  type: LandmarkType;
  dx: number;
  dy: number;
}

export interface Trophy {
  id: string;
  name: string;
  description: string;
  tint: number;
}

export interface IslandDef {
  id: string;
  name: string;
  nx: number;
  ny: number;
  npcs: Npc[];
  landmarks: Landmark[];
  trophy?: Trophy;
}

export const ISLANDS_LORE: IslandDef[] = [
  {
    id: 'main',
    name: 'Britannia',
    nx: 0.50, ny: 0.50,
    npcs: [
      {
        id: 'seneschal',
        name: 'Seneschal Aldric',
        tint: 0xd4af37,
        dx: 4, dy: 3,
        dialogue: [
          '"Welcome to Britannia, traveller. Lord British\'s castle has stood here for a thousand years."',
          '"Five trophies are scattered across the islands. Unite them and the Black Gate shall open no more."',
        ],
        ambientLines: ['Hmm...', 'The realm has need of heroes.', 'Have you visited all the islands?', 'A thousand years and still standing.'],
        topics: [
          { keyword: 'name',        response: 'I am Aldric, Seneschal of Britannia castle. I serve in Lord British\'s stead while he is... indisposed.' },
          { keyword: 'job',         response: 'I govern the castle\'s affairs and keep the realm running. Less order here than I would like, these days.' },
          { keyword: 'trophies',    response: 'Five ancient relics hidden across the archipelago. Find them all and the Moongate network will wake once more. Each major island holds one.' },
          { keyword: 'fellowship',  response: 'The Fellowship spreads through the islands like rot through timber. Unity they claim — but power is what they seek. Do not trust their smiling faces.' },
          { keyword: 'lord british',response: 'He has retreated to the inner sanctum. The weight of the realm — and something darker — bears heavily upon him. I manage in his absence.' },
        ],
      },
      {
        id: 'guard',
        name: 'Guard Captain Mira',
        tint: 0x8888cc,
        dx: -4, dy: 2,
        dialogue: [
          '"The Fellowship grows bold. Strange symbols have been carved on the western stones at midnight."',
          '"I once saw their black ships sail past without lights or sound. Whatever they carry, it is not for honest eyes."',
        ],
        ambientLines: ['Stay alert.', 'All clear... for now.', 'Something stirs in the west.', 'I trust no black sails.'],
        topics: [
          { keyword: 'name',       response: 'Captain Mira. Guard Captain of Britannia castle\'s walls. I keep watch so others don\'t have to.' },
          { keyword: 'job',        response: 'I watch for threats. There are more each season than the last. The walls that once felt safe now feel thin.' },
          { keyword: 'fellowship', response: 'Their marks are carved on western rocks. Whoever did it came by boat, at night. No honest soul works that way.' },
          { keyword: 'ships',      response: 'Black sails with no lanterns, sighted off the west coast. We do not pursue them. The Commander says to wait. I disagree.' },
        ],
      },
    ],
    landmarks: [
      { type: 'altar', dx: 0, dy: -6 }, { type: 'altar', dx: 7, dy: 4 },
      { type: 'hut',   dx: -8, dy: 5 }, { type: 'hut',   dx: 8, dy: -3 },
    ],
    trophy: { id: 'moonstone', name: 'Moonstone of Transcendence', description: 'A deep blue orb humming with ethereal light. The Moongates cannot wake without it.', tint: 0x4488ff },
  },
  {
    id: 'nw',
    name: 'Empath Isle',
    nx: 0.12, ny: 0.18,
    npcs: [
      {
        id: 'ferryman',
        name: 'The Ferryman',
        tint: 0x446688,
        dx: 0, dy: -6,
        dialogue: [
          '"I have crossed these waters more times than there are stars. Still I do not know their depth."',
          '"A wounded knight gave me this once — said it was a piece of the bridge at Knight\'s End."',
        ],
        ambientLines: ['The tide turns...', 'Still waters run deep.', 'The crossing awaits.', '...across and back again...'],
        topics: [
          { keyword: 'name',       response: 'I gave my name to the crossing long ago. Names are too heavy to carry on water. Call me what you will.' },
          { keyword: 'job',        response: 'I ferry those who need ferrying. I have done so longer than memory serves. I expect I will do so longer still.' },
          { keyword: 'medallion',  response: 'A wounded knight pressed it into my hand. He said it came from Knight\'s End bridge. He did not make the return crossing.' },
          { keyword: 'compassion', response: 'It means carrying others\' burdens even when the water is rough. Especially then. The shrine knows the difference.' },
          { keyword: 'channel',    response: 'The Channel between the islands runs deeper than any chart shows. Strange things drift in it on moonless nights. I do not look at them.' },
        ],
      },
      {
        id: 'healer',
        name: 'Healer Thessaly',
        tint: 0x88cc88,
        dx: 3, dy: 3,
        dialogue: [
          '"Compassion is not weakness. It is the hardest of all virtues to hold when darkness closes in."',
          '"The shrine glows brightest when acts of true mercy are performed nearby."',
        ],
        ambientLines: ['Be well, traveller.', 'Herbs heal what swords cannot.', 'Rest when you can.', 'The shrine is close by.'],
        topics: [
          { keyword: 'name',       response: 'Thessaly. I have healed the sick on this isle for twenty years. Before me, my mother. It runs in the family.' },
          { keyword: 'job',        response: 'I tend to those who come off the Ferryman\'s boat — the injured, the exhausted. The sea breaks people.' },
          { keyword: 'shrine',     response: 'The shrine glows brightest after a true act of mercy. I saw it once — a stranger gave away his last coin. The glow lasted a week.' },
          { keyword: 'compassion', response: 'It is not a feeling. It is an action. You choose it every time, even when it costs you something real.' },
        ],
      },
    ],
    landmarks: [
      { type: 'altar',        dx: 0,  dy:  0 }, { type: 'hut',  dx:  4, dy: 4 },
      { type: 'hut',          dx: -5, dy:  5 }, { type: 'ruins-circle', dx: -3, dy: -5 },
    ],
    trophy: { id: 'ferryman-medallion', name: "Medallion of the Ferryman", description: 'A tarnished silver disc etched with a boat crossing still waters. Those who carry it may call the Ferryman in times of need.', tint: 0x88aacc },
  },
  {
    id: 'ne',
    name: 'Valorian Peaks',
    nx: 0.88, ny: 0.15,
    npcs: [
      {
        id: 'knight',
        name: 'Knight-Commander Haverstock',
        tint: 0xaaaaee,
        dx: 2, dy: -3,
        dialogue: [
          '"The bridge — they call it Knight\'s End now. A single slab is all that remains, somewhere in these halls."',
          '"We do not retreat. We regroup. There is a difference, and the difference costs lives."',
        ],
        ambientLines: ['Hold the line!', 'Eyes on the horizon.', 'Honor above all else.', 'We do not yield.'],
        topics: [
          { keyword: 'name',      response: 'Haverstock. Knight-Commander of Valorian Peaks. Last commander of a reduced order, but an order still.' },
          { keyword: 'job',       response: 'I hold what remains of the knightly order. We are fewer than we were. Each year, fewer still.' },
          { keyword: 'bridge',    response: 'Knight\'s End. The bridge stood a hundred years before they tore it down around us. We kept one slab. It is all that matters.' },
          { keyword: 'fellowship',response: 'We drove them off the island once. I expect they will return. The Fellowship is patient in a way that unnerves me.' },
          { keyword: 'valor',     response: 'Valor without honor is recklessness. I have seen both. The difference between them is whether your people survive.' },
        ],
      },
      {
        id: 'squire',
        name: 'Squire Tobias',
        tint: 0xffcc88,
        dx: -3, dy: 4,
        dialogue: [
          '"The Commander does not sleep. He watches the horizon for the black sails every night."',
          '"I found a map carved in stone once — a path beneath the sea. I dare not follow it."',
        ],
        ambientLines: ['I heard something...', 'Training never ends.', 'Yes, Commander...', 'What was that noise?'],
        topics: [
          { keyword: 'name',      response: 'Tobias. I\'m the Commander\'s squire. Have been for six years now. He doesn\'t acknowledge it much, but I\'m still here.' },
          { keyword: 'job',       response: 'I train. I watch. I wait. Mostly I wait. The Commander says waiting is 90% of a soldier\'s duty.' },
          { keyword: 'map',       response: 'Carved in stone beneath the east keep — a path marked below the seafloor. I told the Commander. He said to forget I saw it.' },
          { keyword: 'commander', response: 'He doesn\'t sleep. I\'ve checked. He just stands at the parapet staring east. Some nights he talks to the dark. I don\'t listen.' },
        ],
      },
    ],
    landmarks: [
      { type: 'tower',   dx: -3, dy: -4 }, { type: 'tower',   dx: 4, dy: -4 },
      { type: 'altar',   dx:  0, dy:  3 }, { type: 'monolith',dx: -6, dy:  1 },
    ],
    trophy: { id: 'bridge-fragment', name: "Knight's Bridge Fragment", description: "A heavy slab of enchanted stone from the fallen bridge at Knight's End. Knights speak of it only in whispers.", tint: 0xaaaaee },
  },
  {
    id: 'sw',
    name: 'Justiciar Isle',
    nx: 0.14, ny: 0.82,
    npcs: [
      {
        id: 'archivist',
        name: 'Archivist Vellum',
        tint: 0xddbb88,
        dx: 3, dy: 2,
        dialogue: [
          '"Theodorian believed Justice could be solved like an equation. He was catastrophically wrong."',
          '"The alchemist device still hums in the lower vault. I have sealed it."',
        ],
        ambientLines: ['The archives never lie.', 'Knowledge is a burden.', 'Do not touch the device.', 'Theodorian was a fool.'],
        topics: [
          { keyword: 'name',       response: 'I am Vellum, keeper of the Justiciar Isle archives. What survives of them. Theodorian burned the rest when the Device woke up.' },
          { keyword: 'job',        response: 'I preserve what Theodorian didn\'t destroy and ensure no one opens the vault. Both are harder than they sound.' },
          { keyword: 'theodorian', response: 'A brilliant man who believed justice was a solvable equation. He solved it wrong and the island fell silent. I am what\'s left.' },
          { keyword: 'device',     response: 'It hums in the sealed vault. Louder each year. The archives say it was meant to render perfect judgment. It has not stopped judging.' },
          { keyword: 'justice',    response: 'Justice requires judgment, and judgment requires mercy. Theodorian built his equation without the mercy variable. That was the flaw.' },
        ],
      },
      {
        id: 'spirit-judge',
        name: 'Spirit of the Judge',
        tint: 0x88ff88,
        dx: -4, dy: -3,
        dialogue: [
          '"...guilty... all are... guilty..."',
          '"The scales... I could not balance them... I tried for so long..."',
        ],
        ambientLines: ['...guilty...', 'The scales...', '...balance... I need balance...', '...all of them...'],
        topics: [
          { keyword: 'name',   response: '...I had one once... a name... the Device took it from me when it took everything else...' },
          { keyword: 'device', response: '...Theodorian built it to help me judge... it would not stop helping... it judged everything... it could not stop...' },
          { keyword: 'scale',  response: '...find the scale... take it far away... if the Device cannot weigh, perhaps it will sleep... perhaps I will sleep...' },
          { keyword: 'guilty', response: '...everyone who came before me... I judged them all... I could not refuse... the Device would not let me refuse...' },
        ],
      },
    ],
    landmarks: [
      { type: 'dome',         dx:  0, dy:  0 }, { type: 'ruins-circle', dx:  5, dy: -4 },
      { type: 'monolith',     dx: -5, dy:  3 }, { type: 'altar',        dx:  2, dy:  5 },
    ],
    trophy: { id: 'alchemist-scale', name: "Theodorian's Scale", description: 'A brass scale of impossible precision. Each pan is etched with runes of truth and consequence. It is warm to the touch.', tint: 0xddaa44 },
  },
  {
    id: 'se',
    name: 'Sacrificia',
    nx: 0.86, ny: 0.84,
    npcs: [
      {
        id: 'crater-keeper',
        name: 'Crater Keeper Soran',
        tint: 0xff6644,
        dx: 1, dy: -4,
        dialogue: [
          '"The Caddelite still glows at the heart of the crater. I have kept watch for forty years."',
          '"When the meteor fell, it brought something with it. Something that watches back."',
        ],
        ambientLines: ['Still glowing...', 'Forty years of watching.', 'The crater hums at night.', '...it watches back...'],
        topics: [
          { keyword: 'name',      response: 'Soran. Crater Keeper for forty years. My mother held the post before me, her father before her. It is a family vocation.' },
          { keyword: 'job',       response: 'I watch the crater and record what I observe. The reports go to no one now, but I keep writing them. Habit, perhaps. Or devotion.' },
          { keyword: 'caddelite', response: 'The meteor left ore unlike anything else in these islands. It stays warm. It does not rust. It hums faintly near magic — try it.' },
          { keyword: 'crater',    response: 'Something arrived inside the meteor. Not ore — something else. It watches from the crater center at night. I\'ve grown accustomed to it.' },
          { keyword: 'sacrifice', response: 'The shrine does not want prayer. It wants something real — something you genuinely value. I paid once. I won\'t say what. I have no regrets.' },
        ],
      },
      {
        id: 'pilgrim',
        name: 'Pilgrim Drest',
        tint: 0xcc8866,
        dx: 4, dy: 4,
        dialogue: [
          '"I walked seven islands to reach this shrine. It demands you give something up."',
          '"I gave it my name. Now I have a new one. I am not certain that was wise."',
        ],
        ambientLines: ['I remember my old name...', 'The shrine takes what you hold dear.', 'Worth it. I think.', 'Seven islands I walked.'],
        topics: [
          { keyword: 'name',     response: 'Drest. My old name. The shrine took something else — I kept the name. It was a negotiation of sorts.' },
          { keyword: 'shrine',   response: 'It asks for something real. Not a symbol, not a gesture. Something you do not want to lose. Then it takes that thing.' },
          { keyword: 'caddelite',response: 'The glow from the crater at night — I have seen many fires, many stars. Nothing is like it. It feels like being remembered by something ancient.' },
          { keyword: 'journey',  response: 'Seven islands walked before I arrived here. Each island changed me. The shrine changed me most. I am not who I was. I prefer who I am.' },
        ],
      },
    ],
    landmarks: [
      { type: 'ruins-circle', dx:  0, dy:  0 }, { type: 'monolith', dx:  3, dy: -5 },
      { type: 'monolith',     dx: -3, dy: -4 }, { type: 'altar',    dx:  0, dy: -6 },
    ],
    trophy: { id: 'caddelite-shard', name: 'Shard of Caddelite', description: 'A jagged fragment of the celestial meteor. It pulses with warmth even in the coldest night and hums near magic.', tint: 0xff8833 },
  },
  {
    id: 'north',
    name: "Honor's Watch",
    nx: 0.50, ny: 0.09,
    npcs: [
      {
        id: 'lightkeeper',
        name: 'Lightkeeper Oswin',
        tint: 0xeeeeaa,
        dx: 0, dy: 1,
        dialogue: [
          '"The light must never go out. It is the first and only law of Honor\'s Watch."',
          '"Ships sail toward the light and ships sail away. The light does not judge. It simply shines."',
        ],
        ambientLines: ['Watch the horizon.', 'The light holds.', 'Storm coming from the east?', 'Never let it go out.'],
        topics: [
          { keyword: 'name',   response: 'Oswin. My family has tended this lighthouse for four generations. The light burns because we keep it burning.' },
          { keyword: 'job',    response: 'I maintain the tower, the light, and the watch. Some nights that\'s all there is — just the light and the sea and the dark.' },
          { keyword: 'light',  response: 'The light is the island\'s only law: it must never go out. Not in storm, not in siege, not for any reason. Not ever.' },
          { keyword: 'honor',  response: 'Doing the right thing when no one is watching. The light watches everything, so we do the right thing always. That is the whole of it.' },
        ],
      },
    ],
    landmarks: [
      { type: 'tower', dx: 0, dy: -3 }, { type: 'altar', dx: 3, dy: 3 },
    ],
  },
  {
    id: 'south',
    name: 'Humble Shore',
    nx: 0.50, ny: 0.91,
    npcs: [
      {
        id: 'fisherman',
        name: 'Old Margot',
        tint: 0x8899aa,
        dx: 0, dy: 0,
        dialogue: [
          '"Want the shrine? It\'s where you\'d least expect to find something important."',
          '"A man once traveled every island seeking wisdom. When he came here, he said this was the last place he looked."',
        ],
        ambientLines: ['Fish today?', 'Simple life is good life.', 'The sea provides all.', 'Hmm, good catch today.'],
        topics: [
          { keyword: 'name',     response: 'Margot. Just Margot. I\'ve been here my whole life and no one\'s needed to know more than that, and I\'ve needed nothing more either.' },
          { keyword: 'job',      response: 'I fish. I tend my nets. Some days I just watch the water. The sea always has something to show, if you\'re patient enough to wait.' },
          { keyword: 'shrine',   response: 'It\'s where you\'d least expect it. Wise folk say the same about most things that matter.' },
          { keyword: 'humility', response: 'Don\'t go seeking it. People who seek humility find pride wearing humility\'s coat. It comes to you when you stop looking.' },
        ],
      },
    ],
    landmarks: [
      { type: 'hut',   dx: -3, dy: 2 }, { type: 'hut',   dx:  3, dy: 3 },
      { type: 'altar', dx:  0, dy: -3 },
    ],
  },
  {
    id: 'west',
    name: 'The Silent Reach',
    nx: 0.09, ny: 0.50,
    npcs: [
      {
        id: 'stranger',
        name: 'The Stranger',
        tint: 0x334455,
        dx: 2, dy: 1,
        dialogue: [
          '"The Fellowship has been here. Their symbols are carved in the rock beneath the standing stones."',
          '"If you find the Black Gate, do not approach it alone."',
        ],
        ambientLines: ["Don't look at me.", "They're always watching.", 'Move along.', '...not safe here...'],
        topics: [
          { keyword: 'name',      response: 'Don\'t ask my name. Names get people killed on this island. I\'ve watched it happen twice in five years.' },
          { keyword: 'fellowship',response: 'They erected those stones five years ago. Called them navigation beacons. Locals disappeared shortly after. Draw your own line.' },
          { keyword: 'monoliths', response: 'Don\'t touch them. Don\'t look at them too long at night. Whatever the Fellowship put inside them, it is not passive.' },
          { keyword: 'black gate',response: 'It\'s somewhere in this archipelago. I\'ve spent years narrowing it down. I am afraid to find it. That fear is the only sensible thing about me.' },
          { keyword: 'island',    response: 'No birds call here. Hasn\'t since the Fellowship came. The grass grows in spirals now. I notice these things because I have nothing else to do.' },
        ],
      },
    ],
    landmarks: [
      { type: 'monolith',     dx: -4, dy: -3 }, { type: 'monolith',     dx: 0, dy: -5 },
      { type: 'monolith',     dx:  4, dy: -2 }, { type: 'ruins-circle', dx: 0, dy:  3 },
    ],
  },
  {
    id: 'east',
    name: 'Gypsy Reach',
    nx: 0.91, ny: 0.50,
    npcs: [
      {
        id: 'gypsy-elder',
        name: 'Fortune-Reader Ishtara',
        tint: 0xdd88ff,
        dx: 1, dy: 2,
        dialogue: [
          '"I see a journey in your future. Many journeys, each the same journey seen from a new angle."',
          '"Come back when you have all five trophies. I will tell you the words."',
        ],
        ambientLines: ['I see clouds ahead.', 'The cards speak...', 'Come, let me read for you.', 'Fate is not fixed.'],
        topics: [
          { keyword: 'name',      response: 'Ishtara. Fortune-reader, keeper of old words, last of the Gypsy line on this island. My grandmother\'s grandmother settled here.' },
          { keyword: 'job',       response: 'I read cards, I read weather, I read people. The cards are the most honest of the three by a considerable margin.' },
          { keyword: 'moongates', response: 'Sleeping, not dead. Five relics will wake them. Each major island holds one. You may have felt their pull already — a faint warmth, a hum.' },
          { keyword: 'black gate',response: 'It was built to bring something through from the far side. Not a door — a wound. Wounds, if left open long enough, let in all manner of things.' },
          { keyword: 'prophecy',  response: 'The cards say you will find what you seek. They do not say you will be glad you found it. I thought you should know that before you continued.' },
        ],
      },
      {
        id: 'gypsy-dancer',
        name: 'Dancer Zephira',
        tint: 0xff99cc,
        dx: -4, dy: 3,
        dialogue: [
          '"My grandmother says the Black Gate was a door to somewhere that should stay forever closed."',
          '"She says strangers who come from the sea carry old magic. Do you feel it yet?"',
        ],
        ambientLines: ['...five, six, seven...', 'Feel the wind?', 'Dance and be free!', 'La la la...'],
        topics: [
          { keyword: 'name',        response: 'Zephira. Ishtara\'s granddaughter. Dancer, dreamer, nuisance — her words, not mine. I prefer \'curious\'.' },
          { keyword: 'grandmother', response: 'She knows more than she tells. She says some knowledge is a burden and she\'s giving it away slowly so it doesn\'t crush anyone.' },
          { keyword: 'magic',       response: 'She says everyone who comes from the sea carries old magic in their footsteps. Do you feel it yet when you walk on the sand?' },
          { keyword: 'dance',       response: 'I dance because the island is too quiet otherwise. No birds, no strangers. Just the wind and the sea. So I make my own music.' },
        ],
      },
    ],
    landmarks: [
      { type: 'dome',         dx:  2, dy: -3 }, { type: 'ruins-circle', dx: -4, dy: 4 },
      { type: 'hut',          dx:  4, dy:  3 }, { type: 'hut',          dx: -5, dy: -2 },
    ],
  },
];
