# BharatShoppy: Project Protocol

Current phase: FIXES

## Project summary
A local marketplace where shopkeepers, farmers and service providers list items. Customers browse and send enquiries over WhatsApp. Each store can also have its own subdomain storefront.

- `client/`: React 19, Vite, Tailwind. Deployed on Vercel.
- `server/`: Express 5, MongoDB through the native collections on `mongoose.connection.db`. Deployed on Vercel as `bharat-shoppy-server.vercel.app`.
- `client/vercel.json` rewrites `/api/*` to the server, so the browser sees the API as same-origin.
- CI: `.github/workflows/ci.yml`.

| Purpose | Command |
|---|---|
| Server tests | `cd server && npm test` |
| Client tests | `cd client && npm test` |
| Client lint | `cd client && npm run lint` |
| Client build (required for client changes) | `cd client && npm run build` |
| Dev servers | `cd server && npm run dev`, `cd client && npm run dev` |

## Roles
- **Claude Code (auditor and reviewer):** audits, writes task prompts, reviews work, and assigns batches. It never changes application code and edits only `CLAUDE.md`, `GEMINI.md` and `HANDOFF.md`.
- **Gemini (implementer):** makes all code changes, following `GEMINI.md`.
- **Owner:** makes product decisions, merges to `main`, pushes, and approves anything touching production.
- `HANDOFF.md` is the only communication channel between the two tools.

## Branching rule
- One branch per task, named `fix/<ID>-short-name`, with one local commit per task.
- `T0` creates `fixes/base`. Task branches start from `fixes/base`, or from the branch of an unmerged dependency.
- Merge into `fixes/base` only when `HANDOFF.md` tells you to, after the task is `DONE`.
- Never push and never commit to or merge into `main`. The owner does that.

## Product decisions
Decided 2026-11-06. Do not report these as bugs.

- **Implementer:** Gemini.
- **Live data:** the production database holds demo data only, per the owner. Production changes still need owner approval.
- **Name and domain:** the name is `BharatShopy` everywhere the code displays it, and the domain is `www.bharatshopy.com`. All other spellings are wrong.
- **Vendor accounts:** email verification code sign-up and login, sent by email. No phone OTP or SMS. An admin approves a vendor before they can go live. No self-service activation.
- **Admin account:** one admin record and no admin sign-up page. Login is password plus a 6-digit code sent to the admin email, which creates an httpOnly cookie. The session lasts 1 hour by default and renews while active. The code step must require a completed password step.
- **Admin role:** moderation and management only. Admins do not add or edit products from the admin area.
- **Payments:** manual. The vendor requests a plan and pays offline, then an admin activates it. No gateway for now. Only an admin can activate or renew.
- **Quota:** a plan limits total active items. Deactivated items do not count. It never resets monthly.
- **Listings:** go live instantly while the subscription is active.
- **Expired stores:** the store page stays visible with WhatsApp contact, products are hidden, and no data is deleted.
- **Deleting a product:** the vendor action stays a soft delete (`isActive: false`).
- **Vendor removal:** a 7-day hold with listings hidden, then permanent deletion of the profile, listings and media.
- **Email:** `nodemailer` over Gmail SMTP for now, with all sending in one file, `server/src/services/emailService.js`. Every send is awaited. Moving to a transactional provider before real launch is tracked as `E2`.
- **Images:** photos are stored in Cloudinary. MongoDB stores product details and photo links.
- **Plan and store claims:** the site must not promise anything that isn't built. Analytics, priority ranking and 24/7 support are removed from plans until they exist. Nothing is called verified, because no verification process exists.
- **Demo data:** all stores sharing one phone number, and the made-up demo store details, are acceptable only as demo data. See `M6` for what must happen before real launch.

