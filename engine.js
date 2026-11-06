export const WIDTH = 960;
export const HEIGHT = 440;
export const TICK_RATE = 30;
export const SAFE_FALL = 100;

// Browser-independent, fixed-step simulation. Rendering never changes the world.
export class Game {
  constructor(level) {
    this.level = level;
    this.terrain = new Uint8Array(WIDTH * HEIGHT);
    this.revision = 0;
    for (const [x, y, w, h, material = 1] of level.terrain) this.paint(x, y, w, h, material);
    this.lemmings = [];
    this.skills = { ...level.skills };
    this.released = 0;
    this.saved = 0;
    this.dead = 0;
    this.tick = 0;
    this.releaseInterval = 45;
    this.spawnIn = 15;
    this.status = 'ready';
    this.nuking = false;
    this.events = [];
  }

  at(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    return x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT ? 0 : this.terrain[y * WIDTH + x];
  }

  paint(x, y, width, height, material) {
    let changed = 0;
    for (let py = Math.max(0, Math.floor(y)); py < Math.min(HEIGHT, Math.ceil(y + height)); py++) {
      for (let px = Math.max(0, Math.floor(x)); px < Math.min(WIDTH, Math.ceil(x + width)); px++) {
        const i = py * WIDTH + px;
        if (this.terrain[i] === 2 || this.terrain[i] === material) continue;
        this.terrain[i] = material;
        changed++;
      }
    }
    if (changed) this.revision++;
    return changed;
  }

  start() { if (this.status === 'ready') this.status = 'running'; }

  assign(id, skill) {
    const w = this.lemmings.find(w => w.id === id && w.alive);
    if (this.status !== 'running' || !w || !(this.skills[skill] > 0)) return false;
    if (skill === 'climber' || skill === 'floater') {
      if (w[skill]) return false;
      w[skill] = true;
    } else if (skill === 'bomber') {
      if (w.bomb) return false;
      w.bomb = 90;
    } else {
      if (!['blocker', 'builder', 'basher', 'miner', 'digger'].includes(skill) ||
          !this.at(w.x, w.y) || w.state === 'climb' || w.state === 'blocker' || w.state === skill) return false;
      w.state = skill;
      w.actionTick = 0;
      w.steps = 0;
    }
    this.skills[skill]--;
    this.events.push({ type: 'assign', x: w.x, y: w.y });
    return true;
  }

  nuke() {
    if (this.status !== 'running' || this.nuking) return;
    this.nuking = true;
    this.lemmings.filter(w => w.alive).forEach((w, i) => { w.bomb = Math.min(w.bomb || Infinity, 30 + i * 5); });
  }

  finish(w, rescued = false) {
    w.alive = false;
    if (rescued) this.saved++; else this.dead++;
    this.events.push({ type: rescued ? 'save' : 'lost', x: w.x, y: w.y });
  }

  explode(w) {
    for (let dy = -26; dy <= 26; dy++) {
      const half = Math.floor(Math.sqrt(26 ** 2 - dy ** 2));
      this.paint(w.x - half, w.y - 8 + dy, half * 2 + 1, 1, 0);
    }
    this.events.push({ type: 'boom', x: w.x, y: w.y - 8 });
    this.finish(w);
  }

  update() {
    if (this.status !== 'running') return;
    this.tick++;
    if (!this.nuking && this.released < this.level.total && --this.spawnIn <= 0) {
      this.lemmings.push({ id: this.released++, x: this.level.spawn[0], y: this.level.spawn[1],
        dir: this.level.direction || 1, state: 'fall', alive: true, fall: 0, vy: 0,
        climber: false, floater: false, bomb: 0, actionTick: 0, steps: 0 });
      this.spawnIn = this.releaseInterval;
    }
    for (const w of this.lemmings) if (w.alive) this.move(w);
    const alive = this.lemmings.some(w => w.alive);
    if ((!alive && (this.released === this.level.total || this.nuking)) || this.tick >= this.level.time * TICK_RATE) {
      for (const w of this.lemmings) if (w.alive) this.finish(w);
      this.status = this.saved >= this.level.need ? 'won' : 'lost';
      this.events.push({ type: this.status });
    }
  }

