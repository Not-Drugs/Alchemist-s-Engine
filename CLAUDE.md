# Alchemist's Engine

An incremental/idle merge game with an ASCII terminal aesthetic.

## Project Structure

```
/
├── index.html    # Main HTML structure with ASCII art visuals
├── style.css     # Terminal/CRT aesthetic styling (green-on-black, scanlines)
├── game.js       # All game logic in one file
└── CLAUDE.md     # This file
```

## Tech Stack

- Vanilla HTML/CSS/JavaScript (no dependencies)
- Local storage for save/load
- Pure CSS animations for terminal effects

## How to Run

Open `index.html` in any modern browser.

## Game Mechanics Overview

### Progression Tiers

1. **Alchemical Table + Furnace** (Starting)
   - 6x4 drag-and-drop merge grid
   - 8 fuel tiers: Spark → Ember → Kindling → Coal → Charite → Blazite → Infernite → Solite
   - Each merge triples fuel value
   - Drop fuel into furnace to generate Heat

2. **Smelter** (Unlocks at 500 Heat)
   - Spawn ore for 10 Heat
   - 5 ore tiers that merge like fuel
   - Requires furnace temp ≥100° to smelt
   - Produces Metal

3. **Forge** (Unlocks at 100 Metal)
   - Convert 5 Metal → Alloy

4. **Workshop** (Unlocks at 50 Alloy)
   - Craft Gears from Alloy (3 Alloy → 1 Gear)
   - Build automation machines:
     - Auto-Sparker (10 Gears) - auto-spawns fuel
     - Auto-Miner (25 Gears) - auto-spawns ore
     - Heat Amplifier (50 Gears) - +50% heat generation each

5. **Sanctum** (Unlocks at 500 Gears + Essence Condenser upgrade)
   - Essence generates passively from furnace temperature
   - Prestige: spend 1000+ Essence to transmute Philosopher's Stones
   - Each stone gives +25% to all production permanently

### Key Game Constants (game.js)

- `FUEL_TIERS` - 8 tiers, values triple (1, 3, 9, 27, 81, 243, 729, 2187)
- `ORE_TIERS` - 5 tiers, same tripling pattern
- `GRID_SIZE` - 24 cells (6x4)
- `UPGRADES` - Object with furnace/smelter/forge/workshop upgrade arrays
- `ACHIEVEMENTS` - 18 achievements with ASCII icons

### ASCII Visual Style

- Fuel items: `*`, `**`, `~`, `#`, `##`, `^`, `^^`, `@`
- Ore items: `o`, `O`, `0`, `()`, `<>`
- Resource icons: `[~]` Heat, `[#]` Metal, `[%]` Alloy, `[*]` Gears, `[+]` Essence
- Buttons: `[SAVE]`, `[+] Spark`, `[>] Forge Alloy`
- Animated ASCII art for furnace flames and smelter waves

### Save System

- Auto-saves every 30 seconds to localStorage
- Export/Import via base64 encoded JSON
- Key: `alchemistsEngine`

## Development Notes

- Game loop runs at 10 ticks/second (100ms interval)
- All UI updates happen in `updateUI()` function
- Drag-and-drop uses native HTML5 drag events
- Prestige resets everything except: Philosopher's Stones, prestige count, achievements, cumulative stats

## Future Ideas

- More automation buildings
- Research tree
- Multiple furnaces
- Offline progress calculation
- Sound effects (terminal beeps)
- More prestige layers