## Open questions for the owner
- `Q2`: The owner must create a Gmail app password and set `GMAIL_USER`, `GMAIL_APP_PASSWORD` and `ADMIN_EMAIL`. Real login in production needs them.
- `Q4`: The owner must create a Cloudinary account and set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`. Real uploads in production need them.
- `Q5`: The owner must set `CRON_SECRET` in Vercel for the server project. Permanent deletion of removed vendors after the 7-day hold needs it.

## Status
Statuses: `TODO`, `IN PROGRESS`, `IN REVIEW`, `CHANGES REQUESTED`, `DONE`, `BLOCKED`.

| ID | Priority | Task | Depends on | Status | Notes |
|---|---|---|---|---|---|
| T0 | P0 | Commit uncommitted work as a baseline | none | DONE | Batch 1 |
| C3 | P0 | Guard seeding and auto-seeding | T0 | DONE | Batch 1 |
| A1 | P0 | Admin authentication | T0 | DONE | Reviewed |
| A2 | P0 | Vendor authentication (now email, not phone) | T0 | DONE | Reviewed |
| C1 | P0 | Protect vendor and admin routes | A1, A2 | DONE | Reviewed |
| C2 | P0 | Remove public admin and demo UI | C1 | DONE | Reviewed |
| R4 | P1 | Final review fixes | R3 | DONE | Reviewed |
| R3 | P1 | Batch 3 and 4 review fixes | R2, A4 | DONE | Reviewed |
| R2 | P0 | Batch 2 review fixes | R1 | DONE | Reviewed |
| R1 | P0 | Batch 1 review fixes and email login | L2 | DONE | Reviewed |
| E1 | P1 | Email notifications and failure handling | R1, A3, H6 | DONE | Reviewed |
| E2 | P2 | Move email to a transactional provider | E1 | BLOCKED | Needs an owner account, SPF and DKIM. Do before real launch |
| H1 | P1 | Scope product writes to the store | C1 | DONE | Reviewed |
| H4 | P1 | Hide soft-deleted products in feeds | T0 | DONE | Reviewed |
| H5 | P1 | Enforce visibility on direct pages | T0 | DONE | Reviewed |
| H6 | P1 | Fix subscription approval logic | C1 | DONE | Reviewed |
| H3 | P1 | Fix tenant detection on platform hosts | T0 | DONE | Reviewed |
| H2 | P1 | Move images to Cloudinary | R1 | DONE | Reviewed |
| H7 | P1 | Update vulnerable dependencies | T0 | DONE | Reviewed |
| H8 | P1 | Add rate limits, headers, CORS, health check | C1 | DONE | Reviewed |
| A3 | P1 | Vendor application and approval flow | A1, A2 | DONE | Reviewed |
| A4 | P2 | Vendor removal with 7-day hold | A3 | DONE | Reviewed with `R3` |
| M1 | P2 | Validate write input | C1 | DONE | Reviewed |
| M2 | P2 | Correct quota behaviour | H1 | DONE | Reviewed |
| M3 | P2 | Query only the data needed | H4, H5 | DONE | Reviewed |
| M4 | P2 | Make startup and location seeding reliable | C3 | DONE | Reviewed |
| M5 | P2 | Stop returning internal error text | T0 | DONE | Reviewed |
| M6 | P2 | Remove misleading demo and plan claims | T0 | DONE | Reviewed |
| M7 | P2 | Add legal pages | owner text | BLOCKED | Needs reviewed legal text from the owner |
| M8 | P3 | Fix missing product images | T0 | DONE | Reviewed |
| L1 | P3 | Accessibility fixes | C2 | DONE | Reviewed |
| L2 | P1 | Name and domain cleanup | H1 | DONE | Batch 1, owner decision |
| L3 | P3 | Restrict the `?tenant=` override to development | H3 | DONE | Reviewed |

Line numbers refer to the uncommitted working tree at audit time. If they have moved, find the code by name.

## Task prompts

### R4: Final review fixes
**Problem:** The review of the remaining Batch 3 and 4 tasks found the defects below.
**Fix:**
1. Approving a subscription request (`subscriptionController.js:393-406`) and `adminDirectRenew` (`:540-554`) set the store to `isActive: true` even when the store is pending removal (`removalStatus: "pending_deletion"`). A removed vendor's store then becomes public again during the 7-day hold. Return 409 for a store pending removal, and check before claiming the request.
2. Make `adminDirectRenew` (`:525-554`) atomic, as `R2` item 6 required. It reads the expiry and then writes, so two renewals at the same time lose days. Make the update conditional on the expiry that was read, and retry or return 409 if it changed.
3. In `approveApplication` (`vendorApplicationController.js:615-630`), revert the application to `pending` on any store insert failure, not only duplicate keys. Otherwise an application stays `approved` with no store.
**Verify:** Tests cover: renewing or approving a subscription for a store pending removal returns 409 and leaves it hidden; a changed expiry during direct renewal doesn't lose days; a non-duplicate insert error leaves the application `pending`. Server tests, client tests, lint and build pass.

### R3: Batch 3 and 4 review fixes
**Problem:** The review of Batches 3 and 4 found the defects below.
**Fix:**
1. Add the missing Batch 3 results entry to `HANDOFF.md`, using the real test, lint and build results from the end of Batch 3. If you no longer have them, say so instead of reconstructing them.
2. Make the upload size check fail closed (`cloudinaryService.js:337-339` and `:350-352`). Currently a Cloudinary API error, a missing `bytes` value or a missing configuration lets the photo save without a size check. In production, reject the save with a clear error when the size can't be confirmed. Record in `HANDOFF.md` that the 5 MB limit is enforced by checking through the API before saving.
3. In `removeVendor` (`adminVendorRemovalController.js:140-148`), mark only currently active products as hidden by the removal. Currently every product is marked, so `cancelVendorRemoval` (`:236-244`) brings back items the vendor had already deleted. Store the store's previous `isActive` value too, and restore that value on cancel instead of always setting `true` (`:217-219`).
4. In `executePermanentDeletion` (`:363-396`), if the media deletion fails or returns no result, keep that vendor's records and log it so the next run retries. Currently the store and vendor are deleted anyway, so the photos remain in Cloudinary with no record pointing to them.
5. Add a daily cron for `/api/cron/cleanup-removed-vendors` to `server/vercel.json`, because nothing calls it now, so permanent deletion never runs. Vercel cron sends `Authorization: Bearer <CRON_SECRET>`. Add `CRON_SECRET` to `server/.env.example` and `docs/operations.md`. Don't deploy, and don't set the secret.
**Verify:** Tests cover: a failed size lookup in production rejecting the save; removing and then cancelling keeps previously deleted items inactive and restores the store's previous state; a failed media deletion keeps the vendor's records for retry. `server/vercel.json` is valid JSON with the cron entry. Server tests, client tests, lint and build pass.

### R2: Batch 2 review fixes
**Problem:** The Batch 2 review found the defects below. Item 1 is a login bypass.
**Fix:**
1. Remove `codeHash` from the admin `tempToken` (`adminAuthController.js:133`). The token goes to the browser and its payload is readable, so anyone with the password can recover the 6-digit code offline: a local test did this in 74 ms. Bind the token with a new random value generated per login and stored on the admin record, and clear it when the code is used.
2. Make `validateProductMedia` (`cloudinaryService.js:166-173`) check every entry in `images`, as `H2` required. Accept a URL only if it is already on the product, or is under `https://res.cloudinary.com/<cloud name>/` and has a matching `imageAssets` entry whose `publicId` is in that store's folder. In production, fail closed if the cloud name is missing (`:199`). Reject non-string and null entries with 400: a null asset currently causes a 500 at `:178`.
3. Enforce the upload limits in the signature (`cloudinaryService.js:65-68`). `allowedFormats` and `maxFileSize` are only returned to the browser, so a vendor can upload other formats and sizes. Sign `allowed_formats` for JPEG, PNG and WebP, send the same value from the form, and use a mechanism Cloudinary actually enforces for the 5 MB limit. If Cloudinary can't enforce size on a signed request, verify the uploaded size through its API before saving, and record which approach you used.
4. Await Cloudinary deletion (`vendorCatalogController.js:365-371`), as Vercel can stop background work. Log failures without failing the save.
5. In `approveApplication` (`vendorApplicationController.js:504-547`), generate a random store `_id` and use `insertOne`. Currently the slug `0103` produces `store_0103`, and the upsert overwrites that existing store and links the applicant to it and its products. Add unique indexes for `stores.slug`, `stores.subdomain` and one pending application per email through a documented script, and handle duplicate-key errors with 409.
6. Claim the record first. In `approveApplication`, `rejectApplication` and `verifyPaymentRequest` (`subscriptionController.js:359-408`), atomically move the record from `pending` before creating a store or changing a subscription. Currently the store changes first, so a simultaneous reject or second approve returns 409 after the store has already been activated or extended. Do the same for `adminDirectRenew` if it reads and then writes the expiry.
7. Fix re-application in `submitApplication` (`:361-372`, `:414-419`). `$set` includes a new `_id`, which MongoDB rejects on an existing vendor, so a rejected vendor gets a 500 with an orphaned pending application. Allow rejected vendors to re-apply and keep their `_id`. Block `removed` vendors, who currently pass the check.
8. Check slug and subdomain availability before consuming the verification code (`:302` runs before `:311`).
9. In `submitApplication` (`:425-432`), catch email failures. The application is saved, so return 201 with a warning. Currently it returns 500 and a retry says the application is already pending.
10. Escape user-supplied values placed in email HTML, including store name, applicant name, city and rejection reason (`emailService.js:178-181` and similar). Strip line breaks from subjects.
11. Make `checkRateLimit` (`rateLimitHelper.js:33-89`) and code attempt counts atomic, because read-then-write lets parallel requests exceed the limit. Add a TTL index for `auth_limits`, which otherwise grows forever. In `verifyCode` (`vendorAuthController.js:160`), count only failed checks against an active code, so strangers can't lock a vendor out by sending wrong codes.
12. Link to `/vendor/apply` on the marketplace host from `VendorLogin.jsx`, since tenant routes send that path to the storefront.
13. Require `ADMIN_EMAIL` in production instead of falling back to `admin@bharatshopy.com` (`emailService.js`), and remove `error: error.message` from `resendApplicationEmail`.
**Verify:** Tests cover each item, including: `tempToken` payload contains no code-derived value; a foreign `images` URL and a null asset return 400; the signature includes `allowed_formats`; deletion is awaited; slug `0103` can't touch `store_0103`; reject then approve leaves the store unchanged; a rejected vendor can re-apply and a removed vendor can't; a taken slug doesn't consume the code; email failure on apply returns 201 with a warning; HTML in a store name is escaped; parallel attempts can't exceed the limit. Mark as not verified anything that needs real MongoDB or Cloudinary. Write real commit IDs in `HANDOFF.md`, and don't write "Not verified: None" unless real services were used.

