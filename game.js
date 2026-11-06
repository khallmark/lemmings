import { Game, WIDTH, HEIGHT, TICK_RATE } from './engine.js';
import { LEVELS, SKILLS } from './levels.js';
import { Renderer } from './renderer.js';
import { Soundscape, TRACKS } from './audio.js';

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const canvas = $('world');
const renderer = new Renderer(canvas);
const modal = $('modal');
let game, levelIndex = 0, selected = 'basher', paused = false, speed = 1;
let hovered = null, pointer = null, keyboardTarget = null, lastTime = 0, accumulator = 0;
let following = null;
let audio, score, sound = false, resultShown = false;
let progress = {};
try {
  const stored = JSON.parse(localStorage.getItem('lemmings-progress') || '{}');
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    for (const [key, value] of Object.entries(stored)) {
      if (LEVELS[key] && Number.isInteger(value) && value >= 0 && value <= LEVELS[key].total) progress[key] = value;
    }
  }
} catch { /* Private browsing may disable storage. Playing still works. */ }

const records = {};
try {
  const stored = JSON.parse(localStorage.getItem('lemmings-records') || '{}');
  LEVELS.forEach((level, i) => {
    const ticks = stored?.[i]?.ticks;
    if (Number.isInteger(ticks) && ticks > 0 && ticks <= level.time * TICK_RATE) records[i] = { ticks };
    const skills = stored?.[i]?.skills;
    if (records[i] && Number.isInteger(skills) && skills >= 0 && skills <= Object.values(level.skills).reduce((a, b) => a + b, 0)) records[i].skills = skills;
    const gems = stored?.[i]?.gems;
    if (records[i] && Number.isInteger(gems) && gems >= 0 && gems <= (level.crystals?.length || 0)) records[i].gems = gems;
  });
} catch { /* Records are optional. */ }

function announce(message) { $('announcement').textContent = message; }

function tone(type, detail) {
  if (sound && score) score.effect(type, detail);
}

TRACKS.forEach((track, i) => $('track').add(new Option(track.name, i)));
try {
  $('music-enabled').checked = localStorage.getItem('lemmings-music-enabled') !== 'false';
  const track = localStorage.getItem('lemmings-track');
  if (Array.from($('track').options).some(option => option.value === track)) $('track').value = track;
} catch { /* Audio preferences are optional. */ }
$('track').onchange = () => {
  try { localStorage.setItem('lemmings-track', $('track').value); } catch { /* Storage is optional. */ }
  updateUI();
};
$('music-enabled').onchange = () => {
  try { localStorage.setItem('lemmings-music-enabled', String($('music-enabled').checked)); } catch { /* Storage is optional. */ }
};

