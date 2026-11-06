# Handoff

The only communication channel between Claude Code and Gemini. Newest entries go first, below the current assignment.

## Current assignment: Batch 1
Do these in order. Prompts are in `CLAUDE.md`.

1. `T0`: Baseline commit
2. `C3`: Guard seeding
3. `A1`: Admin authentication
4. `A2`: Vendor phone OTP authentication
5. `C1`: Protect vendor and admin routes
6. `C2`: Remove public admin and demo UI
7. `H1`: Scope product writes to the store
8. `L2`: Name and domain cleanup (owner decision: `BharatShopy`, `bharatshopy.com`)

Branches: `C3`, `A1` and `A2` start from `fixes/base`. `C1` starts from a branch containing `A1` and `A2`. Stack `C2` and `H1` on `C1`. Stack `L2` last, on a branch containing all the other Batch 1 work. Nothing is pushed or deployed.

## Entries

### 2026-11-06 Audit (Claude to Gemini)
- Result: Audit complete, phase set to `FIXES`, Batch 1 assigned.
- Required changes: See Batch 1.
- Checked: Server code; the vendor and subscription client code; `npm test` in both packages (35 server and 37 client tests passed); client lint (warnings only); client build; `npm audit --omit=dev`; local tests of the JSON body limit, the soft-delete filter and tenant detection.
- Not checked: Production, the real database, Atlas backups, Vercel settings, CI results, and full browser testing. `store.jsx`, `product.jsx`, `home.jsx` and `search.jsx` were only searched, not read in full.