### R1: Batch 1 review fixes and email login
**Problem:** The owner replaced phone OTP with email codes over SMTP. The Batch 1 review also found the defects listed under Fix. This supersedes the phone parts of `A2`.
**Fix:**
1. Create `server/src/services/emailService.js` as the only file that uses `nodemailer`, sending over Gmail SMTP with `GMAIL_USER` and `GMAIL_APP_PASSWORD`, and using `ADMIN_EMAIL` as the single name for the admin address. Replace `server/src/services/emailProvider.js`, whose production class (`:30-37`) reports success without sending anything. Keep the development logging behaviour. In production it must really send, and throw if unconfigured or if sending fails. Every caller must `await` sending, so Vercel can't stop the function first. Document the variables in both `.env.example` files. Use it for admin and vendor codes.
2. Replace vendor phone login with email: `request-code` and `verify-code` under `/api/vendor/auth/`, a vendor record keyed by normalised email, and an updated `VendorLogin.jsx`. Keep the 5-minute expiry, single use and attempt limit. Delete `smsProvider.js`, `phoneHelper.js` and the OTP routes, and replace their tests with equal coverage for email. Store contact and WhatsApp numbers are unchanged. Return the same response for known and unknown emails.
3. Move request and attempt limits from in-memory maps (`vendorAuthController.js:9-10`) to MongoDB, because memory isn't shared between Vercel instances. Set `trust proxy` correctly so limits don't treat all users as one IP.
4. Make `requireStoreOwner` load the vendor from the database on each request and use its current status and `storeId`. The session token's `status` (`authMiddleware.js:159`) stays "approved" for up to 24 hours after removal.
5. Escape `:storeId` before building the regular expressions at `authMiddleware.js:17-18`, or use exact matching on a normalised value. `(` makes the expression invalid, and `.*` matches every store. Don't fall back to mock stores in production (`:24-31`). All vendor and subscription store controllers must use `req.store`, not look the store up again from the raw parameter.
6. Make the admin `tempToken` single-use, as `A1` required, by binding it to the code issued in that login so older tokens stop working. Reject non-string `email`, `password` and `code` with 400: a non-string email currently returns 500.
7. In `apiFetch` (`client/src/lib/apiClient.js:15-24`), don't redirect on 401 from `/auth/` routes. Currently a wrong admin password reloads the page and the error message is lost.
8. After vendor login, navigate to `/vendor`: `VendorLogin.jsx:62` goes to `/vendor/:storeId`, which tenant routes don't have, so on a subdomain the vendor lands on the storefront. Have the dashboard always take the store from the session as `C2` required, and remove `routeStoreId` (`vendorDashboard.jsx:27-28`) and the `/vendor/:storeId` route.
9. Add `brand` and `subCategory` to the `H1` update allowlist (`vendorCatalogController.js:265-275`). The edit form sends them, and they are now silently dropped.
10. Add a documented local script that creates an approved vendor record for testing, since nobody can log in as a vendor until `A3`. It must refuse to run when `NODE_ENV=production`.
11. In `.env.example` files, leave `AUTH_SECRET` blank instead of giving a usable value.
**Verify:** Tests cover: the SMTP provider sending through a fake transport and throwing when unconfigured or failing; email login success, wrong, expired and reused codes; limits stored in the collection; a vendor removed after login getting 403; `(` and `.*` as `:storeId`; an old `tempToken` rejected; non-string input returning 400; `brand` and `subCategory` saved on edit. Search finds no `request-otp`, `verify-otp` or `smsProvider`. Server tests, client tests, lint and build pass. Do not send real email unless the owner supplies test SMTP settings.

