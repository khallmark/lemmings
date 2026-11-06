import { WIDTH, HEIGHT } from './engine.js';

const noise = (x, y) => ((Math.imul(x + 19, 374761393) ^ Math.imul(y + 37, 668265263)) >>> 0) % 101;
const palettes = [
  ['#191c30', '#262b3e', '#34433f', '#5c7950', '#91bb68'],
  ['#1b1b33', '#2d2945', '#3c3e50', '#74816b', '#b1c780'],
  ['#20223b', '#313552', '#4b4b58', '#789775', '#bbda90'],
  ['#1c2033', '#30374b', '#404a4b', '#6c8c72', '#a3cca2'],
  ['#211b30', '#332740', '#493a4a', '#887456', '#c0ae75'],
  ['#241d30', '#392e42', '#514141', '#9b7954', '#d6b876'],
  ['#211b34', '#342b48', '#48434c', '#7a956c', '#afd693'],
  ['#1e1b34', '#312b4a', '#494354', '#8b9275', '#c1d991'],
];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.background = document.createElement('canvas');
    this.background.width = WIDTH; this.background.height = HEIGHT;
    this.ground = document.createElement('canvas');
    this.ground.width = WIDTH; this.ground.height = HEIGHT;
    this.particles = [];
  }

  reset(game, index) {
    this.revision = -1;
    this.particles = [];
    this.colors = palettes[index % palettes.length];
    const ctx = this.background.getContext('2d');
    const [sky, back, middle] = this.colors;
    ctx.fillStyle = sky; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // Layered, deliberately low-resolution cave silhouettes.
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = layer ? middle : back;
      ctx.globalAlpha = layer ? 0.28 : 0.7;
      for (let x = 0; x < WIDTH; x += 16) {
        const h = 35 + noise(Math.floor(x / 64), layer + index) % 120;
        ctx.fillRect(x, HEIGHT - h - layer * 35, 16, h + layer * 35);
        const ceiling = 10 + noise(Math.floor(x / 48), layer + 8) % 60;
        ctx.fillRect(x, 0, 16, ceiling);
      }
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 85; i++) {
      const x = (i * 137 + 23) % WIDTH, y = 65 + (i * 79) % 240;
      ctx.fillStyle = i % 4 ? '#8883a12d' : '#cbd5a963';
      ctx.fillRect(x, y, i % 4 ? 1 : 2, 2);
    }
    for (const [x, y, width] of game.level.terrain) {
      if (width < 100) continue;
      for (let i = 24; i < width - 10; i += 73) {
        const xx = x + i;
        ctx.fillStyle = '#6f8565'; ctx.fillRect(xx, y - 9, 2, 9);
        ctx.fillStyle = '#8f79b2'; ctx.fillRect(xx - 4, y - 12, 10, 4);
        ctx.fillStyle = '#c3a9da'; ctx.fillRect(xx - 2, y - 14, 6, 2);
        ctx.fillStyle = '#718956'; ctx.fillRect(xx + 17, y - 4, 2, 4); ctx.fillRect(xx + 20, y - 7, 2, 7);
      }
    }
  }

  terrain(game) {
    if (game.revision === this.revision) return;
    this.revision = game.revision;
    const ctx = this.ground.getContext('2d');
    const image = ctx.createImageData(WIDTH, HEIGHT);
    const colors = [...this.colors.slice(2), '#475546', '#41403e', '#617456', '#c9b5f1', '#9e88cc', '#929bad', '#596476', '#c0cad5'];
    const rgb = colors.map(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)));
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
      const material = game.terrain[y * WIDTH + x];
      if (!material) continue;
      const n = noise(Math.floor(x / 3), Math.floor(y / 3));
      let color;
      if (material === 2) color = rgb[x % 20 === 0 || y % 20 === 0 ? 9 : x % 20 === 1 || y % 20 === 1 ? 10 : 8];
      else if (material === 3) color = rgb[y % 2 ? 7 : 6];
      else if (!game.at(x, y - 1) || !game.at(x, y - 3)) color = rgb[2];
      else if (!game.at(x, y - 8)) color = rgb[n < 70 ? 1 : 2];
      else color = rgb[n < 12 ? 5 : n < 32 ? 3 : n < 44 ? 4 : 0];
      const i = (y * WIDTH + x) * 4;
      image.data[i] = color[0]; image.data[i + 1] = color[1]; image.data[i + 2] = color[2]; image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }

  effect(event) {
    if (!['save', 'boom', 'lost', 'assign'].includes(event.type)) return;
    const count = event.type === 'boom' ? 32 : 8;
    for (let i = 0; i < count; i++) this.particles.push({ x: event.x, y: event.y - 8,
      vx: (Math.random() - .5) * 4, vy: -Math.random() * 3 - 1, life: 30,
      color: event.type === 'boom' ? '#f1bc7c' : event.type === 'lost' ? '#c78eaa' : '#cbefa0' });
  }

  draw(game, hovered, animate) {
    this.terrain(game);
    const c = this.ctx;
    c.drawImage(this.background, 0, 0);
    c.drawImage(this.ground, 0, 0);
    const time = game.tick;
    for (const [x, y, width, height, direction] of game.level.wind || []) {
      c.fillStyle = '#a9d5ea18'; c.fillRect(x, y, width, height);
      c.fillStyle = '#99c7df'; c.font = '16px monospace'; c.textAlign = 'left';
      for (let py = y + 20; py < y + height; py += 38) {
        for (let px = x + 12; px < x + width - 20; px += 55) c.fillText(direction > 0 ? '→' : '←', px, py);
      }
    }
    for (const [x, y, width, height] of game.level.water || []) {
      c.fillStyle = '#226785c9'; c.fillRect(x, y, width, height);
      c.fillStyle = '#8be2ed';
      for (let px = x; px < x + width; px += 12) c.fillRect(px, y + Math.sin((px + time * 2) / 15) * 2, 8, 2);
      c.font = '9px monospace'; c.textAlign = 'center'; c.fillText('WATER', x + width / 2, y + 20);
    }
    for (const hazard of game.level.hazards || []) {
      const [x, y, width, height, period] = hazard, active = game.hazardActive(hazard);
      c.fillStyle = active ? '#8b384b' : '#363e50'; c.fillRect(x, y, width, height);
      c.fillStyle = active ? '#ffb06e' : '#8cacc0';
      for (let px = x; px < x + width; px += 8) c.fillRect(px, y + Math.sin((px + time) / 12) * 2, 6, 2);
      if (period) { c.font = '9px monospace'; c.textAlign = 'center'; c.fillText(active ? 'DANGER' : 'SAFE', x + width / 2, y - 8); }
    }
    this.entrance(game.level.spawn, game.released < game.level.total && !game.nuking);
    this.exit(game.level.exit, time, game.exitOpen);
    for (const [i, [x, y]] of (game.level.crystals || []).entries()) if (!game.crystals.has(i)) {
      c.save(); c.translate(x, y + Math.sin(time / 12) * 2); c.rotate(Math.PI / 4);
      c.fillStyle = '#8df3df'; c.fillRect(-5, -5, 10, 10);
      c.fillStyle = '#e4fff3'; c.fillRect(-3, -3, 3, 3); c.restore();
    }
    for (const [x, y] of game.level.springs || []) {
      c.fillStyle = '#f4cd7f'; c.fillRect(x - 9, y - 6, 18, 3);
      c.fillStyle = '#a598bc'; c.fillRect(x - 5, y - 3, 10, 3);
      c.font = '14px monospace'; c.textAlign = 'center'; c.fillText('↑', x, y - 13);
    }
    for (const [i, gate] of (game.level.gates || []).entries()) {
      const open = game.openGates.has(i), [x, y, width, height] = gate.rect, [sx, sy] = gate.switch;
      c.fillStyle = open ? '#6ca982' : '#cfab69'; c.fillRect(sx - 10, sy - 5, 20, 5);
      c.font = '9px monospace'; c.textAlign = 'center'; c.fillText(`SWITCH ${i + 1}`, sx, sy - 15);
      c.strokeStyle = open ? '#6ca982' : '#cfab69'; c.lineWidth = 2; c.strokeRect(x, y, width, height);
      if (!open) for (let px = x; px < x + width; px += 6) c.fillRect(px, y, 3, height);
    }
    for (const [i, portal] of (game.level.portals || []).entries()) {
      for (const [side, [x, y]] of [portal.from, portal.to].entries()) {
        c.strokeStyle = side ? '#ffd39a' : '#94e6f7'; c.lineWidth = 3;
        c.beginPath(); c.ellipse(x, y - 18, 12, 22, 0, 0, Math.PI * 2); c.stroke();
        c.fillStyle = c.strokeStyle; c.font = '9px monospace'; c.textAlign = 'center';
        c.fillText(`${i + 1} ${side ? 'OUT' : 'IN'}`, x, y - 47);
      }
    }
    for (const w of game.lemmings) if (w.alive) this.lemming(w, time, w.id === hovered);
    for (const p of this.particles) {
      c.globalAlpha = p.life / 30; c.fillStyle = p.color; c.fillRect(Math.round(p.x), Math.round(p.y), 3, 3);
      if (animate) { p.x += p.vx; p.y += p.vy; p.vy += .1; p.life--; }
    }
    this.particles = this.particles.filter(p => p.life > 0);
    c.globalAlpha = 1;
    if (game.status === 'ready') {
      for (let i = 0; i < 4; i++) this.lemming({ x: 160 + i * 26, y: game.level.terrain[0][1], dir: 1, state: 'walk' }, i * 5, false);
    }
  }

  entrance([x, y], open) {
    const c = this.ctx;
    c.fillStyle = '#383145'; c.fillRect(x - 24, y - 50, 48, 36);
    c.fillStyle = '#ad92b7'; c.fillRect(x - 28, y - 53, 56, 5); c.fillRect(x - 28, y - 18, 56, 5);
    c.fillStyle = '#796483'; c.fillRect(x - 24, y - 48, 6, 30); c.fillRect(x + 18, y - 48, 6, 30);
    c.fillStyle = '#16172b'; c.fillRect(x - 16, y - 43, 32, 25);
    c.fillStyle = open ? '#c1e88e' : '#937da0';
    c.fillRect(x - 5, y - 38, 10, 3); c.fillRect(x - 2, y - 35, 4, 7); c.fillRect(x - 5, y - 30, 10, 2);
    if (open) { c.fillStyle = '#7c6a88'; c.fillRect(x - 20, y - 13, 5, 14); c.fillRect(x + 15, y - 13, 5, 14); }
    c.font = '9px monospace'; c.textAlign = 'center'; c.fillStyle = '#b2a1c5'; c.fillText('IN', x, y - 62);
  }

  exit([x, y], time, open) {
    const c = this.ctx;
    c.fillStyle = '#9c86ab'; c.fillRect(x - 25, y - 42, 50, 42);
    c.fillStyle = '#bca2ca'; c.fillRect(x - 29, y - 45, 58, 6); c.fillRect(x - 23, y - 51, 46, 6); c.fillRect(x - 17, y - 56, 34, 5);
    c.fillStyle = '#272333'; c.fillRect(x - 15, y - 33, 30, 33); c.fillRect(x - 10, y - 38, 20, 6);
    c.fillStyle = open ? '#b9e490' : '#7b6b8a'; c.fillRect(x - 11, y - 29, 22, 29);
    c.fillStyle = open ? '#d2f1b0' : '#aa8fb7'; c.fillRect(x - 7, y - 26, 14, 26);
    c.fillStyle = '#8b739d'; c.fillRect(x - 29, y - 4, 58, 4);
    for (const dx of [-36, 36]) {
      c.fillStyle = '#8a737b'; c.fillRect(x + dx, y - 26, 3, 22);
      c.fillStyle = '#edbf78'; c.fillRect(x + dx - 2, y - 32, 7, 8);
      c.fillStyle = '#ffe0a3'; c.fillRect(x + dx, y - 34 - (Math.floor(time / 6) % 2) * 2, 3, 8);
    }
    c.textAlign = 'center'; c.font = '9px monospace'; c.fillStyle = '#c4e99e'; c.fillText(open ? 'HOME' : 'NEED CRYSTALS', x, y - 66);
  }

  lemming(w, time, selected) {
    const c = this.ctx, x = Math.round(w.x), y = Math.round(w.y);
    const frame = Math.floor(time / 5) % 2, working = ['builder', 'platformer', 'basher', 'miner', 'digger'].includes(w.state);
    c.save(); c.translate(x, y); c.scale(w.dir, 1);
    if (selected) { c.strokeStyle = '#f3f6ba'; c.lineWidth = 1; c.strokeRect(-10, -22, 20, 25); }
    if (w.shield) {
      c.strokeStyle = w.shield < 45 ? '#ffbd79' : '#84ebf2'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(0, -10, 14, 22, 0, 0, Math.PI * 2); c.stroke();
      c.fillStyle = c.strokeStyle; c.fillRect(-12, 7, 24 * w.shield / 180, 2);
    }
    if (w.floater && w.state === 'fall' && w.fall > 20) {
      c.fillStyle = '#dbb4da'; c.fillRect(-15, -37, 30, 5); c.fillRect(-11, -42, 22, 5); c.fillRect(-5, -45, 10, 3);
      c.strokeStyle = '#e9d5e8'; c.beginPath(); c.moveTo(-14, -32); c.lineTo(0, -13); c.lineTo(14, -32); c.stroke();
    }
    c.fillStyle = w.climber ? '#eff28d' : '#b5ed78';
    c.fillRect(-5, -19, 11, 5); c.fillRect(-7, -17, 4, 5); c.fillRect(-3, -21, 3, 3);
    c.fillStyle = '#f3d3bd'; c.fillRect(-3, -14, 9, 5); c.fillRect(5, -12, 3, 2);
    c.fillStyle = '#292335'; c.fillRect(3, -14, 2, 2);
    c.fillStyle = w.state === 'blocker' ? '#da9abb' : '#a48be2'; c.fillRect(-4, -9, 8, 6);
    c.fillStyle = '#f3d3bd';
    if (w.state === 'blocker') { c.fillRect(-11, -9, 7, 3); c.fillRect(4, -9, 7, 3); }
    else if (working || w.state === 'climb') { c.fillRect(4, -10 - frame * 3, 6, 3); }
    else c.fillRect(frame ? -5 : 3, -7, 3, 4);
    c.fillStyle = '#d1c0f2'; c.fillRect(-4, -3, 3, 3); c.fillRect(1, -3, 3, 3);
    c.fillStyle = '#f3d3bd'; c.fillRect(frame ? -6 : -4, -1, 5, 2); c.fillRect(frame ? 2 : 1, -1, 5, 2);
    if (working) {
      c.fillStyle = '#d7bc83'; c.fillRect(7, -10, 2, 11);
      c.fillStyle = '#cec8d9'; c.fillRect(4, -11, 9, 3);
    }
    c.restore();
    if (w.bomb) { c.fillStyle = '#ffbfab'; c.textAlign = 'center'; c.font = 'bold 11px monospace'; c.fillText(Math.ceil(w.bomb / 30), x, y - 28); }
    else if (w.floater || w.climber) {
      c.fillStyle = '#e2d2ed'; c.fillRect(x - 1, y - 27, 2, 2);
    }
  }
}
