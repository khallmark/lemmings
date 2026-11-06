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