### E1: Email notifications and failure handling
**Problem:** Beyond login codes, nobody is told about applications or subscription changes.
**Fix:** Add these to `emailService.js`, using the plan and store data on record: a new-application alert to the admin, an application confirmation to the applicant, vendor approval and rejection (with the reason), subscription activation, discontinuation, and a renewal reminder that the admin sends with a button. If an approval or subscription email fails, keep the database change, return a warning to the admin, and offer a resend action. Never lose access or data because email failed. Emails must not say "Payment Received", "UTR", "Invoice" or "Receipt", because payments are manual and aren't recorded. Don't add scheduled reminders or password reset.
**Verify:** Tests use a fake transport to cover each email, that sends are awaited, and a failed approval email returning a warning with the approval kept. Search finds no `nodemailer` outside `emailService.js`, and none of the banned wording in emails.

### E2: Move email to a transactional provider
**Problem:** Gmail SMTP has low sending limits and is unsuitable for real launch volume.
**Fix:** Blocked until the owner creates a provider account and sets up SPF and DKIM. Claude will complete this prompt when assigning it. Only `emailService.js` should need to change.
**Verify:** To be specified on assignment.

### T0: Baseline commit
**Problem:** 48 paths are uncommitted, including the whole vendor, admin, subscription and tenant system. Fixes can't be reviewed against it.
**Fix:** Create `fixes/base` from `main`. Make the protocol commit (`CLAUDE.md`, `GEMINI.md`, `HANDOFF.md`), the code commit (everything else except mock data) and the data commit (`server/src/data/mockData/products.js`, `stores.js`, `client/public/mock/`), each with `T0` in its message. This task is the one exception to one commit per task. Do not edit any code. Do not deploy.
**Verify:** `git status` is clean apart from later edits to protocol files. Server tests, client tests and client build all pass.

