import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './engine.js';

function world(overrides = {}) {
  const game = new Game({ total: 1, need: 1, time: 60, spawn: [100, 295], exit: [800, 300],
    terrain: [[0, 300, 960, 140]], skills: {}, ...overrides });
  game.start();
  for (let i = 0; i < 30; i++) game.update();
  return game;
}
function ticks(game, count) { for (let i = 0; i < count; i++) game.update(); }

test('Holding the entrance freezes releases but not the crowd or the clock', () => {
  const g = world({ total: 3 });
  g.releaseHeld = true;
  const x = g.lemmings[0].x, tick = g.tick, countdown = g.spawnIn;
  ticks(g, 100);
  assert.equal(g.released, 1); assert.equal(g.spawnIn, countdown);
  assert.equal(g.tick, tick + 100); assert.equal(g.lemmings[0].x, x + 100);
  g.releaseHeld = false;
  ticks(g, countdown);
  assert.equal(g.released, 2);
});

test('Walker releases a blocker without losing permanent abilities or another life', () => {
  const g = world({ skills: { blocker: 1, walker: 1, climber: 1 } });
  g.assign(0, 'climber'); g.assign(0, 'blocker');
  const x = g.lemmings[0].x;
  ticks(g, 10); assert.equal(g.lemmings[0].x, x);
  assert.equal(g.assign(0, 'walker'), true);
  ticks(g, 10);
  assert.equal(g.lemmings[0].x, x + 10);
  assert.equal(g.lemmings[0].climber, true);
  assert.equal(g.dead, 0);
});

test('Turner reverses a walker exactly once per assignment', () => {
  const g = world({ skills: { turner: 1 } });
  const x = g.lemmings[0].x;
  assert.equal(g.assign(0, 'turner'), true);
  assert.equal(g.assign(0, 'turner'), false);
  ticks(g, 9); assert.equal(g.lemmings[0].x, x - 9);
});

test('Runner doubles walking distance without doubling bomb countdowns', () => {
  const g = world({ skills: { runner: 2, bomber: 1 } });
  const x = g.lemmings[0].x;
  g.assign(0, 'runner'); g.assign(0, 'bomber');
  assert.equal(g.assign(0, 'runner'), false);
  ticks(g, 9);
  assert.equal(g.lemmings[0].x, x + 18);
  assert.equal(g.lemmings[0].bomb, 81);
});

test('Conveyors help walkers in either direction; only Runners beat an opposing belt', () => {
  for (const direction of [-1, 1]) for (const beltDirection of [-1, 1]) for (const running of [false, true]) {
    const g = world({ direction, conveyors: [[30, 300, 700, beltDirection]], skills: { runner: 1, bomber: 1 } });
    if (running) g.assign(0, 'runner');
    g.assign(0, 'bomber');
    const x = g.lemmings[0].x;
    ticks(g, 10);
    const speed = direction === beltDirection ? (running ? 3 : 2) : (running ? 1 : 0);
    assert.equal(g.lemmings[0].x, x + direction * speed * 10, `facing ${direction}, belt ${beltDirection}, runner ${running}`);
    assert.equal(g.lemmings[0].bomb, 80, 'belts change walking, not timers');
  }
});

test('Conveyor contact includes its start but excludes its end and elevated paths', () => {
  const g = new Game({ total: 1, need: 1, time: 60, spawn: [100, 300], exit: [800, 300],
    terrain: [[0, 300, 960, 140]], skills: {}, conveyors: [[102, 300, 2, 1], [105, 320, 100, 1]] });
  g.start(); ticks(g, 15);
  assert.equal(g.lemmings[0].x, 101);
  g.update(); assert.equal(g.lemmings[0].x, 102);
  g.update(); assert.equal(g.lemmings[0].x, 104);
  g.update(); assert.equal(g.lemmings[0].x, 105);
  g.update(); assert.equal(g.lemmings[0].x, 106, 'a belt below the path cannot pull walkers');
});

