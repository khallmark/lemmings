import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './engine.js';
import { LEVELS } from './levels.js';

function run(game, act = () => {}) {
  game.start();
  for (let tick = 0; tick < game.level.time * 30 + 1 && game.status === 'running'; tick++) {
    act(game);
    game.update();
  }
  return game;
}

// Play every authored level through its public simulation API. These are legal
// player inputs, never teleports, terrain edits, or changes to the rescue count.
const solutions = [
  g => { const w = g.lemmings[0]; if (w?.state === 'walk' && w.x >= 410 && w.x < 420 && g.skills.basher === 5) g.assign(w.id, 'basher'); },
  g => { const w = g.lemmings[0]; if (w?.state === 'walk' && w.x === 404 && g.skills.builder === 6) g.assign(w.id, 'builder'); },
  g => { for (const w of g.lemmings) if (w.alive && !w.floater) g.assign(w.id, 'floater'); },
  g => { for (const w of g.lemmings) if (w.alive && !w.climber) g.assign(w.id, 'climber'); },
  g => { const w = g.lemmings[0]; if (w?.state === 'walk' && w.x === 160 && g.skills.digger === 5) g.assign(w.id, 'digger'); },
  g => { const w = g.lemmings[0]; if (w?.state === 'walk' && w.x === 160 && g.skills.miner === 6) g.assign(w.id, 'miner'); },
  g => {
    const w = g.lemmings[0];
    if (w?.state === 'walk' && w.x === 495 && g.skills.blocker === 3) g.assign(w.id, 'blocker');
    if (g.saved === 9) g.nuke();
  },
  g => {
    for (const w of g.lemmings) {
      if (!w.alive) continue;
      if (w.x > 500 && !w.climber) g.assign(w.id, 'climber');
      if (w.id === 0 && w.state === 'walk' && w.x === 250 && g.skills.basher === 5) g.assign(w.id, 'basher');
      if (w.state === 'walk' && w.dir === 1 && w.x === 414 && g.skills.builder === 8) g.assign(w.id, 'builder');
    }
  },
];

for (const [index, level] of LEVELS.entries()) {
  test(`level ${index + 1}: ${level.name} is solvable within its skill budget`, () => {
    const game = run(new Game(level), solutions[index]);
    assert.equal(game.status, 'won', `${game.saved}/${level.need} rescued, ${game.dead} lost`);
    assert.ok(game.saved >= level.need);
    assert.equal(game.released, game.saved + game.dead);
    for (const count of Object.values(game.skills)) assert.ok(count >= 0);
    const end = [game.tick, game.saved, game.dead];
    game.update();
    assert.deepEqual([game.tick, game.saved, game.dead], end, 'finished games must not advance');
  });
}

test('doing nothing fails the first puzzle; a wall is not a passable decoration', () => {
  const game = run(new Game(LEVELS[0]));
  assert.equal(game.status, 'lost');
  assert.equal(game.saved, 0);
});

function fixture(overrides = {}) {
  return new Game({ total: 1, need: 1, time: 30, spawn: [100, 250], exit: [800, 300],
    terrain: [[0, 300, 960, 140]], skills: { floater: 2, blocker: 2, bomber: 2, basher: 2, miner: 2, digger: 2, builder: 2 }, ...overrides });
}

function until(game, predicate) {
  game.start();
  for (let i = 0; i < 900 && !predicate(); i++) game.update();
  assert.ok(predicate(), 'condition must be reached');
}

test('fatal fall boundary and midair floaters', () => {
  for (const [distance, floating, saved, ledge] of [[100, false, 1], [101, false, 0], [210, true, 1], [100, false, 1, true], [101, false, 0, true]]) {
    const game = fixture({ spawn: [100, 300 - distance - (ledge ? 20 : 0)], exit: [180, 300],
      terrain: [...(ledge ? [[0, 300 - distance, 140, 10]] : []), [0, 300, 960, 140]] });
    run(game, g => { if (floating && g.lemmings.length) g.assign(0, 'floater'); });
    assert.equal(game.saved, saved, `fall ${distance}, floater ${floating}, ledge ${!!ledge}`);
  }
});

test('invalid and duplicate assignments do not spend inventory', () => {
  const game = fixture();
  until(game, () => game.released === 1);
  assert.equal(game.assign(999, 'floater'), false);
  assert.equal(game.assign(0, 'builder'), false, 'cannot build in midair');
  assert.equal(game.skills.builder, 2);
  assert.equal(game.assign(0, 'floater'), true);
  assert.equal(game.assign(0, 'floater'), false);
  assert.equal(game.skills.floater, 1);
  until(game, () => game.lemmings[0].state === 'walk');
  assert.equal(game.assign(0, 'blocker'), true);
  assert.equal(game.assign(0, 'builder'), false, 'a blocker cannot be reassigned a ground task');
  assert.equal(game.skills.builder, 2);
});

test('a timed bomber removes earth, preserves steel, and consumes only itself', () => {
  const game = fixture({ terrain: [[0, 300, 960, 140], [110, 290, 8, 40, 2]] });
  until(game, () => game.lemmings[0]?.state === 'walk');
  game.assign(0, 'blocker');
  game.assign(0, 'bomber');
  for (let i = 0; i < 89; i++) game.update();
  assert.equal(game.dead, 0);
  assert.equal(game.at(100, 300), 1);
  game.update();
  assert.equal(game.dead, 1);
  assert.equal(game.at(100, 300), 0);
  assert.equal(game.at(113, 300), 2);
});

test('all excavating skills stop at steel', () => {
  for (const skill of ['basher', 'miner', 'digger']) {
    const game = fixture({ terrain: [[0, 300, 960, 140, 2], [110, 275, 20, 25, 2]] });
    until(game, () => game.lemmings[0]?.state === 'walk');
    const before = game.terrain.slice();
    assert.equal(game.assign(0, skill), true);
    for (let i = 0; i < 20; i++) game.update();
    assert.deepEqual(game.terrain, before);
    assert.notEqual(game.lemmings[0].state, skill);
  }
});

test('nuke stops new releases, ends the attempt, and also works before the first spawn', () => {
  for (const spawnFirst of [false, true]) {
    const game = fixture({ total: 10 });
    game.start();
    if (spawnFirst) until(game, () => game.released === 2);
    const released = game.released;
    game.nuke();
    run(game);
    assert.equal(game.released, released);
    assert.equal(game.dead, released);
    assert.equal(game.status, 'lost');
  }
});

test('the timer ends blocked attempts and a new game restores terrain and skills', () => {
  const game = fixture({ time: 2 });
  run(game, g => { if (g.lemmings[0]?.state === 'walk') g.assign(0, 'blocker'); });
  assert.equal(game.tick, 60);
  assert.equal(game.status, 'lost');
  assert.equal(game.dead, 1);
  const fresh = fixture({ time: 2 });
  assert.equal(fresh.skills.blocker, 2);
  assert.equal(fresh.tick, 0);
  assert.equal(fresh.at(100, 300), 1);
});
