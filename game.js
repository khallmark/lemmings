import { Game, WIDTH, HEIGHT, TICK_RATE } from './engine.js';
import { LEVELS, SKILLS } from './levels.js';
import { Renderer } from './renderer.js';

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const canvas = $('world');
const renderer = new Renderer(canvas);
const modal = $('modal');
let game, levelIndex = 0, selected = 'basher', paused = false, speed = 1;
let hovered = null, pointer = null, keyboardTarget = null, lastTime = 0, accumulator = 0;
let audio, sound = false, resultShown = false;
let progress = {};
try {
  const stored = JSON.parse(localStorage.getItem('lemmings-progress') || '{}');
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    for (const [key, value] of Object.entries(stored)) {
      if (LEVELS[key] && Number.isInteger(value) && value >= 0 && value <= LEVELS[key].total) progress[key] = value;
    }
  }
} catch { /* Private browsing may disable storage. Playing still works. */ }

function announce(message) { $('announcement').textContent = message; }

function tone(type) {
  if (!sound || !audio) return;
  const frequencies = { assign: 420, save: 740, lost: 160, boom: 70, won: 880, lostGame: 130 };
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.type = type === 'boom' ? 'sawtooth' : 'triangle';
  osc.frequency.setValueAtTime(frequencies[type] || 330, audio.currentTime);
  osc.frequency.exponentialRampToValueAtTime(type === 'save' ? 1100 : 90, audio.currentTime + .18);
  gain.gain.setValueAtTime(.045, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .22);
  osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + .23);
}

SKILLS.forEach((skill, index) => {
  const button = document.createElement('button');
  button.className = 'skill'; button.dataset.skill = skill.id;
  button.title = `${skill.name} (${index + 1}) — ${skill.help}`;
  button.innerHTML = `<span class="key">${index + 1}</span><span class="icon" aria-hidden="true">${skill.icon}</span><span class="name">${skill.name}</span><span class="count">0</span>`;
  button.addEventListener('click', () => chooseSkill(skill.id));
  $('skills').append(button);
});

function chooseSkill(id) {
  if (!(game.skills[id] > 0)) return;
  selected = id;
  const skill = SKILLS.find(s => s.id === id);
  $('hint').textContent = skill.help;
  $('selection-note').textContent = `${skill.name} selected. Click a lemming.`;
  announce(`${skill.name} selected. ${game.skills[id]} remaining.`);
  updateUI();
}

function loadLevel(index, first = false) {
  levelIndex = index;
  game = new Game(LEVELS[index]);
  paused = false; speed = 1; resultShown = false; hovered = null; keyboardTarget = null; pointer = null;
  accumulator = 0;
  selected = Object.keys(game.skills).find(id => !['bomber', 'blocker'].includes(id)) || 'blocker';
  renderer.reset(game, index);
  $('viewport').scrollLeft = 0;
  $('level-meta').textContent = `Level ${pad(index + 1)} / ${pad(LEVELS.length)} · ${game.level.theme}`;
  $('level-title').textContent = game.level.name;
  $('goal').textContent = `Save ${game.level.need} of ${game.level.total} lemmings`;
  $('saved-goal').textContent = `/ ${pad(game.level.need)} needed`;
  $('hint').textContent = game.level.hint;
  $('selection-note').textContent = 'Select a skill. Click a lemming.';
  $('release').value = 5; $('release-value').textContent = 5;
  $('briefing').hidden = false;
  if (!first) {
    $('briefing-kicker').textContent = `Level ${pad(index + 1)} · ${game.level.difficulty}`;
    $('briefing-title').textContent = game.level.name;
    $('briefing-copy').textContent = game.level.hint;
    $('briefing-foot').textContent = `Save ${game.level.need} of ${game.level.total} · ${game.level.time / 60} minutes`;
    $('start').textContent = 'Let’s go! ▶';
  }
  updateUI();
}

function updateUI() {
  $('out').textContent = `${pad(game.released)} / ${pad(game.level.total)}`;
  $('saved').textContent = pad(game.saved);
  $('lost').textContent = pad(game.dead);
  const seconds = Math.max(0, game.level.time - Math.floor(game.tick / TICK_RATE));
  $('time').textContent = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
  $('rescue-fill').style.width = `${Math.min(100, game.saved / game.level.need * 100)}%`;
  $('pause').innerHTML = paused ? '▶ <span>Resume</span>' : 'Ⅱ <span>Pause</span>';
  $('pause').setAttribute('aria-pressed', String(paused));
  $('pause-label').hidden = !paused || game.status !== 'running';
  $('speed').innerHTML = `▶▶ <span>${speed}×</span>`;
  $('speed').setAttribute('aria-pressed', String(speed > 1));
  $('pause').disabled = game.status !== 'running';
  $('nuke').disabled = game.status !== 'running' || game.nuking;
  for (const button of $('skills').children) {
    const count = game.skills[button.dataset.skill] || 0;
    button.querySelector('.count').textContent = pad(count);
    button.disabled = !count;
    button.setAttribute('aria-pressed', String(button.dataset.skill === selected));
    button.setAttribute('aria-label', `${SKILLS.find(s => s.id === button.dataset.skill).name}, ${count} remaining`);
  }
}