test('Conveyors leave anchored jobs alone and never carry walkers through steel or over open air', () => {
  for (const skill of ['blocker', 'builder']) {
    const games = [[], [[30, 300, 700, 1]]].map(conveyors => world({ conveyors, skills: { [skill]: 1 } }));
    const before = games.map(g => ({ x: g.lemmings[0].x, y: g.lemmings[0].y }));
    games.forEach(g => { g.assign(0, skill); ticks(g, 24); });
    assert.deepEqual(games.map((g, i) => [g.lemmings[0].x - before[i].x, g.lemmings[0].y - before[i].y]),
      skill === 'builder' ? [[24, -8], [24, -8]] : [[0, 0], [0, 0]]);
  }
  const wall = world({ conveyors: [[30, 300, 700, 1]], terrain: [[0, 300, 960, 140], [150, 250, 20, 50, 2]], skills: { runner: 1 } });
  wall.assign(0, 'runner'); ticks(wall, 50);
  assert.ok(wall.lemmings[0].x < 150);
  assert.equal(wall.lemmings[0].dir, -1);
  const gap = world({ conveyors: [[30, 300, 700, 1]], terrain: [[0, 300, 150, 140]], skills: { runner: 1 } });
  gap.assign(0, 'runner'); ticks(gap, 50);
  assert.equal(gap.saved, 0);
  assert.equal(gap.dead, 1, 'a conveyor is not a bridge');
});

test('Platformer crosses a gap without gaining altitude', () => {
  const g = world({ terrain: [[0, 300, 130, 140], [200, 300, 760, 140]], skills: { platformer: 1 } });
  const x = g.lemmings[0].x;
  assert.equal(g.assign(0, 'platformer'), true);
  ticks(g, 96);
  assert.equal(g.lemmings[0].x, x + 96);
  assert.equal(g.lemmings[0].y, 300);
  assert.equal(g.at(165, 300), 3);
  ticks(g, 800); assert.equal(g.saved, 1);
});

test('Jumper clears a short gap and rejects an airborne second jump', () => {
  const g = world({ terrain: [[0, 300, 125, 140], [175, 300, 785, 140]], skills: { jumper: 2 } });
  assert.equal(g.assign(0, 'jumper'), true);
  assert.equal(g.assign(0, 'jumper'), false);
  ticks(g, 42);
  assert.ok(g.lemmings[0].x > 175);
  ticks(g, 700); assert.equal(g.saved, 1);
});

test('Swimmer crosses water that drowns untrained lemmings', () => {
  for (const trained of [false, true]) {
    const g = world({ water: [[140, 300, 100, 100]], skills: { swimmer: 1 } });
    if (trained) g.assign(0, 'swimmer');
    ticks(g, 800);
    assert.equal(g.saved, trained ? 1 : 0);
    assert.equal(g.dead, trained ? 0 : 1);
  }
});

test('Stoner creates terrain at a real cost and cannot be assigned twice', () => {
  const g = world({ skills: { stoner: 2 } });
  const { x, y } = g.lemmings[0];
  assert.equal(g.assign(0, 'stoner'), true);
  assert.equal(g.at(x, y - 10), 1);
  assert.equal(g.dead, 1);
  assert.equal(g.assign(0, 'stoner'), false);
  assert.equal(g.skills.stoner, 1);
});

test('Shield survives a short lava crossing but expires in a long one', () => {
  for (const width of [80, 400]) {
    const g = world({ hazards: [[140, 299, width, 101]], skills: { shield: 2 } });
    assert.equal(g.assign(0, 'shield'), true);
    assert.equal(g.assign(0, 'shield'), false);
    ticks(g, 800); assert.equal(g.saved, width === 80 ? 1 : 0);
  }
});

