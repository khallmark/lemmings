# Lemmings

An original, browser-based rescue puzzle game inspired by Lemmings. Eight levels
take you from your first tunnel to a combined digging, bridging, and climbing
challenge. No build step, backend, images, or JavaScript dependencies required.

## Play the game

Serve this directory with any static HTTP server. With Python 3 installed:

```sh
python3 -m http.server 8080
```

Open the server in a browser. ES modules require HTTP; opening `index.html` as a
local file will not work. Google Fonts is optional; system fonts are used when
offline. The game's artwork and sound effects are generated locally.

- Select a skill, then click a lemming. You can assign skills while paused.
- **1–8:** Climber, Floater, Bomber, Blocker, Builder, Basher, Miner, Digger.
- **Space:** pause/resume when the game field is focused. **F:** 1×/3× speed.
- **R:** restart with confirmation. The release slider controls spawn frequency.
- **Keyboard targeting:** focus the field, use left/right arrows to cycle living
  lemmings, then Enter to assign the selected skill.
- On narrow screens, swipe the playfield horizontally. Controls stay on screen.
- Sound starts muted. Enable it with the Sound button.

Walkers turn at walls and blockers. Climbers and floaters keep their abilities.
Builders place 16 steps; bashers, miners, and diggers remove earth in their own
directions. Falls greater than 100 world pixels are fatal without a floater.
Silver steel cannot be destroyed. Bombers explode after three game seconds.
Nuke stops spawning and explodes the remaining walkers; rescued walkers stay safe.

Each level has a rescue target, time limit, and finite skill inventory. The result
appears when everyone has exited or died, or time expires. Every level is available
from Level select. Best successful rescue counts persist in localStorage on the
same browser and origin. If storage is unavailable, the game still runs without
persistent records. Switching browser tabs automatically pauses the game.

## Development and tests

Requires Node.js 20+ to run tests; nothing needs to be installed:

```sh
npm test
```

- `engine.js` — deterministic 30 Hz simulation and pixel terrain collision map.
- `levels.js` — original level layouts, inventories, goals, and skill descriptions.
- `renderer.js` — Canvas pixel art, terrain caching, characters, and particles.
- `game.js` — browser input, menus, playback, audio, and saved records.
- `game.test.js` — complete legal-input solutions for all eight levels, plus
  fall boundaries, steel, inventory, bombs, nuke, timeout, and reset checks.

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