### C3: Guard seeding
**Problem:** `server/scripts/seedDummyProfiles.js:718-724` upserts into whichever database `MONGO_URI` names and overwrites `store_0103`. It also rewrites source files at `:691-700`. `server/src/db/connection.js:16-20` reloads demo data whenever `stores` is empty, and fails if `products` already has those IDs.
**Fix:** Move the seed routine behind a direct-run check so importing the file has no effect. Refuse to run when `NODE_ENV=production`, or unless `ALLOW_SEED=true` is set. Remove the startup auto-seed from `connectDB`, or allow it only when `NODE_ENV` is `development` and `ALLOW_SEED=true`. Add `ALLOW_SEED` to both `.env.example` files.
**Verify:** A test shows the guard refuses without the flag and in production. Server tests pass. Do not run the seed against any remote database.

### A1: Admin authentication
**Problem:** There is no authentication anywhere. The server has no JWT, session or password code.
**Fix:** Add an `admins` record, created only by a documented local script that reads credentials from the environment and has no HTTP route. Add `POST /api/admin/auth/login` (password, then send a 6-digit code), `POST /api/admin/auth/verify` and `POST /api/admin/auth/logout`. The verify step must require a short-lived, single-use token from a successful password step. Hash passwords with a maintained library, store codes hashed, expire them in 10 minutes, and limit attempts. Set an httpOnly, Secure (in production), SameSite=Lax cookie for a 1-hour session that renews while active. Export `requireAdmin` middleware. Send email through a provider interface: the development implementation logs the code, and production must fail closed if none is configured. Require a signing secret from the environment, and refuse to start without one. Do not apply the middleware to existing routes here, that is `C1`.
**Verify:** Tests cover a correct login, a wrong password, a wrong or expired code, too many attempts, and calling verify without the password step (must be rejected).

### A2: Vendor phone OTP authentication
**Problem:** Vendors have no accounts or sessions, and nothing links a person to a store.
**Fix:** Add `POST /api/vendor/auth/request-otp`, `verify-otp` and `logout`. Normalise phone numbers to E.164. Store codes hashed with a 5-minute expiry, one use, and limits per phone and per IP. Add a vendor record linking a phone to a `storeId`, with a status of `pending`, `approved` or `removed`. Only approved vendors get access to a store. Set a separate httpOnly cookie. Export `requireVendor` and `requireStoreOwner` middleware, which resolves `:storeId` by ID, slug or subdomain and compares it to the vendor's store. Admins pass `requireStoreOwner` only if `A3` needs it, otherwise they don't. Send SMS through a provider interface with the same fail-closed rule as `A1`. Do not trust a store's public `contact.phone` as proof of ownership.
**Verify:** Tests cover success, wrong and expired codes, reused codes, attempt limits, an unapproved vendor, and a vendor requesting another store (403).

### C1: Protect vendor and admin routes
**Problem:** `server/src/routes/routes.index.js:45-59` exposes every vendor and admin action without login. For example, `vendorCatalogController.js:97` lets anyone change a store's WhatsApp number.
**Fix:** Apply `requireAdmin` to every `/admin/*` route, and `requireVendor` plus `requireStoreOwner` to every `/vendor/store/:storeId*` route. `/subscription/plans` stays public. Update `client` fetch calls and add login screens for both roles, with redirects on 401. Client changes must use the same-origin `/api` path so cookies work.
**Verify:** A table-driven test requests each protected route with no cookie (401), the wrong role (401 or 403) and another vendor's cookie (403). Add the route test to `server/tests`. Server tests, client tests and client build pass.

