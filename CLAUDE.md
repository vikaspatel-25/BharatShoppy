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
- **Vendor accounts:** phone OTP sign-up and login. An admin approves a vendor before they can go live. No self-service activation.
- **Admin account:** one admin record and no admin sign-up page. Login is password plus a 6-digit code sent to the admin email, which creates an httpOnly cookie. The session lasts 1 hour by default and renews while active. The code step must require a completed password step.
- **Admin role:** moderation and management only. Admins do not add or edit products from the admin area.
- **Payments:** manual. The vendor requests a plan and pays offline, then an admin activates it. No gateway for now. Only an admin can activate or renew.
- **Quota:** a plan limits total active items. Deactivated items do not count. It never resets monthly.
- **Listings:** go live instantly while the subscription is active.
- **Expired stores:** the store page stays visible with WhatsApp contact, products are hidden, and no data is deleted.
- **Deleting a product:** the vendor action stays a soft delete (`isActive: false`).
- **Vendor removal:** a 7-day hold with listings hidden, then permanent deletion of the profile, listings and media.
- **Demo data:** all stores sharing one phone number, and the made-up demo store details, are acceptable only as demo data. See `M6` for what must happen before real launch.

## Open questions for the owner
- `Q2`: SMS provider for vendor OTP and email provider for the admin code. `A1` and `A2` are built behind provider interfaces, but real login in production needs these chosen.
- `Q3`: Should paid plans keep promising analytics, priority ranking and 24/7 support? Blocks `M6`.

## Status
Statuses: `TODO`, `IN PROGRESS`, `IN REVIEW`, `CHANGES REQUESTED`, `DONE`, `BLOCKED`.

| ID | Priority | Task | Depends on | Status | Notes |
|---|---|---|---|---|---|
| T0 | P0 | Commit uncommitted work as a baseline | none | TODO | Batch 1 |
| C3 | P0 | Guard seeding and auto-seeding | T0 | TODO | Batch 1 |
| A1 | P0 | Admin authentication | T0 | TODO | Batch 1 |
| A2 | P0 | Vendor phone OTP authentication | T0 | TODO | Batch 1 |
| C1 | P0 | Protect vendor and admin routes | A1, A2 | TODO | Batch 1 |
| C2 | P0 | Remove public admin and demo UI | C1 | TODO | Batch 1 |
| H1 | P1 | Scope product writes to the store | C1 | TODO | Batch 1 |
| H4 | P1 | Hide soft-deleted products in feeds | T0 | TODO | |
| H5 | P1 | Enforce visibility on direct pages | T0 | TODO | |
| H6 | P1 | Fix subscription approval logic | C1 | TODO | |
| H3 | P1 | Fix tenant detection on platform hosts | T0 | TODO | |
| H2 | P1 | Move images out of JSON and MongoDB | C1 | BLOCKED | Needs a storage choice from the owner when assigned |
| H7 | P1 | Update vulnerable dependencies | T0 | TODO | |
| H8 | P1 | Add rate limits, headers, CORS, health check | C1 | TODO | |
| A3 | P1 | Vendor application and approval flow | A1, A2 | TODO | |
| A4 | P2 | Vendor removal with 7-day hold | A3 | TODO | Needs a scheduled job design |
| M1 | P2 | Validate write input | C1 | TODO | |
| M2 | P2 | Correct quota behaviour | H1 | TODO | |
| M3 | P2 | Query only the data needed | H4, H5 | TODO | |
| M4 | P2 | Make startup and location seeding reliable | C3 | TODO | |
| M5 | P2 | Stop returning internal error text | T0 | TODO | |
| M6 | P2 | Remove misleading demo and plan claims | Q3 | BLOCKED | Waiting on `Q3` |
| M7 | P2 | Add legal pages | owner text | BLOCKED | Needs reviewed legal text from the owner |
| M8 | P3 | Fix missing product images | T0 | TODO | |
| L1 | P3 | Accessibility fixes | C2 | TODO | |
| L2 | P1 | Name and domain cleanup | H1 | TODO | Batch 1, owner decision |
| L3 | P3 | Restrict the `?tenant=` override to development | H3 | TODO | |

Line numbers refer to the uncommitted working tree at audit time. If they have moved, find the code by name.

## Task prompts

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

### H2: Move images out of JSON and MongoDB
**Problem:** `productUploadModal.jsx:134-146` sends base64 images in JSON. `server/src/index.js:36` keeps the default 100 KB limit: a local test returned 200 at 90 KB and 413 at 150 KB. Raising the limit would store large images in product records and inflate every response.
**Fix:** Waiting on the owner's storage choice. Claude will complete this prompt when assigning it.
**Verify:** To be specified on assignment.

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
**Fix:** A phone-verified applicant submits store details and is saved as `pending`. Admins can list, approve (creates the store and links the vendor, on `starter_free`) and reject (with a reason). Check that slugs and subdomains are unique and not reserved. Notify through the provider interfaces.
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
**Problem:** `seedDummyProfiles.js:52,101,150` contains made-up FSSAI, license and GSTIN numbers. Plans promise analytics and priority ranking with no code behind them (`subscriptionPlans.js:39,61,65`).
**Fix:** Blocked on `Q3`. Claude will complete this prompt when assigning it.
**Verify:** To be specified on assignment.

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
