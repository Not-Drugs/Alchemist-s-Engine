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
     `cowork/README.md` section 2. Its first tick arms a persistent
     Monitor on `cowork/inbox.md` so subsequent ticks fire on cowork's
     writes (within ~3s) rather than on a fixed timer — ScheduleWakeup
     stays as the ~30 min fallback heartbeat. Confirm to the user that
     you're watching `cowork/inbox.md` for `[new]` and `[reopened]`
     tickets.
   - If **cowork-Claude**: confirm with the user what URL to point at
     (GitHub Pages live deploy by default, or the user's localhost
     server for un-pushed changes). Then follow the responsibilities
     in `cowork/README.md` section 3, which include checking
     `cowork/inbox.md` at the **start of every turn** (not only on
     loop ticks). Start the `/loop` from section 3 as the idle-period
     fallback — it also arms a Monitor on `cowork/inbox.md` if your
     environment supports it.

4. **Confirm the session is live** with a one-line status to the user
   ("Cowork mode active as terminal-Claude; Monitor armed on inbox.md.")
   so they know the wake mechanism is in place.

## Notes

- The `/loop` ScheduleWakeup is the safety net. The real-time wake
  mechanism is the inbox-change Monitor (terminal) and the per-turn
  inbox check (cowork) — both react to writes within seconds, not the
  ~30 min fallback interval.
- Never touch tickets owned by the other side. The status table in
  PROTOCOL.md is the routing rule — terminal owns `[new]`/`[reopened]`,
  cowork owns `[ready-for-retest]`/`[needs-info]` it opened, the user
  owns `[needs-human]`.
- If you find the loops looping without progress (e.g. third
  `[reopened]` on the same ticket), flip to `[needs-human]` with a
  comment naming the decision the user needs to make.
