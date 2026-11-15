# Operations & Infrastructure Guide

## Database Backups (MongoDB Atlas)

> [!IMPORTANT]
> Automatic database backups are managed directly within MongoDB Atlas cloud infrastructure.
> This repository does NOT create, execute, or store database backups in application code.
> The owner must confirm and configure the following backup operations directly in the MongoDB Atlas console before serving real production users.

### Backup Verification Checklist for the Cluster Owner

1. **Enable Cloud Backups:**
   - Log into [MongoDB Atlas](https://cloud.mongodb.com).
   - Navigate to **Database Deployments** -> Select your cluster -> **Backup** tab.
   - Confirm **Cloud Backup** is toggled ON (Continuous Cloud Backups).

2. **Snapshot Policy & Retention Window:**
   - Verify the snapshot schedule is active (e.g. daily snapshots retained for 7 to 30 days).
   - If Point-In-Time Recovery (PITR) is supported on your Atlas tier, confirm it is enabled with an appropriate restore window (e.g. 7 days).

3. **Disaster Recovery & Restore Drills:**
   - Periodically test a restore drill: select a recent snapshot and restore to a separate test/staging cluster to ensure data integrity and verify recovery procedures.
   - Do NOT run restore operations against the live production cluster without prior scheduled downtime and data export.

4. **Access Control & Network Security:**
   - Maintain strict IP Access Lists in Atlas Network Security.
   - Do not set `0.0.0.0/0` in production; whitelist only deployed platform IP ranges (e.g. Vercel integration or dedicated VPC peering).
   - Ensure the database user has least-privilege permissions scoped only to the `bharatshopy` database.

## Automated Vendor Removal Cleanup (Vercel Cron)

The vendor removal protocol enforces a mandatory 7-day hold window before permanently deleting a vendor profile, store details, listings, and Cloudinary media assets.

- **Endpoint:** `/api/cron/cleanup-removed-vendors`
- **Schedule:** Daily at midnight UTC (`0 0 * * *`), configured in the root `vercel.json`.
- **Authentication:** Vercel Cron automatically passes `Authorization: Bearer <CRON_SECRET>` upon invocation.
- **Required Secret:** The owner must generate a high-entropy secret string and configure `CRON_SECRET` in the Vercel Project Environment Variables before deployment.
- **Fail-Safe Execution:** If media deletion from Cloudinary fails or returns no result, the vendor and store records are preserved in the database to be safely retried during the subsequent cron execution.

## Admin audit log and notifications

- **`admin_audit_log`:** one entry per admin action that changes data: approving or rejecting an application or a plan request, renewing or ending a plan, sending a renewal reminder, removing a vendor or cancelling a removal, and hiding or restoring a listing. Each entry holds the admin's email, the action, the target, a short details object and the client IP. Codes, tokens, passwords, secrets and hashes are never stored. The admin panel shows it on the audit log page.
- **`admin_notifications`:** the admin panel's notification bell. A notification is created when a vendor applies, requests a plan, or renames a store.
- **Indexes:** `npm --prefix server run create-indexes` creates `createdAt` and `action` indexes on the audit log, and `createdAt` and `read` indexes on notifications, along with the existing ones. Run it once against each database after deploying this change. Nothing deletes old entries yet, so both collections grow over time.

## Plans and limits

Plans live in the `subscription_plans` collection and are edited on the admin panel's "Plans and limits" page. When the collection is empty, or the database can't be reached, the built-in defaults in `server/src/data/mockData/subscriptionPlans.js` are used.

- The first edit copies any missing default plans into the collection, so no plan disappears. To fill it before anyone edits, run `node scripts/seedPlans.js` from `server/` with `MONGO_URI` set. It only adds missing plan IDs and never overwrites a plan. It refuses to run when `NODE_ENV=production` unless `ALLOW_PLAN_SEED_IN_PRODUCTION=true` is set.
- `node scripts/createIndexes.js` adds a unique index on `subscription_plans.planId`.
- An edit changes no store. A store gets the plan's item and photo limits at its next activation or renewal. New stores get the starter plan's limits when their application is approved.
- A plan can be switched off for new requests. It still shows as the current plan of stores that have it. Plans can't be created or deleted from the panel.
- The item and photo lines on plan cards are generated from the numbers. Extra lines are checked against the same banned words as the plan claims test (`server/src/data/planClaims.js`).


## Deployment (one Vercel project)

The client and the API deploy together as one Vercel project, `bharatshopy`, built from the repository root. It serves `www.bharatshopy.com`, `bharatshopy.com` and `*.bharatshopy.com`.

- **Root `vercel.json`:** installs `server/` and `client/`, builds the client into `client/dist` (served from Vercel's CDN), sends `/api/*` to the Express function in `api/index.js`, sends every other path to `index.html`, and holds the cron.
- **`api/index.js`:** exports `server/src/index.js`. The API routes themselves live in `server/src` as before.
- **Environment variables:** all server variables (`MONGO_URI`, `AUTH_SECRET`, `CRON_SECRET`, `CLIENT_URL`, and the Gmail and Cloudinary ones once they exist) are set on this one project. The client needs none.
- **Local development is unchanged:** `cd server && npm run dev` and `cd client && npm run dev`, with Vite proxying `/api` to port 7002.
- Until 2026-11-15 the API was a separate project, `bharat-shoppy-server`, which the client reached through a rewrite. That project was deleted after the move.