### C2: Remove public admin and demo UI
**Problem:** "Renew / Upgrade Plan" calls the admin route directly (`client/src/components/vendor/subscriptionManager.jsx:267`). The Admin Desk toggle is shown to vendors (`:274`, `:319-404`). `client/src/routes/AppRoutes.jsx:33-38` serves `/admin` on tenant subdomains, and `:64-75` on the marketplace. `client/src/pages/vendorDashboard.jsx:28,56-62,302-320` defaults to `store_0103` and lets visitors switch stores.
**Fix:** Vendor renew buttons open the existing plan request modal. Move admin actions to a separate admin area, available only after admin login, and not on tenant subdomains. Build its screens for the moderation role in `CLAUDE.md`: subscription requests, renew and discontinue. The dashboard takes the store from the session. Remove the demo switcher, the `store_0103` default and the "Test Live Lifecycle" wording.
**Verify:** Client tests and build pass. Search confirms that vendor components contain no `/api/admin/` calls and that the build has no `store_0103`. Describe any manual browser checks in `HANDOFF.md`, or list them as not verified.

### H1: Scope product writes to the store
**Problem:** `updateVendorProduct` (`vendorCatalogController.js:232,261-264`) and `deleteVendorProduct` (`:285-288`) ignore `storeId`. `...updates` at `:238-241` accepts any field, including `storeId` and `_id`.
**Fix:** Resolve the store from `:storeId`, and match on both `_id` and `storeId` in every read and write. Use an explicit allowlist of editable fields. Return 404 for a product in another store.
**Verify:** Tests show store A can't edit or delete store B's product, and that `storeId`, `_id` and `createdAt` in the body are ignored.

### H4: Hide soft-deleted products in feeds
**Problem:** `filterProductsByActiveStores` (`server/src/services/catalogVisibility.js:53-56`) keeps products with `isActive: false`. Listing (`productController.js:21`) and search (`globalSearchController.js:14`) rely on it.
**Fix:** Exclude inactive products in the filter. Update tests that expected otherwise only if they contradict this rule, and explain any such change in `HANDOFF.md`.
**Verify:** A new test shows an inactive product under an active store is not returned.

### H5: Enforce visibility on direct pages
**Problem:** `productPageController.js:13-31` serves inactive products and products of expired stores. `storePageController.js:54-57` returns products for expired stores, and only the UI hides them (`client/src/pages/store.jsx:347`).
**Fix:** The product page returns 404 for an inactive product, or a store that is inactive or expired. The store page keeps store details and returns no products when the subscription is inactive.
**Verify:** Controller tests cover all of these cases. Existing tests still pass.

### H6: Fix subscription approval logic
**Problem:** In `subscriptionController.js`: approving doesn't check that a request is `pending` (`:252-264`), `durationDays` isn't validated (`:242`, `:337`), an unknown plan falls back to the ₹1,200 plan (`:155`, `:266`, `:349`), and early renewal discards remaining days (`:268`, `:351`).
**Fix:** Atomically change requests from `pending` only, and return 409 otherwise. Accept an integer duration from 1 to 366. Return 400 for an unknown plan. Extend from the later of now and the current expiry. Prevent duplicate pending requests for a store. Set `maxImagesPerProduct` in `adminDirectRenew` too (missing at `:363`).
**Verify:** Tests cover double approval, approving a rejected request, bad durations, unknown plans, and early renewal adding time.

### H3: Fix tenant detection on platform hosts
**Problem:** `getTenantSubdomain("bharat-shoppy-client.vercel.app")` returns `bharat-shoppy-client` (`client/src/lib/domainUtils.js:76-83`). `server/src/lib/domainHelper.js:57-68` has the same logic.
**Fix:** Treat only known base domains as tenant hosts: `bharatshopy.com`, plus `localhost` and `lvh.me` for development. Everything else, including `*.vercel.app`, is the marketplace. Keep the client and server rules matching.
**Verify:** Tests cover `vastra.bharatshopy.com` (tenant), `www.bharatshopy.com` and `bharatshopy.com` (none), and `bharat-shoppy-client.vercel.app` (none). Note in `HANDOFF.md` any existing test expecting Vercel subdomains to be tenants, and stop to ask rather than deleting it.