SKILLS.forEach((skill, index) => {
  const button = document.createElement('button');
  button.className = 'skill'; button.dataset.skill = skill.id;
  const key = `${index >= 8 ? '⇧' : ''}${index % 8 + 1}`;
  button.title = `${skill.name} (${key}) — ${skill.help}`;
  button.innerHTML = `<span class="key">${key}</span><span class="icon" aria-hidden="true">${skill.icon}</span><span class="name">${skill.name}</span><span class="count">0</span>`;
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
  const url = new URL(location.href);
  url.searchParams.set('level', index + 1);
  history.replaceState(null, '', url);
  try { localStorage.setItem('lemmings-last-level', String(index)); } catch { /* Returning to an expedition is optional. */ }
  $('share').textContent = 'Copy level link';
  game = new Game(LEVELS[index]);
  $('skills').style.setProperty('--skill-columns', Math.min(8, Object.keys(game.skills).length));
  paused = false; speed = 1; resultShown = false; hovered = null; keyboardTarget = null; pointer = null;
  accumulator = 0;
  following = null;
  selected = Object.keys(game.skills).find(id => !['bomber', 'blocker'].includes(id)) || 'blocker';
  renderer.reset(game, index);
  $('viewport').classList.remove('zoomed');
  $('viewport').scrollTop = 0;
  $('viewport').scrollLeft = 0;
  $('level-meta').textContent = `Level ${pad(index + 1)} / ${pad(LEVELS.length)} · ${game.level.theme}`;
  $('level-title').textContent = game.level.name;
  $('goal').textContent = `Save ${game.level.need} of ${game.level.total} lemmings`;
  $('saved-goal').textContent = `/ ${pad(game.level.need)} needed`;
  $('hint').textContent = game.level.hint;
  $('selection-note').textContent = 'Select a skill. Click a lemming.';
  $('release').value = 5; $('release-value').textContent = 5;
  $('briefing').hidden = false;
  $('result-stats').hidden = true;
  $('replay').hidden = true;
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
  const track = $('track').value === 'auto' ? Math.floor(levelIndex / 8) % TRACKS.length : Number($('track').value);
  $('track-name').textContent = `Original score: ${TRACKS[track].name}`;
  $('out').textContent = `${pad(game.released)} / ${pad(game.level.total)}`;
  $('saved').textContent = pad(game.saved);
  $('goal').textContent = game.saved >= game.level.need ? '✓ Goal met — rescue more for a perfect run!' : `Save ${game.level.need} of ${game.level.total} lemmings`;
  $('lost').textContent = pad(game.dead);
  $('crowd-status').textContent = `${game.released - game.saved - game.dead} in the field · ${game.level.total - game.released} waiting${game.releaseHeld ? ' · Entrance held' : ''}`;
  $('crystals').hidden = !game.level.crystals?.length;
  $('crystals').textContent = `◆ Crystals ${game.crystals.size}/${game.level.crystals?.length || 0} · ${game.exitOpen ? 'Exit open' : `Need ${game.level.requiredCrystals} to unlock`}`;
  const seconds = Math.max(0, game.level.time - Math.floor(game.tick / TICK_RATE));
  $('time').textContent = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
  $('rescue-fill').style.width = `${Math.min(100, game.saved / game.level.need * 100)}%`;
  $('pause').innerHTML = paused ? '▶ <span>Resume</span>' : 'Ⅱ <span>Pause</span>';
  $('pause').setAttribute('aria-pressed', String(paused));
  $('pause-label').hidden = !paused || game.status !== 'running';
  $('speed').innerHTML = `▶▶ <span>${speed}×</span>`;
  $('speed').setAttribute('aria-pressed', String(speed !== 1));
  $('pause').disabled = game.status !== 'running';
  $('step').disabled = game.status !== 'running';
  $('zoom').disabled = game.status !== 'running';
  $('follow').disabled = game.status !== 'running' || !game.lemmings.some(w => w.alive);
  $('follow').setAttribute('aria-pressed', String(following !== null));
  $('follow').textContent = following === null ? 'Follow lemming' : `Following #${following + 1}`;
  $('zoom').setAttribute('aria-pressed', String($('viewport').classList.contains('zoomed')));
  $('zoom').textContent = $('viewport').classList.contains('zoomed') ? 'Zoom out' : 'Zoom in';
  $('hold').disabled = game.nuking || game.released === game.level.total || ['won', 'lost'].includes(game.status);
  $('hold').setAttribute('aria-pressed', String(game.releaseHeld));
  $('hold').textContent = game.releaseHeld ? 'Release entrance' : 'Hold entrance';
  $('nuke').disabled = game.status !== 'running' || game.nuking;
  for (const button of $('skills').children) {
    const count = game.skills[button.dataset.skill] || 0;
    button.hidden = !(button.dataset.skill in game.level.skills);
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
  const completed = LEVELS.filter((level, i) => progress[i] >= level.need).length;
  const perfect = LEVELS.filter((level, i) => progress[i] === level.total).length;
  const next = LEVELS.findIndex((level, i) => !(progress[i] >= level.need));
  openModal('A little adventure awaits', `<p class="dialog-copy"><strong>${completed}/${LEVELS.length} completed · ★ ${perfect} perfect rescues</strong><br>Every level is open to explore. Your best rescues are saved on this browser.</p>
    <div class="menu-tools"><label>Chapter <select id="chapter"><option value="all">All expeditions</option><option value="0">1 · The old paths</option><option value="1">2 · New horizons</option><option value="2">3 · Crystal frontiers</option><option value="3">4 · The encore</option></select></label><label>Search <input id="level-search" type="search" placeholder="Name or skill"></label></div>
    <div class="menu-tools"><label><input id="unfinished" type="checkbox"> Unfinished only</label>${next < 0 ? '' : `<button data-level="${next}">Continue campaign → ${pad(next + 1)}</button>`}</div>
    <p id="no-levels" class="dialog-copy" hidden>No expeditions match. Try another chapter or search.</p>
    <div class="level-list">${LEVELS.map((level, i) => `<button class="level-card" data-level="${i}"><small>${pad(i + 1)} · ${level.difficulty}</small>${level.name}<small>Save ${level.need} of ${level.total}</small><span class="best">${progress[i] === level.total ? '★ Perfect rescue!' : progress[i] === undefined ? 'Not completed yet' : `✓ Best: ${progress[i]} rescued`}</span>${records[i] ? `<small>Fastest ${(records[i].ticks / TICK_RATE).toFixed(1)}s${records[i].skills === undefined ? '' : ` · Fewest skills ${records[i].skills}`}${level.crystals?.length ? ` · ◆ ${records[i].gems || 0}/${level.crystals.length}` : ''}</small>` : ''}</button>`).join('')}</div>`);
  const filterLevels = () => {
    for (const card of $('modal-content').querySelectorAll('.level-card')) {
      const index = Number(card.dataset.level), level = LEVELS[index];
      const text = `${level.name} ${level.theme} ${Object.keys(level.skills).join(' ')}`.toLowerCase();
      card.hidden = ($('chapter').value !== 'all' && Math.floor(index / 8) !== Number($('chapter').value)) || !text.includes($('level-search').value.trim().toLowerCase()) || ($('unfinished').checked && progress[index] >= level.need);
    }
    $('no-levels').hidden = !!$('modal-content').querySelector('.level-card:not([hidden])');
  };
  $('chapter').onchange = filterLevels;
  $('level-search').oninput = filterLevels;
  $('unfinished').onchange = filterLevels;
  $('modal-content').querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.level);
    modal.close();
    if (game.status === 'running') confirmAction('Leave this expedition?', 'Your current attempt will restart. Completed levels and best rescues are kept.', 'Change level', () => loadLevel(index));
    else loadLevel(index);
  }));
}

