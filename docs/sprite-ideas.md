# Sprite Ideas — Visual Concepts on the Shelf

A running catalog of ASCII sprite concepts that we've sketched and like
but aren't shipping yet. Pull from here when authoring a new kind, a
visual variant, or a future scene that wants the look.

Each entry has the sprite in context, a one-line intent, and a note on
when it might land. Names follow the kind-naming convention (what it
IS, not how it looks) so they slot into a `*_KINDS` registry directly
when the time comes.

## Engine — alternative mouth/intake silhouettes

Drafted during the level-2 engine upgrade brainstorm
(2026-05-03). The reinforced-mouth slot in the level-2 suite is going
elsewhere; saving these for future tier 3+ engine variants, alternate
engine kinds, or as decorative options for unlocked engine "skins."

### `engine-mouth-riveted`

Industrial heft — bolts around a wider rim. Reads as a sturdy
furnace door bolted shut.

```
    _______
   /       \
  |  .   .  |
  | o_____o |
  | o_____o |
  |_________|
```

### `engine-mouth-hinged`

Looks like the mouth can crack open. Implies movement / animation
potential — a future tier could animate the jaws parting.

```
    _______
   /       \
  |  .   .  |
  | /=====\ |
  | \=====/ |
  |_________|
```

### `engine-mouth-recessed-grate`

Deeper, layered mouth — brackets frame a small grate icon. The
extra depth implies a more elaborate combustion chamber inside.

```
    _______
   /       \
  |  .   .  |
  |  =[+]=  |
  |  ¯¯¯¯¯  |
  |_________|
```

### `engine-mouth-wide-slot`

Minimalist — just a bigger plain slot, no decoration. The upgrade
*is* the size. Useful if a later tier wants a clean look against
busier upgraded peripherals (smokestack, vents, gauges).

```
    _______
   /       \
  |  .   .  |
  |  _____  |
  |  ¯¯¯¯¯  |
  |_________|
```

## How to use this file

- When authoring a new kind, scan here first — there might already
  be a sketch that fits.
- When an idea is shipped (promoted to a `*_KINDS` registry), move
  the entry to a "Shipped" section at the bottom (or remove if it's
  fully captured in code+docs).
- New ideas: add a section per topic (e.g., "Smelter — alternative
  silhouettes", "Tree — winter variants") with subsections per
  sprite.