### H2: Move images to Cloudinary
**Problem:** `productUploadModal.jsx:134-146` sends base64 images in JSON. `server/src/index.js` keeps the default 100 KB limit: a local test returned 200 at 90 KB and 413 at 150 KB. Raising the limit would store large images in product records and inflate every response.
**Fix:**
1. Add `POST /api/vendor/store/:storeId/media/sign`, behind `requireVendor` and `requireStoreOwner`, returning a signed Cloudinary upload for the folder `bharatshopy/<store._id>`, limited to JPEG, PNG and WebP and a 5 MB maximum. `CLOUDINARY_API_SECRET` stays on the server. Fail closed if Cloudinary isn't configured. Add the three variables to both `.env.example` files.
2. Change the form to compress as it does now, upload directly to Cloudinary, then submit the returned details. Show upload progress and a clear error on failure. Saving must wait until uploads finish.
3. Keep `images` as an array of URL strings, so public pages and existing demo data keep working. Add `imageAssets`, an array of `{ url, publicId }`, for uploaded photos.
4. On add and edit, the server accepts only URLs from `https://res.cloudinary.com/<cloud name>/` with a `publicId` in that store's folder, plus URLs already on the product. Reject `data:` values and anything else with 400. Enforce the plan's `maxImagesPerProduct` on the server, and use it in the form in place of the fixed 6.
5. When a vendor removes a photo from a product, delete it from Cloudinary after the save succeeds. Log a failed delete without failing the save. Soft-deleting a product keeps its photos. Export a helper that `A4` can use to delete a store's media.
6. Make the Remove and Cover buttons usable on touchscreens: they only appear on hover (`productUploadModal.jsx:433`).
7. Report any other base64 upload you find in `HANDOFF.md`. Don't raise the JSON body limit.
**Verify:** Tests use a fake Cloudinary client to cover: signing requires login and store ownership, another vendor gets 403, missing configuration fails closed, foreign URLs and other stores' `publicId` values are rejected, `data:` is rejected, the plan's image limit applies, removed photos are deleted, and old string-only products still display and save. Client tests, lint and build pass. List real-phone and real-Cloudinary checks you did not run. Do not use a production Cloudinary account without the owner's approval.

### H7: Update vulnerable dependencies
**Problem:** `npm audit --omit=dev` shows 6 vulnerabilities in the server and 21 in the client, each with 1 critical. `nodemon` is in server `dependencies`, and `shadcn` is in client `dependencies`.
**Fix:** Run `npm audit fix` without `--force` in each package. Move `nodemon` to dev dependencies. Check whether `shadcn` is used at runtime, and move it to dev dependencies if not. Record the remaining advisories and do not apply breaking upgrades without asking.
**Verify:** Paste before and after audit totals. All tests, lint and build pass.

### H8: Rate limits, headers, CORS, health check
**Problem:** `isOriginAllowed` always returns true (`server/src/index.js:21`, and `:30` also allows on failure), with `credentials: true`. `CLIENT_URL` is unused. `dev.index.js` has the same code. There's no rate limiting, security headers or health check. The repo has no backup setup.
**Fix:** Share one app setup between `index.js` and `dev.index.js`. Allow only `CLIENT_URL`, `https://bharatshopy.com`, its subdomains, and localhost and `lvh.me` outside production. Add `helmet`, rate limits on search and writes, and `GET /api/health`. Add a short `docs/operations.md` listing the backup steps the owner must confirm in Atlas. Do not claim backups exist.
**Verify:** Tests cover an allowed origin, a rejected origin, and the health route.

### A3: Vendor application and approval flow
**Problem:** There's no way for a real vendor to join, and no admin screen to approve one.
**Fix:** An email-verified applicant submits store details and is saved as `pending`. Admins can list, approve (creates the store and links the vendor, on `starter_free`) and reject (with a reason). Check that slugs and subdomains are unique and not reserved. Notify through the provider interfaces.
**Verify:** Tests cover apply, duplicate apply, approve, reject, reserved subdomains, and that a pending vendor can't reach store routes.

### A4: Vendor removal with 7-day hold
**Problem:** There's no vendor removal flow.
**Fix:** An admin action sets `removed` with a `deleteAfter` 7 days away and hides listings immediately. Admins can cancel during the hold. A secured Vercel cron then permanently deletes the profile, listings and media. Log each deletion without personal data.
**Verify:** Tests use injected time to cover hiding, cancelling, deletion after the hold, and no deletion before it. Run only against local or test data.

### M1: Validate write input
**Problem:** `vendorCatalogController.js:66-101,125-140` doesn't check field types, price or image count. `.trim()` on non-strings causes a 500. A non-string WhatsApp value would likely crash `client/src/pages/store.jsx:365`. The client allows 6 images, while plans promise 5, 8 or 12 (`subscriptionPlans.js:16,36,58`).
**Fix:** Validate profile and product bodies on the server, returning 400 with a clear message. Prices must be above 0, with `max` at or above `min`. Enforce the plan's image limit on the server, and use it in the client. Allowlist `entityType`. Validate phone format.
**Verify:** Tests cover each rejected case and a valid request.

### M2: Correct quota behaviour
**Problem:** `vendorCatalogController.js:161` counts deactivated items, and reactivating through `:238` skips the limit. `subscriptionController.js:91` and `client/src/pages/vendorDashboard.jsx:213` count the same way. The UI says "Monthly" (`subscriptionManager.jsx:288`).
**Fix:** Count only active items everywhere. Check the limit when reactivating. Change the wording to total catalog items. Leave the `productMonthlyLimit` field name in place unless you get a migration task.
**Verify:** Tests cover deactivate-then-add, reactivating at the limit, and the usage numbers.