function help() {
  const mechanics = {
    water: 'Water needs a Swimmer. A Floater does not protect against drowning.',
    portals: 'Enter the blue portal to emerge at its matching orange exit.',
    gates: 'Walk onto the numbered pressure switch to open its gate permanently.',
    springs: 'Gold spring pads launch walkers across short gaps without spending a skill.',
    wind: 'Arrow-marked wind carries open parachutes in the indicated direction.',
    hazards: 'Hazards are fatal without a Shield. Cycling traps are safe only while marked SAFE.',
    crystals: 'Collect crystals by walking close to them. The counter shows how many unlock HOME.',
  };
  openModal('Little feet. You make the plan.', `<p class="dialog-copy">Lemmings walk on their own and turn at walls. Select a skill, then click a lemming. Falls over 100 pixels are fatal without a Floater. Silver terrain is indestructible.</p>
    <h3>In this expedition</h3><p class="dialog-copy">${game.level.hint}</p>
    ${Object.entries(mechanics).filter(([key]) => game.level[key]?.length).map(([, text]) => `<p class="dialog-copy">${text}</p>`).join('')}
    <div class="guide">${SKILLS.filter(s => s.id in game.level.skills).map(s => { const i = SKILLS.indexOf(s); return `<div><strong>${i >= 8 ? 'Shift+' : ''}${i % 8 + 1} · ${s.name}</strong><p>${s.help}</p></div>`; }).join('')}</div>
    <p class="dialog-copy" style="margin-top:22px"><b>Controls:</b> 1–8 select classic skills; Shift+1–8 select expansion skills. Space pauses; F cycles 1×, 3×, 0.5×; period steps one tick; R restarts. Focus the field and use ←/→ to select a lemming, Enter to assign. Skills work while paused. Hold entrance stops new releases, not the clock. Direction filtering separates overlapping lemmings. Zoom magnifies the field; scroll to explore, or Follow a keyboard-selected lemming.</p>`);
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
  $('viewport').classList.remove('zoomed');
  $('viewport').scrollTop = 0; $('viewport').scrollLeft = 0;
  paused = false;
  const won = game.status === 'won';
  const used = Object.entries(game.level.skills).reduce((sum, [id, count]) => sum + count - game.skills[id], 0);
  if (won) {
    progress[levelIndex] = Math.max(progress[levelIndex] || 0, game.saved);
    records[levelIndex] = { ticks: Math.min(records[levelIndex]?.ticks ?? Infinity, game.tick), skills: Math.min(records[levelIndex]?.skills ?? Infinity, used), gems: Math.max(records[levelIndex]?.gems || 0, game.crystals.size) };
    try { localStorage.setItem('lemmings-records', JSON.stringify(records)); } catch { /* Records are optional. */ }
    try { localStorage.setItem('lemmings-progress', JSON.stringify(progress)); } catch { /* Storage is optional. */ }
  }
  const complete = won && LEVELS.every((level, i) => progress[i] >= level.need);
  $('briefing').hidden = false;
  $('result-stats').hidden = false;
  $('replay').hidden = !won;
  $('result-stats').textContent = `Skills used: ${used}${won ? ` · Fewest in a win: ${records[levelIndex].skills}` : ''}`;
  if (game.level.crystals?.length) $('result-stats').textContent += ` · ◆ ${game.crystals.size}/${game.level.crystals.length}${game.crystals.size === game.level.crystals.length ? ' All crystals!' : ''}`;
  $('briefing-kicker').textContent = won ? complete ? 'Every expedition completed!' : game.saved === game.level.total ? '★ Perfect rescue — everyone survived!' : 'A little victory!' : 'There’s another way.';
  $('briefing-title').textContent = won ? complete ? 'You brought them home.' : 'Home, sweet home.' : 'Let’s try a new plan.';
  $('briefing-copy').textContent = `${game.saved} of ${game.level.total} lemmings rescued. ${won ? 'Your little friends thank you.' : `You needed ${game.level.need}. ${game.tick >= game.level.time * TICK_RATE ? 'Time ran out.' : 'Try pausing to plan your next move.'}`}`;
  $('briefing-foot').textContent = won ? `Time: ${(game.tick / TICK_RATE).toFixed(1)}s · Fastest win: ${(records[levelIndex].ticks / TICK_RATE).toFixed(1)}s` : game.level.hint;
  $('start').textContent = won ? levelIndex < LEVELS.length - 1 ? 'Next expedition ▶' : 'Choose an expedition ▦' : 'Try again ↻';
  announce(`${won ? 'Level complete.' : 'Level failed.'} ${game.saved} rescued.`);
  $('start').focus({ preventScroll: true });
}

