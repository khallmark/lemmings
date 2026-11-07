# Gnomes

Small hats. Clever plans. An original browser-based rescue puzzle game inspired
by Lemmings, starring bearded woodland workers: **36 authored
puzzles, 16 skills, five original synthesized music themes**, and a campaign of
tunnels, bridges, water, wind, portals, switches, springs, conveyors, timed traps,
moving saws, and crystals.
No build step, backend, images, or JavaScript dependencies required.

**[Play on GitHub Pages](https://khallmark.github.io/lemmings/)**

## Play the game

Serve this directory with any static HTTP server. With Python 3 installed:

```sh
python3 -m http.server 8080
```

Open the server in a browser. ES modules require HTTP; opening `index.html` as a
local file will not work. Google Fonts is optional; system fonts are used when
offline. The game's artwork and sound effects are generated locally.

- Select a skill, then click a gnome. You can assign skills while paused.
- **1–8:** Climber, Floater, Bomber, Blocker, Builder, Basher, Miner, Digger.
- **Shift+1–8:** Walker, Turner, Runner, Platformer, Jumper, Swimmer, Stoner, Shield.
- **Space:** pause/resume when the game field is focused. **Escape:** pause.
- **F:** cycle 1×, 3×, and 0.5× speed. **Period:** pause and advance one tick.
- **H:** contextual help. **L:** campaign browser with chapter and skill search.
- **R:** restart with confirmation. The release slider controls spawn frequency.
- **Keyboard targeting:** focus the field, use left/right arrows to cycle living
  gnomes, then Enter to assign the selected skill.
- On narrow screens, swipe the playfield horizontally. Controls stay on screen.
- Sound starts muted. Enable it with the Sound button.
- **Hold entrance:** stop new releases while the crowd and clock keep moving.
- **Target direction:** select only left- or right-facing gnomes in a crowd.
- **Zoom / Follow:** magnify the field or track a keyboard-selected survivor.
- **Sound studio:** choose a soundtrack, mute only music, or mix music/effects.

Walkers turn at walls and blockers. Climbers and floaters keep their abilities.
Builders place 16 steps; bashers, miners, and diggers remove earth in their own
directions. Falls greater than 100 world pixels are fatal without a floater.
Silver steel cannot be destroyed. Bombers explode after three game seconds.
Nuke stops spawning and explodes the remaining walkers; rescued walkers stay safe.

Walker cancels ground jobs and frees blockers. Runner doubles walking only;
Platformer lays flat bridges. Jumper and springs clear small gaps. Swimmer handles
water, while Shield grants six seconds of hazard protection. Stoner sacrifices a
gnome to create terrain. Wind carries open parachutes. Numbered switches open
matching gates, portals transfer gnomes, and crystal counters explain exit locks.
Timed traps show the remaining safe/danger phase; builders show their stock.

Gold conveyor belts add one pixel per tick to walking speed in their arrow
direction. An ordinary walker stalls against a belt; a Runner can overcome it.
Belts do not carry workers or airborne gnomes, create ground, or bypass walls.
The four conveyor puzzles (29–32) combine them with bridges, tunnels, springs,
portals, and the furnace. Hold the entrance to give a pioneer time to prepare.

The clockwork garden (33–36) introduces moving saws on dotted rails. Their red
housings mark the danger area. Time a Shield or construct a raised bypass;
vertical blades and combined conveyor routes make the later puzzles harder.
The fifth original score, Mushroom minuet, follows this chapter automatically.

Each level has a rescue target, time limit, and finite skill inventory. The result
appears when everyone has exited or died, or time expires. Every level is available
from Level select. Best successful rescue counts persist in localStorage on the
same browser and origin. If storage is unavailable, the game still runs without
persistent records. Switching browser tabs automatically pauses the game.
The Gnomes rebrand preserves the existing URL and legacy `lemmings-*` save keys,
so previous rescues, records, and preferences remain available.

Perfect rescues earn stars. Fastest wins, fewest skills used in a win, and best
crystal collections are tracked independently. Share a puzzle with **Copy level
link** (`?level=1` through `?level=36`). Returning to the home URL reopens your last
expedition at its briefing, not midway through an attempt. Audio preferences are
saved, but sound always requires an explicit click. Reduced-motion preferences
disable decorative animation and particles without hiding hazard timing.

## Development and tests

Requires Node.js 20+ to run tests; nothing needs to be installed:

```sh
npm test
```

- `engine.js` — deterministic 30 Hz simulation and pixel terrain collision map.
- `levels.js` — original level layouts, inventories, goals, and skill descriptions.
- `renderer.js` — Canvas pixel art, terrain caching, characters, and particles.
- `game.js` — browser input, menus, playback, audio orchestration, and saved records.
- `audio.js` — original procedural melody, bass, percussion, and event effects.
- `game.test.js` — complete legal-input solutions for all 36 levels, plus
  fall boundaries, steel, inventory, bombs, nuke, timeout, and reset checks.
- `expansion.test.js` — expanded skills, environmental mechanics, entrance holds.

GitHub Pages automatically publishes the repository root on `main`. The Game
tests workflow runs on every push to `main` and on pull requests. Test locally
before pushing; Pages and the test workflow run independently. The 100 sequential
expansion passes and their executed checks are recorded in
`docs/loops/expansion/iterations.jsonl`.

This is an independent game with original levels and generated art, not a port of
the commercial game's assets or original level collection.

## Original walker playground

The original toy is preserved at `playground.html`; `walker.js` and
`walker.min.js` remain unchanged and can still be embedded independently.

Little pixel walkers that roam any web page. They walk on borders, buttons, images and text, turn at walls, and fall to the bottom of the window. Pick them up, throw them, or resize the window to launch them.

One script, no dependencies. The sprites are pure CSS, with no images.

### Embed a walker

On your site:

```html
<script src="https://cdn.jsdelivr.net/gh/MarkBlah/lemmings@main/walker.min.js"></script>
```

From the DevTools console on any page:

```js
document.head.append(Object.assign(document.createElement('script'),{src:'https://cdn.jsdelivr.net/gh/MarkBlah/lemmings@main/walker.min.js'}))
```

Each load adds one walker. `__walker.add()` adds more.