### M3: Query only the data needed
**Problem:** Controllers load whole collections per request, for example `productController.js:10-11` and `vendorCatalogController.js:15`.
**Fix:** Use MongoDB filters, projections, `skip`/`limit` and counts. Add indexes on `products.storeId`, `stores.slug` and `stores.subdomain` through a documented script. Keep response shapes and case-insensitive store lookups.
**Verify:** Existing response tests pass. Note anything not tested against real MongoDB.

### M4: Reliable startup and location seeding
**Problem:** Without `MONGO_URI` the server starts and database routes then fail (`connection.js:7-10`). `process.exit(1)` at `:24` is unsuitable for serverless. Locations are never seeded, so location search is empty on a fresh database.
**Fix:** Fail clearly at startup in production when `MONGO_URI` is missing. Return 503 from database routes when disconnected. Add `locations` to the guarded development seed from `C3`.
**Verify:** Tests cover the 503 response and the seed guard.

### M5: Stop returning internal error text
**Problem:** Handlers return `error.message` to clients, for example `vendorCatalogController.js:56`. Handlers without `try/catch` rely on Express's default error output.
**Fix:** Add one error middleware that logs details on the server and returns a generic message. Remove `error: error.message` from all responses.
**Verify:** A test forces an error and confirms the message isn't returned. Search finds no `error: error.message` in responses.

### M6: Remove misleading demo and plan claims
**Problem:** `seedDummyProfiles.js:52,101,150` contains made-up FSSAI, license and GSTIN numbers. Plans promise analytics, priority ranking and 24/7 support with no code behind them (`subscriptionPlans.js`). The UI calls every store verified (`client/src/pages/store.jsx`: "Verified Store on BharatShopy" and "verified merchant") and plans offer verified badges, but no verification process exists.
**Fix:** Remove from plan data and all UI text: analytics, priority or top ranking, 24/7 or priority support, and verified badges. Keep only features the code delivers, such as item and photo limits. Remove the badge and "verified" wording from store pages and emails. Remove the made-up FSSAI, license and GSTIN numbers from the seed script and mock data, and don't show those fields when empty. Search the client, server and emails for other claims the code doesn't deliver, such as guarantees, and list them in `HANDOFF.md` rather than inventing replacements. Don't change plan prices or limits.
**Verify:** A test shows no plan feature contains the removed claims. A case-insensitive search of `client/src` and `server/src` for `analytics`, `priority`, `24/7`, `verified`, `fssai` and `gstin` returns only code unrelated to these claims, listed in `HANDOFF.md`. Server tests, client tests, lint and build pass.

### M7: Add legal pages
**Problem:** The client has no privacy, terms, refund or grievance content.
**Fix:** Blocked until the owner supplies reviewed text. Do not write legal text yourself.
**Verify:** To be specified on assignment.

### M8: Fix missing product images
**Problem:** 1,205 of the 1,207 local image paths in `server/src/data/mockData/` don't exist in `client/public`.
**Fix:** Do not invent images. Make public pages show the entity fallback whenever an image fails or is missing, using `client/src/lib/imageFallback.js`. Report any page that doesn't.
**Verify:** Tests where practical. Client build passes. List browser checks you did not run.

### L1: Accessibility fixes
**Problem:** Entity cards are clickable `div`s (`vendorDashboard.jsx:615`). `vendorDashboard.jsx` and `subscriptionManager.jsx` have no `aria-` attributes. Icon buttons rely on `title`. `client/index.html` has no meta description.
**Fix:** Use real buttons or radios, label icon buttons, give modals dialog roles and keyboard closing, and add a meta description.
**Verify:** Lint, tests and build pass. List keyboard and screen reader checks you did not run.

### L2: Domain and branding cleanup
**Problem:** The code mixes BharatShoppy, BharatShopy, `bharatshopee.com` and `bharatshoppy.com`, for example `client/index.html:6`, `domainUtils.js:135`, `vendorDashboard.jsx:671`, `subscriptionPlans.js:62` and `enquiryMessage.js:12`.
**Fix:** Change every displayed name to `BharatShopy`, including page titles, UI text, WhatsApp messages, plan text, meta tags and the store data shown to users. Change every product domain to `bharatshopy.com`, including tenant links, CORS rules and reserved subdomain lists. Do not rename things that are not displayed and would break if changed: the deployed host `bharat-shoppy-server.vercel.app` in `client/vercel.json`, the repo folder and database names. List any you leave in `HANDOFF.md`. Update tests that assert the old spellings to assert the new ones, without weakening them.
**Verify:** A case-insensitive search for `bharatshoppy`, `bharatshopee` and `bharat shoppy` returns only the items listed in `HANDOFF.md`. Server tests, client tests, lint and build pass.

### L3: Restrict the `?tenant=` override
**Problem:** `domainUtils.js:35-41` honours `?tenant=` in production, although it's meant for local testing.
**Fix:** Honour it only in development builds or on `localhost` and `lvh.me`.
**Verify:** Tests cover the production and development cases.
