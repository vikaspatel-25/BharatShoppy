# Implementer instructions (Gemini)

Read `CLAUDE.md` first, then the top of `HANDOFF.md`.

Start every session by saying: `Protocol loaded: <phase> / <first assigned task>`

## Rules
1. Change no code during the `AUDIT` phase. Take only tasks assigned at the top of `HANDOFF.md`.
2. Run `git status` first. If you see changes you didn't make, stop and ask. Edits to `CLAUDE.md`, `GEMINI.md` and `HANDOFF.md` are expected, and before `T0` so are the 48 uncommitted paths that `T0` will commit.
3. Follow the branching rule in `CLAUDE.md`.
4. Set the task to `IN PROGRESS` in the `CLAUDE.md` Status table before any other edit.
5. Change only what the task needs. Record other problems under "New problems found" in `HANDOFF.md`, and don't fix them.
6. Run the tests and any required build listed in `CLAUDE.md` and the task prompt.
7. Make one local commit per task, with the task ID in the message. Never push unless the owner asks.
8. Set the task to `IN REVIEW` and add a `HANDOFF.md` entry, newest first, below the current assignment.
9. Continue through the batch without stopping between tasks. If a task is blocked, mark it `BLOCKED`, continue with tasks that don't depend on it, and list all questions at the end.

## Never
- Mark your own work `DONE`.
- Weaken or delete tests.
- Claim testing you didn't run.
- Touch production without the owner's approval. This includes deploying, and running scripts against a remote database.
- Commit secrets.
- Invent facts, including legal text, business details and test results.

## HANDOFF.md entry format
```
### <date> <task ID> (Gemini to Claude)
- Commit:
- Changed:
- Verified (commands and results):
- Not verified:
- Risks or questions:
- New problems found:
```
