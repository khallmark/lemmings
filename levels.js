export const SKILLS = [
  { id: 'climber', name: 'Climber', icon: '↟', help: 'Permanently climbs vertical walls. Watch the drop on the other side.' },
  { id: 'floater', name: 'Floater', icon: '☂', help: 'Permanently opens a parachute on long falls. Can be assigned in midair.' },
  { id: 'bomber', name: 'Bomber', icon: '✹', help: 'Explodes after 3 seconds, removing nearby earth. Steel survives.' },
  { id: 'blocker', name: 'Blocker', icon: '↔', help: 'Stands still and turns others around. Remove the ground or use a bomber to free the route.' },
  { id: 'builder', name: 'Builder', icon: '⌁', help: 'Builds 16 steps upward, then walks on. Assign again for a longer bridge.' },
  { id: 'basher', name: 'Basher', icon: '⇥', help: 'Tunnels horizontally through earth until the path is clear. Cannot cut steel.' },
  { id: 'miner', name: 'Miner', icon: '⤵', help: 'Digs a diagonal tunnel down and forward. Cannot cut steel.' },
  { id: 'digger', name: 'Digger', icon: '↓', help: 'Digs straight down through earth. Cannot cut steel.' },
];

// Rectangles are [x, y, width, height, material]. Material 2 is indestructible steel.
export const LEVELS = [
  {
    name: 'A little breakthrough', theme: 'Mosslight hollow', difficulty: 'First steps',
    hint: 'That wall is in the way. Select Basher, then click a lemming just before it reaches the wall. One tunnel helps everyone.',
    total: 10, need: 8, time: 120, spawn: [110, 275], exit: [847, 330],
    skills: { basher: 5, blocker: 2, bomber: 2 },
    terrain: [[30, 330, 900, 110], [420, 242, 56, 88]],
  },
  {
    name: 'Mind the gap', theme: 'The broken crossing', difficulty: 'Easy',
    hint: 'Builders make 16 steps. Start a bridge a little before the edge; the others will follow. Pause to make a precise assignment.',
    total: 10, need: 8, time: 120, spawn: [110, 265], exit: [847, 320],
    skills: { builder: 6, blocker: 2, bomber: 2 },
    terrain: [[30, 320, 390, 120], [480, 320, 450, 120]], hazards: [[420, 420, 60, 20]],
  },
  {
    name: 'A softer landing', theme: 'Dandelion descent', difficulty: 'Easy',
    hint: 'This drop is too high to survive. Give each lemming a Floater before it lands. Slow the release rate to give yourself more time.',
    total: 8, need: 6, time: 120, spawn: [105, 90], exit: [847, 350],
    skills: { floater: 8, blocker: 2, bomber: 2 },
    terrain: [[30, 145, 280, 35], [30, 350, 900, 90]],
  },
  {
    name: 'Up and over', theme: 'Ironroot ridge', difficulty: 'Easy',
    hint: 'Silver blocks are steel: you cannot dig through them. Give the lemmings Climber to get over this wall. Permanent skills stay with them.',
    total: 8, need: 6, time: 120, spawn: [110, 275], exit: [847, 330],
    skills: { climber: 8, floater: 8, builder: 3 },
    terrain: [[30, 330, 900, 110], [420, 266, 28, 64, 2]],
  },
  {
    name: 'The way is down', theme: 'Under the garden', difficulty: 'Tricky',
    hint: 'The exit is below. A Digger opens a vertical shaft for the whole group. Dig early, before they walk off the high platform.',
    total: 12, need: 10, time: 120, spawn: [130, 125], exit: [847, 320],
    skills: { digger: 5, floater: 4, blocker: 2, bomber: 2 },
    terrain: [[30, 180, 570, 48], [30, 270, 210, 16, 2], [30, 320, 900, 120]],
  },
  {
    name: 'Taking the scenic route', theme: 'The amber mines', difficulty: 'Tricky',
    hint: 'Miners carve a diagonal path through the earth. Start near the entrance so the whole group can use the same tunnel.',
    total: 12, need: 10, time: 150, spawn: [130, 135], exit: [847, 350],
    skills: { miner: 6, basher: 4, blocker: 2, bomber: 2 },
    terrain: [[30, 190, 550, 140], [30, 350, 900, 90, 2]],
  },
  {
    name: 'Wrong way, little friends', theme: 'The turning point', difficulty: 'Tricky',
    hint: 'They are heading left, away from home. Make the first lemming a Blocker to turn the rest around. You only need to save nine.',
    total: 10, need: 9, time: 120, spawn: [520, 275], direction: -1, exit: [847, 330],
    skills: { blocker: 3, bomber: 3, builder: 2 },
    terrain: [[230, 330, 700, 110]], hazards: [[0, 420, 230, 20]],
  },
  {
    name: 'Bring them home', theme: 'The last expedition', difficulty: 'Challenge',
    hint: 'Earth, a gap, and a steel wall. Bash a tunnel, bridge the gap, then climb or build over the steel. You have the whole toolkit now.',
    total: 16, need: 12, time: 180, spawn: [110, 185], exit: [847, 300],
    skills: { climber: 16, floater: 16, bomber: 5, blocker: 5, builder: 8, basher: 5, miner: 5, digger: 5 },
    terrain: [[30, 240, 400, 200], [260, 190, 36, 50], [490, 300, 440, 140], [650, 250, 24, 50, 2]],
    hazards: [[430, 420, 60, 20]],
  },
];