function targetable(w) { return w.alive && (Number($('direction').value) === 0 || w.dir === Number($('direction').value)); }

function nearest(x, y) {
  let best = null, distance = 24;
  for (const w of game.lemmings) if (targetable(w)) {
    const d = Math.hypot(w.x - x, w.y - 10 - y);
    if (d < distance) { best = w.id; distance = d; }
  }
  return best;
}

function assign(id) {
  if (!game.lemmings.some(w => w.id === id && targetable(w))) return;
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
  pointer = { x: event.clientX, y: event.clientY };
  keyboardTarget = null;
});
canvas.addEventListener('pointerleave', () => { pointer = null; hovered = null; });
canvas.addEventListener('click', event => {
  const rect = canvas.getBoundingClientRect();
  assign(nearest((event.clientX - rect.left) * WIDTH / rect.width, (event.clientY - rect.top) * HEIGHT / rect.height));
});
canvas.addEventListener('keydown', event => {
  const alive = game.lemmings.filter(targetable).sort((a, b) => a.x - b.x);
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); pointer = null;
    if (!alive.length) return;
    const current = alive.findIndex(w => w.id === keyboardTarget);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const index = current < 0 ? (direction > 0 ? 0 : alive.length - 1) : (current + direction + alive.length) % alive.length;
    const next = alive[index];
    keyboardTarget = next.id;
    if (following !== null) following = next.id;
    const scale = canvas.clientWidth / WIDTH;
    $('viewport').scrollLeft = Math.max(0, next.x * scale - $('viewport').clientWidth / 2);
    $('viewport').scrollTop = Math.max(0, next.y * scale - $('viewport').clientHeight / 2);
    announce(`Lemming ${next.id + 1}, ${next.state}${['climber', 'floater', 'runner', 'swimmer', 'shield'].filter(s => next[s]).map(s => `, ${s}`).join('')}.`);
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
$('step').onclick = () => {
  if (game.status !== 'running') return;
  paused = true; accumulator = 0; game.update(); updateUI();
};
$('speed').onclick = () => { speed = speed === 1 ? 3 : speed === 3 ? .5 : 1; updateUI(); };
$('hold').onclick = () => { game.releaseHeld = !game.releaseHeld; updateUI(); };
$('direction').onchange = () => { keyboardTarget = null; hovered = null; };
$('share').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); announce('Level link copied.'); $('share').textContent = 'Link copied ✓'; }
  catch { announce('Copy the address bar to share this level.'); $('share').textContent = 'Copy address bar'; }
};
$('fullscreen').hidden = !document.fullscreenEnabled;
$('fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector('.app').requestFullscreen();
  } catch { announce('Full screen is unavailable. The game still works in this window.'); }
};
document.addEventListener('fullscreenchange', () => {
  $('fullscreen').setAttribute('aria-pressed', String(!!document.fullscreenElement));
  $('fullscreen').textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen ⛶';
  pointer = null;
});
$('follow').onclick = () => {
  following = following === null ? (game.lemmings.find(w => w.id === keyboardTarget && w.alive) || game.lemmings.find(w => w.alive))?.id ?? null : null;
  pointer = null; updateUI();
};
$('zoom').onclick = () => {
  $('viewport').classList.toggle('zoomed');
  pointer = null;
  const scale = canvas.clientWidth / WIDTH;
  const target = game.lemmings.find(w => w.id === hovered && w.alive) || { x: game.level.spawn[0], y: game.level.spawn[1] };
  $('viewport').scrollLeft = target.x * scale - $('viewport').clientWidth / 2;
  $('viewport').scrollTop = target.y * scale - $('viewport').clientHeight / 2;
  updateUI();
};
$('restart').onclick = restart;
$('replay').onclick = () => loadLevel(levelIndex);
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
    score ||= new Soundscape(audio);
    score.volume = Number($('music-volume').value) / 100;
    await audio.resume(); sound = !sound;
    score.effects.gain.value = sound ? Number($('effects-volume').value) / 100 : 0;
    $('sound').textContent = sound ? 'Sound on' : 'Sound off';
    $('sound').setAttribute('aria-pressed', String(sound));
    $('sound').setAttribute('aria-label', sound ? 'Turn sound off' : 'Turn sound on');
    tone('assign');
  } catch { announce('Sound is unavailable in this browser. The game still works.'); }
};
$('music-volume').oninput = event => { if (score) score.volume = Number(event.target.value) / 100; };
$('effects-volume').oninput = event => { if (score && sound) score.effects.gain.value = Number(event.target.value) / 100; };
for (const id of ['music-volume', 'effects-volume']) {
  try {
    const stored = localStorage.getItem(`lemmings-${id}`), value = Number(stored);
    if (stored !== null && Number.isFinite(value) && value >= 0 && value <= 100) $(id).value = value;
  } catch { /* Audio preferences are optional. */ }
  $(id).addEventListener('input', () => {
    try { localStorage.setItem(`lemmings-${id}`, $(id).value); } catch { /* Storage is optional. */ }
  });
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !modal.open && game.status === 'running') {
    paused = true; accumulator = 0; updateUI(); announce('Paused. Take your time.'); return;
  }
  if (modal.open || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.matches('input, select, a')) return;
  if (/^Digit[1-8]$/.test(event.code)) chooseSkill(SKILLS[Number(event.code.slice(-1)) - 1 + (event.shiftKey ? 8 : 0)].id);
  if (event.code === 'Space' && !event.target.matches('button')) { event.preventDefault(); $('pause').click(); }
  if (event.key.toLowerCase() === 'f') $('speed').click();
  if (event.key === '.') $('step').click();
  if (event.key.toLowerCase() === 'r') restart();
  if (event.key.toLowerCase() === 'h') help();
  if (event.key.toLowerCase() === 'l') levelMenu();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.status === 'running') { paused = true; updateUI(); }
  if (audio) {
    if (document.hidden) {
      score.music.gain.value = 0;
      audio.suspend().catch(() => {});
    } else if (sound) audio.resume().catch(() => announce('Tap Sound to resume audio.'));
  }
  accumulator = 0; lastTime = 0;
});