function openModal(title, html) {
  $('modal-title').textContent = title;
  $('modal-content').innerHTML = html;
  modal.showModal();
}

function levelMenu() {
  openModal('A little adventure awaits', `<p class="dialog-copy">Pick an expedition. Every level is open to explore. Your best rescues are saved on this browser.</p><div class="level-list">${LEVELS.map((level, i) => `<button class="level-card" data-level="${i}"><small>${pad(i + 1)} · ${level.difficulty}</small>${level.name}<small>Save ${level.need} of ${level.total}</small><span class="best">${progress[i] === undefined ? 'Not completed yet' : `✓ Best: ${progress[i]} rescued`}</span></button>`).join('')}</div>`);
  $('modal-content').querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.level);
    modal.close();
    if (game.status === 'running') confirmAction('Leave this expedition?', 'Your current attempt will restart. Completed levels and best rescues are kept.', 'Change level', () => loadLevel(index));
    else loadLevel(index);
  }));
}

function help() {
  openModal('Little feet. You make the plan.', `<p class="dialog-copy">Lemmings walk on their own and turn at walls. Select a skill, then click a lemming to assign it. Rescue the target number before time runs out. Falls over 100 pixels are fatal without a Floater. Silver terrain is indestructible.</p><div class="guide">${SKILLS.map((s, i) => `<div><strong>${i + 1}. ${s.name}</strong><p>${s.help}</p></div>`).join('')}</div><p class="dialog-copy" style="margin-top:22px"><b>Controls:</b> 1–8 select a skill; Space pauses; F toggles 3× speed; R restarts. Focus the field and use ←/→ to select a lemming, Enter to assign. Skills work while paused. On narrow screens, swipe the field sideways to see the whole level. A higher release rate sends lemmings out faster.</p>`);
}

function confirmAction(title, copy, label, action) {
  openModal(title, `<p class="dialog-copy">${copy}</p><div class="dialog-actions"><button id="cancel-action">Keep playing</button><button class="primary" id="confirm-action">${label}</button></div>`);
  $('cancel-action').onclick = () => modal.close();
  $('confirm-action').onclick = () => { modal.close(); action(); };
}

function restart() {
  if (game.status === 'running') confirmAction('Another way home?', 'Restart this level with a fresh group and all your skills restored.', 'Restart level', () => loadLevel(levelIndex));
  else loadLevel(levelIndex);
}

function results() {
  resultShown = true;
  paused = false;
  const won = game.status === 'won';
  if (won) {
    progress[levelIndex] = Math.max(progress[levelIndex] || 0, game.saved);
    try { localStorage.setItem('lemmings-progress', JSON.stringify(progress)); } catch { /* Storage is optional. */ }
  }
  const complete = won && LEVELS.every((level, i) => progress[i] >= level.need);
  $('briefing').hidden = false;
  $('briefing-kicker').textContent = won ? complete ? 'Every expedition completed!' : 'A little victory!' : 'There’s another way.';
  $('briefing-title').textContent = won ? complete ? 'You brought them home.' : 'Home, sweet home.' : 'Let’s try a new plan.';
  $('briefing-copy').textContent = `${game.saved} of ${game.level.total} lemmings rescued. ${won ? 'Your little friends thank you.' : `You needed ${game.level.need}. ${game.tick >= game.level.time * TICK_RATE ? 'Time ran out.' : 'Try pausing to plan your next move.'}`}`;
  $('briefing-foot').textContent = won ? 'Best result saved on this browser. Replay any level from Level select.' : game.level.hint;
  $('start').textContent = won ? levelIndex < LEVELS.length - 1 ? 'Next expedition ▶' : 'Choose an expedition ▦' : 'Try again ↻';
  announce(`${won ? 'Level complete.' : 'Level failed.'} ${game.saved} rescued.`);
  $('start').focus({ preventScroll: true });
}

function nearest(x, y) {
  let best = null, distance = 24;
  for (const w of game.lemmings) if (w.alive) {
    const d = Math.hypot(w.x - x, w.y - 10 - y);
    if (d < distance) { best = w.id; distance = d; }
  }
  return best;
}

function assign(id) {
  if (id === null) return;
  if (game.assign(id, selected)) {
    announce(`${selected} assigned. ${game.skills[selected]} remaining.`);
    $('selection-note').textContent = `${selected[0].toUpperCase() + selected.slice(1)} assigned! ${game.skills[selected]} left.`;
  } else {
    const message = game.skills[selected] ? 'Cannot assign that skill here. Try a walking lemming.' : 'No uses left. Choose another skill.';
    announce(message); $('selection-note').textContent = message;
  }
  updateUI();
}

