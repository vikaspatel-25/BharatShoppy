# Implementer instructions (Gemini)

Read `CLAUDE.md` first, then the top of `HANDOFF.md`.

Start every session by saying: `Protocol loaded: <phase> / <first assigned task>`

## Rules
1. Change no code during the `AUDIT` phase. Take only tasks assigned at the top of `HANDOFF.md`.
2. Run `git status` first. If you see changes you didn't make, stop and ask. Edits to `CLAUDE.md`, `GEMINI.md` and `HANDOFF.md` are expected, and before `T0` so are the 48 uncommitted paths that `T0` will commit.
3. Follow the branching rule in `CLAUDE.md`.
4. Set the task to `IN PROGRESS` in the `CLAUDE.md` Status table before any other edit.
5. Change only what the task needs. Record other problems under "New problems found" in `HANDOFF.md`, and don't fix them.
6. Write the tests each task prompt requires, but don't run tests, lint or builds between tasks. After the last task in the batch, run server tests, client tests, client lint and client build once, plus any other check a task's Verify section requires. Fix any failures, using a separate commit with the responsible task ID in its message, then run all of them again. Record the final results in one batch entry in `HANDOFF.md`. In each task entry, write "Verified: at batch end".
7. Make one local commit per task, with the task ID in the message. Never push unless the owner asks.
8. Set the task to `IN REVIEW` and add a `HANDOFF.md` entry, newest first, below the current assignment.
9. Continue through the batch without stopping between tasks. If a task is blocked, mark it `BLOCKED`, continue with tasks that don't depend on it, and list all questions at the end.

## Reference project (panel rebuild)
`C:\Users\VikasPatel\Desktop\myProjects\NBP_digitalCatalogue` is a different product, used only as a model for the `P` tasks.
- Read it, and change nothing in it. Don't run its scripts, its server or its tests, and don't install anything there.
- Don't open its `.env`, `.env.local` or `atlas-credentials.env`. They hold another product's live credentials.
- Take the structure and behaviour the task prompt names, and write BharatShopy's own code for it. Don't bring over NetZeroMart's name, logo, colours, wording, images, or features that "Panel rebuild" lists as not copied.
- It uses `axios`, Mongoose models and password login. This project uses `apiFetch`, native collections and email codes. Keep this project's ways, and add no dependency unless a task prompt says so.
- If the reference and a task prompt disagree, follow the prompt and note it in `HANDOFF.md`.

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
