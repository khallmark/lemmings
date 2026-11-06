// Original procedural score: no downloaded recordings or autoplay permissions.
export const TRACKS = [
  { name: 'Mosslight waltz', root: 60, tempo: .3, melody: [0, 4, 7, 12, 9, 7, 4, 2, 0, 4, 7, 14, 12, 7, 4, 2] },
  { name: 'Tidal lanterns', root: 62, tempo: .28, melody: [0, 3, 7, 10, 7, 3, 5, 7, 12, 10, 7, 5, 3, 7, 5, 2] },
  { name: 'Homeward march', root: 65, tempo: .22, melody: [0, 7, 4, 7, 9, 12, 9, 7, 5, 9, 12, 14, 12, 9, 7, 4] },
  { name: 'Prism nocturne', root: 57, tempo: .26, melody: [12, 7, 10, 3, 7, 0, 3, 5, 10, 7, 14, 12, 10, 5, 3, 7] },
];

export class Soundscape {
  constructor(context) {
    this.context = context;
    this.music = context.createGain(); this.music.connect(context.destination);
    this.music.gain.value = 0;
    this.effects = context.createGain(); this.effects.connect(context.destination);
    this.effects.gain.value = .6;
    this.volume = .35; this.next = 0; this.beat = 0;
    this.lastRescue = -10; this.rescueChain = 0;
  }

  note(midi, time, duration, volume = .08, wave = 'triangle', output = this.music) {
    const osc = this.context.createOscillator(), gain = this.context.createGain();
    osc.type = wave; osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.linearRampToValueAtTime(volume, time + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    osc.connect(gain); gain.connect(output); osc.start(time); osc.stop(time + duration + .01);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  noise(time, duration, volume, output = this.music) {
    const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * duration), this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 3;
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = buffer; gain.gain.value = volume;
    source.connect(gain); gain.connect(output); source.start(time);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
  }

  effect(type, detail = {}) {
    if (type === 'defeat') {
      [60, 58, 55, 48].forEach((note, i) => this.note(note, this.context.currentTime + i * .15, .3, .055, 'sine', this.effects)); return;
    }
    if (type === 'won') {
      [60, 64, 67, 72, 79].forEach((note, i) => this.note(note, this.context.currentTime + i * .12, .4, .08, 'triangle', this.effects)); return;
    }
    if (type === 'warning') { this.note(88, this.context.currentTime, .06, .04, 'square', this.effects); return; }
    if (type === 'crystal') {
      [79, 83, 86, 91].forEach((note, i) => this.note(note, this.context.currentTime + i * .07, .3, .05, 'sine', this.effects)); return;
    }
    if (type === 'switch') {
      this.note(48, this.context.currentTime, .12, .06, 'square', this.effects);
      this.note(67, this.context.currentTime + .1, .2, .04, 'triangle', this.effects); return;
    }
    if (type === 'portal') {
      [60, 67, 74, 81].forEach((note, i) => this.note(note, this.context.currentTime + i * .035, .18, .045, 'sine', this.effects));
      return;
    }
    if (type === 'boom') {
      this.noise(this.context.currentTime, .45, .17, this.effects);
      this.note(29, this.context.currentTime, .55, .14, 'sine', this.effects); return;
    }
    if (type === 'save') {
      const now = this.context.currentTime;
      this.rescueChain = now - this.lastRescue < 1 ? (this.rescueChain + 1) % 4 : 0;
      this.lastRescue = now;
      const note = 72 + [0, 4, 7, 12][this.rescueChain];
      this.note(note, now, .22, .07, 'sine', this.effects);
      this.note(note + 7, now + .06, .2, .035, 'triangle', this.effects); return;
    }
    if (type === 'spawn') { this.note(76, this.context.currentTime, .09, .025, 'sine', this.effects); return; }
    if (type === 'assign') {
      const notes = { climber: 72, floater: 79, bomber: 43, blocker: 48, builder: 64, basher: 55, miner: 52, digger: 50,
        walker: 60, turner: 62, runner: 76, platformer: 67, jumper: 81, swimmer: 69, stoner: 45, shield: 84 };
      this.note(notes[detail.skill] || 60, this.context.currentTime, .13, .06, 'triangle', this.effects); return;
    }
    const frequencies = { spring: 180, lost: 160 };
    const now = this.context.currentTime, osc = this.context.createOscillator(), gain = this.context.createGain();
    osc.type = type === 'spring' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(frequencies[type] || 330, now);
    osc.frequency.exponentialRampToValueAtTime(type === 'spring' ? 950 : 90, now + .18);
    gain.gain.setValueAtTime(.045, now); gain.gain.exponentialRampToValueAtTime(.001, now + .22);
    osc.connect(gain); gain.connect(this.effects); osc.start(); osc.stop(now + .23);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  update(active, level = 0) {
    const now = this.context.currentTime;
    if (this.level !== level) { this.level = level; this.beat = 0; this.next = now; }
    this.music.gain.setTargetAtTime(active ? this.volume : 0, now, .02);
    if (!active) { this.next = now; return; }
    this.next = Math.max(this.next, now);
    const track = TRACKS[Math.floor(level / 8) % TRACKS.length];
    while (this.next < now + .08) {
      const root = track.root + [0, 5, -3, 7][Math.floor(this.beat / 16) % 4];
      this.note(root + track.melody[this.beat % track.melody.length], this.next, track.tempo * .9);
      if (this.beat % 4 === 0) this.note(root - 24, this.next, .7, .12, 'sine');
      this.noise(this.next, this.beat % 4 === 2 ? .12 : .035, this.beat % 4 === 2 ? .045 : .018);
      this.beat++; this.next += track.tempo;
    }
  }
}