  move(w) {
    if (w.bomb && --w.bomb === 0) { this.explode(w); return; }
    if (w.x < 3 || w.x >= WIDTH - 3 || w.y >= HEIGHT ||
        (this.level.hazards || []).some(([x, y, width, height]) => w.x >= x && w.x < x + width && w.y >= y && w.y < y + height)) {
      this.finish(w); return;
    }
    const [ex, ey] = this.level.exit;
    if (Math.abs(w.x - ex) < 15 && Math.abs(w.y - ey) < 12) { this.finish(w, true); return; }

    if (w.state === 'climb') {
      if (this.at(w.x, w.y - 18) || w.y < 20) { w.dir *= -1; w.state = 'fall'; w.fall = 0; return; }
      if (!this.at(w.x + w.dir * 4, w.y - 1)) {
        w.x += w.dir * 5; w.state = 'walk'; w.fall = 0;
      } else w.y--;
      return;
    }

    if (!this.at(w.x, w.y)) {
      w.state = 'fall';
      w.vy = Math.min(w.vy + 0.35, w.floater && w.fall > 20 ? 1.2 : 5);
      const distance = Math.max(1, Math.floor(w.vy));
      for (let i = 0; i < distance; i++) {
        if (this.at(w.x, w.y)) break;
        w.y++; w.fall++;
      }
      if (this.at(w.x, w.y)) {
        if (w.fall > SAFE_FALL && !w.floater) { this.finish(w); return; }
        w.state = 'walk'; w.fall = 0; w.vy = 0;
      }
      return;
    }
    w.fall = 0; w.vy = 0;
    if (w.state === 'fall') w.state = 'walk';
    if (w.state === 'blocker') return;

    if (w.state === 'builder') {
      if (++w.actionTick % 6) return;
      const front = w.x + w.dir * 7;
      if (this.at(front, w.y - 5) || this.at(w.x + w.dir * 4, w.y - 18)) {
        w.state = 'walk'; w.dir *= -1; return;
      }
      this.paint(w.dir > 0 ? w.x - 2 : w.x - 7, w.y - 2, 10, 2, 3);
      w.x += w.dir * 6; w.y -= 2;
      if (++w.steps >= 16) w.state = 'walk';
      return;
    }

    if (w.state === 'basher' || w.state === 'miner' || w.state === 'digger') {
      if (++w.actionTick % 4) return;
      const digging = w.state === 'digger', mining = w.state === 'miner';
      const x = digging ? w.x - 7 : w.dir > 0 ? w.x : w.x - 12;
      const y = digging ? w.y : w.y - 18;
      const width = digging ? 15 : 13, height = digging ? 3 : mining ? 20 : 18;
      let steel = false;
      for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) steel ||= this.at(px, py) === 2;
      if (steel) { w.state = 'walk'; if (!digging) w.dir *= -1; return; }
      const removed = this.paint(x, y, width, height, 0);
      if (digging) w.y += 3;
      else { w.x += w.dir * (mining ? 4 : 2); if (mining) w.y += 2; }
      if (!removed) w.state = 'walk';
      return;
    }

    if (this.lemmings.some(b => b !== w && b.alive && b.state === 'blocker' &&
      Math.abs(b.y - w.y) < 16 && (b.x - w.x) * w.dir > 0 && Math.abs(b.x - w.x) < 11)) {
      w.dir *= -1;
    }
    const nx = w.x + w.dir;
    let step = 0;
    while (step <= 3 && this.at(nx + w.dir * 3, w.y - 1 - step)) step++;
    const wall = step > 3 || this.at(nx + w.dir * 3, w.y - 9) || this.at(nx + w.dir * 3, w.y - 16);
    if (wall) {
      if (w.climber) w.state = 'climb'; else w.dir *= -1;
    } else {
      w.x = nx; w.y -= step;
      for (let down = 0; down < 3 && !this.at(w.x, w.y); down++) { w.y++; w.fall++; }
    }
  }
}
