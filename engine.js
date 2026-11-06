export const WIDTH = 960;
export const HEIGHT = 440;
export const TICK_RATE = 30;
export const SAFE_FALL = 100;

// Browser-independent, fixed-step simulation. Rendering never changes the world.
export class Game {
  constructor(level) {
    this.level = level;
    this.openGates = new Set();
    this.crystals = new Set();
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
    if ((this.level.gates || []).some((g, i) => !this.openGates.has(i) &&
      x >= g.rect[0] && x < g.rect[0] + g.rect[2] && y >= g.rect[1] && y < g.rect[1] + g.rect[3])) return 2;
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
    if (skill === 'walker') {
      if (w.state === 'walk' || !this.at(w.x, w.y)) return false;
      w.state = 'walk';
    } else if (skill === 'turner') {
      if (w.state !== 'walk') return false;
      w.dir *= -1;
    } else if (skill === 'jumper') {
      if (w.state !== 'walk' || !this.at(w.x, w.y)) return false;
      w.state = 'jump'; w.vy = -5; w.fall = 0;
    } else if (skill === 'stoner') {
      this.paint(w.x - 8, w.y - 12, 17, 13, 1);
      this.finish(w);
    } else if (skill === 'shield') {
      if (w.shield) return false;
      w.shield = 180;
    } else if (['climber', 'floater', 'runner', 'swimmer'].includes(skill)) {
      if (w[skill]) return false;
      w[skill] = true;
    } else if (skill === 'bomber') {
      if (w.bomb) return false;
      w.bomb = 90;
    } else {
      if (!['blocker', 'builder', 'platformer', 'basher', 'miner', 'digger'].includes(skill) ||
          !this.at(w.x, w.y) || w.state === 'climb' || w.state === 'blocker' || w.state === skill) return false;
      w.state = skill;
      w.actionTick = 0;
      w.steps = 0;
    }
    this.skills[skill]--;
    this.events.push({ type: 'assign', skill, x: w.x, y: w.y });
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
      this.events.push({ type: 'spawn', x: this.level.spawn[0], y: this.level.spawn[1] });
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

  hazardActive(hazard) {
    return !hazard[4] || this.tick % hazard[4] < hazard[5];
  }

  get exitOpen() { return this.crystals.size >= (this.level.requiredCrystals || 0); }

  move(w) {
    if (w.bomb && --w.bomb === 0) { this.explode(w); return; }
    if (w.shield) w.shield--;
    if (w.x < 3 || w.x >= WIDTH - 3 || w.y >= HEIGHT ||
        (!w.shield && (this.level.hazards || []).some(h => this.hazardActive(h) && w.x >= h[0] && w.x < h[0] + h[2] && w.y >= h[1] && w.y < h[1] + h[3]))) {
      this.finish(w); return;
    }
    (this.level.crystals || []).forEach(([x, y], i) => {
      if (!this.crystals.has(i) && Math.hypot(w.x - x, w.y - 10 - y) < 16) {
        this.crystals.add(i); this.events.push({ type: 'crystal', x, y });
      }
    });
    const [ex, ey] = this.level.exit;
    if (Math.abs(w.x - ex) < 15 && Math.abs(w.y - ey) < 12) {
      if (this.exitOpen) { this.finish(w, true); return; }
      w.dir = w.x < ex ? -1 : 1;
    }

    (this.level.gates || []).forEach((gate, i) => {
      if (!this.openGates.has(i) && Math.abs(w.x - gate.switch[0]) < 10 && Math.abs(w.y - gate.switch[1]) < 12) {
        this.openGates.add(i); this.revision++;
        this.events.push({ type: 'switch', x: gate.switch[0], y: gate.switch[1] });
      }
    });

    if (w.portalCooldown) w.portalCooldown--;
    else {
      const portal = (this.level.portals || []).find(p => Math.abs(w.x - p.from[0]) < 10 && Math.abs(w.y - p.from[1]) < 12);
      if (portal) {
        [w.x, w.y] = portal.to; w.fall = 0; w.vy = 0; w.state = 'fall'; w.portalCooldown = 30;
        this.events.push({ type: 'portal', x: w.x, y: w.y }); return;
      }
    }

    const water = (this.level.water || []).find(([x, y, width, height]) =>
      w.x >= x && w.x < x + width && w.y >= y && w.y < y + height);
    if (water) {
      if (!w.swimmer) { this.finish(w); return; }
      w.state = 'swim'; w.y = water[1]; w.fall = 0; w.vy = 0;
      if (this.at(w.x + w.dir * 2, w.y - 8)) w.dir *= -1;
      else w.x += w.dir;
      return;
    }
    if (w.state === 'swim') w.state = 'walk';

    if (w.state === 'walk' && this.at(w.x, w.y) && (this.level.springs || []).some(([x, y]) => Math.abs(w.x - x) < 5 && Math.abs(w.y - y) < 5)) {
      w.state = 'jump'; w.vy = -5; w.fall = 0;
      this.events.push({ type: 'spring', x: w.x, y: w.y });
    }

    if (w.state === 'jump') {
      w.vy += 0.25;
      if (!this.at(w.x + w.dir * 3, w.y - 8)) w.x += w.dir * 2;
      else w.dir *= -1;
      for (let i = 0; i < Math.ceil(Math.abs(w.vy)); i++) {
        if (w.vy < 0 && (this.at(w.x, w.y - 20) || w.y < 20)) { w.vy = 0; break; }
        if (w.vy >= 0 && this.at(w.x, w.y)) { w.state = 'walk'; w.vy = 0; return; }
        w.y += w.vy < 0 ? -1 : 1;
      }
      if (w.vy >= 5) { w.state = 'fall'; w.fall = 55; }
      return;
    }

    if (w.state === 'climb') {
      if (this.at(w.x, w.y - 18) || w.y < 20) { w.dir *= -1; w.state = 'fall'; w.fall = 0; return; }
      if (!this.at(w.x + w.dir * 4, w.y - 1)) {
        w.x += w.dir * 5; w.state = 'walk'; w.fall = 0;
      } else w.y--;
      return;
    }

    if (!this.at(w.x, w.y)) {
      w.state = 'fall';
      const wind = (this.level.wind || []).find(([x, y, width, height]) => w.x >= x && w.x < x + width && w.y >= y && w.y < y + height);
      if (wind && w.floater && !this.at(w.x + wind[4], w.y - 8) && !this.at(w.x + wind[4], w.y)) w.x += wind[4];
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

    if (w.state === 'builder' || w.state === 'platformer') {
      if (++w.actionTick % 6) return;
      const rise = w.state === 'builder' ? 2 : 0;
      const front = w.x + w.dir * 7;
      if (this.at(front, w.y - 5) || this.at(w.x + w.dir * 4, w.y - 18)) {
        w.state = 'walk'; w.dir *= -1; return;
      }
      this.paint(w.dir > 0 ? w.x - 2 : w.x - 7, w.y - rise, 10, 2, 3);
      w.x += w.dir * 6; w.y -= rise;
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

    this.walk(w);
    if (w.runner && w.state === 'walk' && this.at(w.x, w.y)) this.walk(w);
  }

  walk(w) {
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
