@AGENTS.md

Use `/ponytail` for every change: the simplest solution that works.

## Git workflow
- One short-lived branch per change: branch off `main`, finish, merge the same day, delete the branch. Never branch off an unmerged branch.
- Tests are the gate: `npm test`, `npx tsc --noEmit` and `npm run lint` must pass before merging. Small fixes can go straight to `main`.
- Open a PR only when review matters: big or risky changes, and outside contributors.
- Batch small cleanups into one change, not one PR each.
