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