canvas.addEventListener('pointermove', event => {
  const rect = canvas.getBoundingClientRect();
  pointer = { x: (event.clientX - rect.left) * WIDTH / rect.width, y: (event.clientY - rect.top) * HEIGHT / rect.height };
  keyboardTarget = null;
});
canvas.addEventListener('pointerleave', () => { pointer = null; hovered = null; });
canvas.addEventListener('click', event => {
  const rect = canvas.getBoundingClientRect();
  assign(nearest((event.clientX - rect.left) * WIDTH / rect.width, (event.clientY - rect.top) * HEIGHT / rect.height));
});
canvas.addEventListener('keydown', event => {
  const alive = game.lemmings.filter(w => w.alive).sort((a, b) => a.x - b.x);
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); pointer = null;
    if (!alive.length) return;
    const current = alive.findIndex(w => w.id === keyboardTarget);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const index = current < 0 ? (direction > 0 ? 0 : alive.length - 1) : (current + direction + alive.length) % alive.length;
    const next = alive[index];
    keyboardTarget = next.id;
    const scale = canvas.clientWidth / WIDTH;
    $('viewport').scrollLeft = Math.max(0, next.x * scale - $('viewport').clientWidth / 2);
    announce(`Lemming ${next.id + 1}, ${next.state}${next.climber ? ', climber' : ''}${next.floater ? ', floater' : ''}.`);
  }
  if (event.key === 'Enter') { event.preventDefault(); assign(keyboardTarget); }
});

$('start').onclick = () => {
  if (game.status === 'ready') { game.start(); $('briefing').hidden = true; canvas.focus({ preventScroll: true }); }
  else if (game.status === 'won' && levelIndex === LEVELS.length - 1) levelMenu();
  else loadLevel(game.status === 'won' ? levelIndex + 1 : levelIndex);
  updateUI();
};
$('pause').onclick = () => { if (game.status === 'running') { paused = !paused; updateUI(); } };
$('speed').onclick = () => { speed = speed === 1 ? 3 : 1; updateUI(); };
$('restart').onclick = restart;
$('nuke').onclick = () => confirmAction('End this attempt?', 'Stop releasing lemmings and explode those still outside. Already rescued lemmings are safe. If you met the rescue goal, this still completes the level.', 'Nuke remaining', () => { game.nuke(); paused = false; updateUI(); });
$('release').oninput = event => {
  game.releaseInterval = 85 - Number(event.target.value) * 8;
  game.spawnIn = Math.min(game.spawnIn, game.releaseInterval);
  $('release-value').textContent = event.target.value;
};
$('levels-button').onclick = levelMenu;
$('help-button').onclick = help;
$('close-modal').onclick = () => modal.close();
modal.addEventListener('click', event => { if (event.target === modal && (event.offsetX < 0 || event.offsetX > modal.clientWidth || event.offsetY < 0 || event.offsetY > modal.clientHeight)) modal.close(); });
$('sound').onclick = async () => {
  try {
    audio ||= new AudioContext();
    await audio.resume(); sound = !sound;
    $('sound').textContent = sound ? 'Sound on' : 'Sound off';
    $('sound').setAttribute('aria-pressed', String(sound));
    $('sound').setAttribute('aria-label', sound ? 'Turn sound off' : 'Turn sound on');
    tone('assign');
  } catch { announce('Sound is unavailable in this browser. The game still works.'); }
};
document.addEventListener('keydown', event => {
  if (modal.open || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.matches('input, button, a')) return;
  if (/^[1-8]$/.test(event.key)) chooseSkill(SKILLS[Number(event.key) - 1].id);
  if (event.code === 'Space') { event.preventDefault(); $('pause').click(); }
  if (event.key.toLowerCase() === 'f') $('speed').click();
  if (event.key.toLowerCase() === 'r') restart();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.status === 'running') { paused = true; updateUI(); }
  accumulator = 0; lastTime = 0;
});

function frame(now) {
  const delta = lastTime ? Math.min(100, now - lastTime) : 0;
  lastTime = now;
  const active = game.status === 'running' && !paused && !modal.open && !document.hidden;
  if (active) {
    accumulator += delta * speed;
    while (accumulator >= 1000 / TICK_RATE) { game.update(); accumulator -= 1000 / TICK_RATE; }
  } else accumulator = 0;
  for (const event of game.events.splice(0)) {
    renderer.effect(event); tone(event.type);
    if (event.type === 'save') announce(`${game.saved} of ${game.level.need} needed rescued.`);
  }
  if (['won', 'lost'].includes(game.status) && !resultShown) results();
  hovered = pointer ? nearest(pointer.x, pointer.y) : keyboardTarget;
  renderer.draw(game, hovered, active);
  // DOM values only change at simulation cadence, not for every painted frame.
  if (frame.lastTick !== game.tick) { updateUI(); frame.lastTick = game.tick; }
  requestAnimationFrame(frame);
}

loadLevel(0, true);
requestAnimationFrame(frame);