test('Portal transfers a lemming over an impossible void to the exit', () => {
  const g = world({ terrain: [[0, 300, 180, 140], [740, 300, 220, 140]],
    portals: [{ from: [150, 300], to: [750, 300] }] });
  ticks(g, 100);
  assert.equal(g.saved, 1);
  assert.ok(g.events.some(e => e.type === 'portal'));
});

test('Pressure switch opens its steel gate only when reached', () => {
  for (const y of [200, 300]) {
    const g = world({ gates: [{ rect: [300, 200, 20, 100], switch: [140, y] }] });
    ticks(g, 800);
    assert.equal(g.saved, y === 300 ? 1 : 0);
    assert.equal(g.openGates.has(0), y === 300);
  }
});

test('Spring pads launch the crowd without spending Jumper inventory', () => {
  const g = world({ terrain: [[0, 300, 170, 140], [220, 300, 740, 140]], springs: [[150, 300]] });
  ticks(g, 800); assert.equal(g.saved, 1);
  assert.ok(g.events.some(e => e.type === 'spring'));
});

test('Wind drifts parachutes but leaves ordinary falling lemmings alone', () => {
  for (const floating of [false, true]) {
    const g = world({ spawn: [100, 30], wind: [[0, 0, 960, 300, -1]], skills: { floater: 1 } });
    if (floating) g.assign(0, 'floater');
    const x = g.lemmings[0].x;
    ticks(g, 10); assert.equal(g.lemmings[0].x, x - (floating ? 10 : 0));
  }
});

test('Timed traps permit safe-phase crossings and kill during active phases', () => {
  for (const activeTicks of [30, 120]) {
    const g = world({ hazards: [[140, 300, 20, 100, 120, activeTicks]] });
    ticks(g, 800); assert.equal(g.saved, activeTicks === 30 ? 1 : 0);
  }
});

test('Moving saws intercept walkers on their return trip; Shield permits a crossing', () => {
  for (const shielded of [false, true]) {
    const g = world({ patrols: [{ from: [160, 280], to: [300, 280], size: [28, 24], period: 120 }], skills: { shield: 1 } });
    if (shielded) g.assign(0, 'shield');
    ticks(g, 850);
    assert.equal(g.saved, shielded ? 1 : 0);
    assert.equal(g.dead, shielded ? 0 : 1);
  }
});

test('Vertical saws collide at their current position, with an exclusive bottom edge', () => {
  const g = new Game({ total: 1, need: 1, time: 30, spawn: [100, 300], exit: [800, 300],
    terrain: [[0, 300, 960, 140]], skills: {},
    patrols: [{ from: [100, 240], to: [100, 320], size: [20, 20], period: 80 }] });
  g.start(); ticks(g, 20);
  assert.equal(g.dead, 0, 'the blade bottom only touches the feet at tick20');
  g.update();
  assert.equal(g.dead, 1, 'the blade overlaps the feet at tick21');
});

test('A Shield expires even while a blocker waits in a saw route', () => {
  const g = world({ skills: { shield: 1, blocker: 1 } });
  g.assign(0, 'shield'); g.assign(0, 'blocker');
  g.level.patrols = [{ from: [90, 275], to: [100, 275], size: [40, 30], period: 60 }];
  ticks(g, 179); assert.equal(g.dead, 0);
  g.update(); assert.equal(g.dead, 1);
});

test('Crystals are collected once per group and only within reach', () => {
  const g = world({ total: 3, crystals: [[150, 290], [200, 200]] });
  ticks(g, 900);
  assert.equal(g.crystals.size, 1);
  assert.equal(g.events.filter(e => e.type === 'crystal').length, 1);
});

test('Crystal locks prevent rescue until the required gems are collected', () => {
  for (const y of [200, 290]) {
    const g = world({ requiredCrystals: 1, crystals: [[150, y]] });
    ticks(g, 900); assert.equal(g.saved, y === 290 ? 1 : 0);
    assert.equal(g.exitOpen, y === 290);
  }
});
