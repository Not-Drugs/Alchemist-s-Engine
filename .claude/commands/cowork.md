---
description: Enter cowork playtest mode (terminal or cowork side). Reads PROTOCOL.md + README.md, identifies which side, starts the appropriate /loop.
---

You're entering cowork playtest mode for Alchemist's Engine. The full
protocol lives in `cowork/PROTOCOL.md`; the bring-up steps and exact
loop prompts live in `cowork/README.md`.

## What to do

1. **Read both files first**, in this order: `cowork/PROTOCOL.md`, then
   `cowork/README.md`. Don't skim — the lifecycle and concurrency rules
   matter for getting routing right.

2. **Identify which side this session is.** Two possibilities:
   - **terminal-Claude** — you have full repo + shell access, can edit
     code, run git commands, push to main. This is the side that fixes
     bugs. Default assumption when running in Claude Code on the user's
     local machine.
   - **cowork-Claude** — you have browser-automation tools, can navigate
     to a URL, click, screenshot, see rendered DOM. This is the side
     that plays the game and verifies fixes.

   If you're unsure, ask the user **once**: "Am I terminal-Claude
   (fix code) or cowork-Claude (browser playtest)?"

3. **Start the appropriate workflow:**
   - If **terminal-Claude**: paste/start the `/loop` from
     `cowork/README.md` section 2 ("Start the terminal-Claude polling
     loop"). Confirm to the user that you're now polling
     `cowork/inbox.md` for `[new]` and `[reopened]` tickets.
   - If **cowork-Claude**: confirm with the user what URL to point at
     (GitHub Pages live deploy by default, or the user's localhost
     server for un-pushed changes). Then follow the responsibilities
     in `cowork/README.md` section 3, which include checking
     `cowork/inbox.md` at the **start of every turn** (not only on
     loop ticks). Start the `/loop` from section 3 as the idle-period
     fallback.

4. **Confirm the session is live** with a one-line status to the user
   ("Cowork mode active as terminal-Claude; polling inbox.md.") so they
   know the loop is running.

## Notes

- The `/loop` is the safety net. The real-time mechanism for cowork is
  the per-turn inbox check; for terminal it's the loop tick.
- Never touch tickets owned by the other side. The status table in
  PROTOCOL.md is the routing rule — terminal owns `[new]`/`[reopened]`,
  cowork owns `[ready-for-retest]`/`[needs-info]` it opened, the user
  owns `[needs-human]`.
- If you find the loops looping without progress (e.g. third
  `[reopened]` on the same ticket), flip to `[needs-human]` with a
  comment naming the decision the user needs to make.