function frame(now) {
  const delta = lastTime ? Math.min(100, now - lastTime) : 0;
  lastTime = now;
  const active = game.status === 'running' && !paused && !modal.open && !document.hidden;
  score?.update(active && sound && $('music-enabled').checked, $('track').value === 'auto' ? levelIndex : Number($('track').value) * 8);
  if (active) {
    accumulator += delta * speed;
    while (accumulator >= 1000 / TICK_RATE) { game.update(); accumulator -= 1000 / TICK_RATE; }
  } else accumulator = 0;
  for (const event of game.events.splice(0)) {
    renderer.effect(event); tone(event.type === 'lost' && event.x === undefined ? 'defeat' : event.type, event);
    if (event.type === 'switch') announce('Pressure switch activated. A gate is now open.');
    if (event.type === 'warning') announce(`${event.remaining} seconds remaining.`);
    if (event.type === 'crystal') announce(`Crystal collected. ${game.crystals.size} found.${game.exitOpen ? ' Home is unlocked.' : ' Find the remaining crystals.'}`);
    if (event.type === 'save') announce(`${game.saved} of ${game.level.need} needed rescued.`);
  }
  if (['won', 'lost'].includes(game.status) && !resultShown) results();
  const tracked = game.lemmings.find(w => w.id === following && w.alive);
  if (tracked) {
    const scale = canvas.clientWidth / WIDTH;
    $('viewport').scrollLeft = tracked.x * scale - $('viewport').clientWidth / 2;
    $('viewport').scrollTop = tracked.y * scale - $('viewport').clientHeight / 2;
  } else following = null;
  const rect = canvas.getBoundingClientRect();
  hovered = pointer ? nearest((pointer.x - rect.left) * WIDTH / rect.width, (pointer.y - rect.top) * HEIGHT / rect.height) : keyboardTarget;
  const target = game.lemmings.find(w => w.id === hovered && targetable(w));
  if (!target) hovered = null;
  $('target-status').textContent = target ? `#${target.id + 1} ${target.dir > 0 ? '→' : '←'} ${target.state}${['climber', 'floater', 'runner', 'swimmer', 'shield'].filter(s => target[s]).map(s => ` · ${s}`).join('')}` : 'Point at a lemming to inspect it.';
  renderer.draw(game, hovered, active);
  // DOM values only change at simulation cadence, not for every painted frame.
  if (frame.lastTick !== game.tick) { updateUI(); frame.lastTick = game.tick; }
  requestAnimationFrame(frame);
}

const linkedLevel = Number(new URL(location.href).searchParams.get('level')) - 1;
let lastLevel = 0;
try {
  const stored = Number(localStorage.getItem('lemmings-last-level'));
  if (Number.isInteger(stored) && LEVELS[stored]) lastLevel = stored;
} catch { /* Storage is optional. */ }
const initialLevel = Number.isInteger(linkedLevel) && LEVELS[linkedLevel] ? linkedLevel : lastLevel;
loadLevel(initialLevel, initialLevel === 0);
requestAnimationFrame(frame);
