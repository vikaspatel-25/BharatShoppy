# BharatShoppy: Project Protocol

Current phase: PANELS

## Project summary
A local marketplace where shopkeepers, farmers and service providers list items. Customers browse and send enquiries over WhatsApp. Each store can also have its own subdomain storefront.

- `client/`: React 19, Vite, Tailwind. Deployed on Vercel.
- `server/`: Express 5, MongoDB through the native collections on `mongoose.connection.db`. Deployed on Vercel as `bharat-shoppy-server.vercel.app`.
- `client/vercel.json` rewrites `/api/*` to the server, so the browser sees the API as same-origin.
- CI: `.github/workflows/ci.yml`.
- Reference project for the panel rebuild: `C:\Users\VikasPatel\Desktop\myProjects\NBP_digitalCatalogue` (NetZeroMart), read-only. See "Panel rebuild".

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
- **Exception for the panel rebuild:** on 2026-11-12 the owner told Claude Code to implement tasks `P1` to `P9` itself, without stopping between tasks. For those tasks Claude Code is the implementer and follows the branching rule and the `HANDOFF.md` entry format. Nobody has reviewed that work, so its tasks stop at `IN REVIEW` until the owner or another reviewer checks them.

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

## Panel rebuild
Requested by the owner on 2026-11-12: study the admin panel and vendor portal of NetZeroMart (the reference project, called NBP below) and rebuild both BharatShopy panels the same way, adapted to this product. The current panels (`client/src/pages/AdminDashboard.jsx`, `client/src/pages/vendorDashboard.jsx`, `client/src/components/vendor/subscriptionManager.jsx`) are replaced, not restyled.

### How NBP is built
- **One shell for both panels:** `frontend/src/layouts/PanelLayout.jsx` takes a navigation config (groups of links with icons and count badges) and renders a fixed sidebar, a header that names the current page, a "View site" link and a sign-out button. On phones the sidebar becomes a drawer. `frontend/src/App.jsx` wraps each page in an admin or vendor layout, loads every page with `lazy`, and sets the browser tab title from the same navigation config.
- **One design system:** `design-system/theme.css` holds colour tokens and a small set of component classes (`card`, `btn`, `input`, `badge`, `notice`). `frontend/src/components/ui.jsx` holds the shared parts every page uses: `PageHeader`, `StatCard`, `EmptyState`, `LoadingState`, `Modal`, `Notice`, `StatusBadge`, `UsageBar`, `SearchInput`, `Field`, `FormSection`, `AuthLayout`. Pages contain almost no one-off styling.
- **One page per job, each with its own URL:** the admin has a dashboard, applications, vendor directory, plan requests, plans and limits, listing moderation and an audit log. The vendor has a dashboard, add and edit product pages, plan and usage, and company profile.
- **Tenant model:** NBP has no subdomains. Its tenant is the vendor account. Every listing carries the vendor's ID, every vendor request is scoped by the session, and the plan's limits are copied onto the vendor record when an admin activates the plan. Public visibility is computed from the vendor's status and plan expiry (`src/services/catalogVisibility.js`). BharatShopy already has the stronger model (a store per vendor with a slug and a subdomain, `requireStoreOwner`, `req.store`), so the tenant model is kept and only the parts below are added to it.
- **Admin workflow support on the server:** a vendor directory API that returns every vendor with a computed plan status and totals, a removal-impact count shown before a vendor is removed, an audit log of every admin action (`src/services/auditLogService.js`), admin notifications with a bell (`src/services/notificationService.js`), listing hide and restore with a reason (`src/controllers/moderation.js`), and plans stored in the database with an editor.

### What maps to what
| NBP | BharatShopy |
|---|---|
| `PanelLayout`, `ui.jsx`, `theme.css`, toast and error boundary | Same, in `client/src` (`P1`, `P5`) |
| Admin dashboard with counts and links | `/admin` (`P7`) |
| Applications (cards, approve, reject dialog) | `/admin/applications`, using the existing application routes (`P7`) |
| Vendor directory (status tabs, detail dialog, set or renew plan, end plan, reminder, remove with hold) | `/admin/vendors`. Replaces the "Direct Store Override" form, where the admin types a store ID (`P2`, `P7`) |
| Plan requests (status tabs, activate, decline) | `/admin/plan-requests` (`P7`) |
| Listing moderation (hide with a reason, restore) | `/admin/listings` (`P4`, `P7`) |
| Audit log and notification bell | `/admin/audit-log` and the panel header (`P3`, `P7`) |
| Plans and limits editor | `/admin/plans` (`P8`) |
| Vendor dashboard (banners, counts, usage, links) | `/vendor` (`P6`) |
| Add, edit and remove product pages | `/vendor/items`, `/vendor/items/new`, `/vendor/items/:productId` (`P6`) |
| Company profile | `/vendor/store` (`P6`) |
| Plan and usage | `/vendor/plan` (`P6`) |
| Onboarding page | A getting-started checklist on the vendor dashboard (`P6`) |
| Sign-in and registration pages on `AuthLayout` | `VendorLogin`, `AdminLogin`, `VendorApply` (`P9`) |

Not copied, because the product decisions above rule them out or the feature doesn't exist here: articles, the stored buyer inquiry inbox (enquiries go to WhatsApp and aren't saved), passwords and password change for vendors (login is by email code), registration documents and the partner declaration, admin add and edit of products, permanent product deletion, monthly quota resets, and vendor self-service account deletion (`Q7`).

### Panel decisions
Set by Claude on 2026-11-12 as defaults so work can start. The owner can change any of them.

- **Look:** NBP's layout, spacing and component set, with BharatShopy's own colours: orange as the brand colour (as the current vendor panel uses), blue for links and focus rings, `stone` neutrals, and the Geist font already installed. No NetZeroMart colours, logo, name or text. Both panels use the same light theme, so the dark admin theme goes (`Q6`).
- **Hosts:** the admin panel is served only on the marketplace host. The vendor portal is served at `/vendor/*` on the marketplace host and on the vendor's own subdomain. Session cookies stay host-only, as now.
- **Panel chrome:** the marketplace header isn't shown on panel or sign-in pages.
- **Plan status:** every screen and API computes it from the expiry date with one shared helper. A stored status alone is never shown.
- **Dates:** one format everywhere, such as "8 Nov 2026", in Indian time.
- **Listing moderation:** an admin can hide a listing with a reason and restore it. The vendor sees the reason and can't unhide it. This is separate from the vendor's own active and inactive switch. Admins still can't add or edit products.
- **Plans:** stored in the database and edited by the admin. A change applies to a store at its next activation or renewal, and current subscribers keep their limits until then. Plan text still can't promise anything that isn't built (`M6`).
- **Audit log:** every admin action that changes data is recorded, without codes, tokens, passwords or secrets.
- **Dialogs:** no `window.prompt`, `window.confirm` or `alert` anywhere in the panels.

### Lessons from NBP's own browser test
`design-audit/FINDINGS.md` in the reference project lists what broke there. These are requirements here:
1. A page must import every React hook it uses. NBP shipped a page that crashed on load without one. Port its test, `test/frontendHookImports.test.js`.
2. Error text passed to a toast or notice must be a string. An object from an upload error crashed a whole NBP page and lost the form.
3. After a save or an error, scroll the panel's `<main>` to the top. The panel scrolls inside `<main>`, so `window.scrollTo` alone does nothing.
4. Show a lasting notice on the page after a save, not only a toast that disappears.
5. Refresh the sidebar count badges on every page change, or they go stale after the admin clears a queue.
6. Show the plan's name, never its ID.
7. Keep long names readable: two lines with the full text in a `title`, never a single cut-off line with no way to read it.
8. Check the quota and plan status before any photo upload starts, so a refused save doesn't leave unused photos in Cloudinary.
9. Generate a plan's quota lines from its numbers. NBP's free-text feature list said 50 where the limit was 5.

## Open questions for the owner
- `Q2`: The owner must create a Gmail app password and set `GMAIL_USER`, `GMAIL_APP_PASSWORD` and `ADMIN_EMAIL`. Real login in production needs them.
- `Q4`: The owner must create a Cloudinary account and set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`. Real uploads in production need them.
- `Q5`: The owner must set `CRON_SECRET` in Vercel for the server project. Permanent deletion of removed vendors after the 7-day hold needs it.
- `Q6`: Panel colours. The default is BharatShopy orange with a light theme for both panels. Say so if you want NetZeroMart's green and blue, or another palette.
- `Q7`: NBP lets a vendor request deletion of their own account. It isn't built here, because vendor removal was decided as an admin action. Say so if vendors should be able to request it.
- `Q8`: NBP saves every buyer inquiry and shows an inbox in both panels. Here enquiries go straight to WhatsApp and nothing is saved, so there's no inbox. Building one means saving customer details, which needs your decision and the legal pages (`M7`).

## Status
Statuses: `TODO`, `IN PROGRESS`, `IN REVIEW`, `CHANGES REQUESTED`, `DONE`, `BLOCKED`.

| ID | Priority | Task | Depends on | Status | Notes |
|---|---|---|---|---|---|
| P1 | P1 | Panel design system and shared UI | none | TODO | Batch 8 |
| P2 | P1 | Panel data APIs and one plan-status rule | none | TODO | Batch 8 |
| P3 | P1 | Admin audit log and notifications | P2 | TODO | Batch 8 |
| P4 | P1 | Listing moderation: hide and restore | P3 | TODO | Batch 8 |
| P5 | P1 | Panel shell, routes and session guards | P1, P2 | TODO | Batch 9 |
| P6 | P1 | Vendor portal pages | P5, P4 | TODO | Batch 9 |
| P7 | P1 | Admin panel pages | P5, P3, P4 | TODO | Batch 9 |
| P9 | P3 | Sign-in and application pages on the shared layout | P5 | TODO | Batch 9 |
| P8 | P2 | Plans in the database and the plan editor | P7 | TODO | Batch 10 |
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

Tasks `P1` to `P9` are the panel rebuild. Read "Panel rebuild" above first. Paths that start with `frontend/`, `design-system/` or `src/` are in the reference project. Read them for structure and behaviour, then write BharatShopy's own version: don't copy NetZeroMart's name, logo, colours, wording or features that the "Not copied" list rules out.

### P1: Panel design system and shared UI
**Problem:** The two panels share nothing. `AdminDashboard.jsx` is a dark slate theme, `vendorDashboard.jsx` is light with orange, and each repeats its own buttons, inputs, alerts and tables inline with 11px and 12px text. There are no shared form, dialog, empty-state or loading parts, no toast, and no error boundary, so a render error blanks the whole app.
**Fix:**
1. Add `client/src/styles/panelTheme.css`, modelled on `design-system/theme.css`, and import it from `client/src/App.css`. Define a `brand` scale from Tailwind's orange values and keep the blue `ocean` scale for links and focus rings. Keep the card radius and the two shadows. Add the component classes `card`, `card-body`, `btn` with its `sm`, `lg`, `primary`, `secondary`, `ghost` and `danger` variants, `link`, `field-label`, `field-hint`, `field-error`, `input`, `input-invalid`, `checkbox`, `badge` with its variants, and `notice` with its four tones. Use the Geist font already installed, and don't load a font from a network. Don't copy the `body`, heading or selection rules from the base layer, because they would restyle the public pages.
2. A search on 2026-11-12 found no existing use of these class names in `client/src`. Search again before adding them, and stop and report if any public markup uses one.
3. Add `client/src/components/panel/ui.jsx` with `Field`, `inputClass`, `FormSection`, `Notice`, `Modal`, `PageHeader`, `StatCard`, `EmptyState`, `LoadingState`, `UsageBar`, `StatusBadge`, `SearchInput`, `BrandMark` and `AuthLayout`, modelled on `frontend/src/components/ui.jsx`. Changes from the reference: `Modal` closes on Escape, moves focus into the dialog when it opens and returns it on close; `UsageBar` says how many are left without "this month", because the quota never resets; `BrandMark` shows the text `BharatShopy` and uses no NetZeroMart asset.
4. Add `client/src/context/ToastContext.jsx` and `client/src/components/ErrorBoundary.jsx`, modelled on the reference files. A toast must render a non-string message safely.
5. Add `client/src/lib/formatDate.js` with `formatDisplayDate` ("8 Nov 2026", Indian time) and `getTodayIstDateString`, and `client/src/lib/scrollPanel.js` with `scrollToTop`, which also scrolls the panel's `<main>`.
6. Add `client/tests/hookImports.test.js`, ported from `test/frontendHookImports.test.js`, covering `client/src/pages`, `client/src/components`, `client/src/layouts` and `client/src/context`.
7. Don't change any existing page in this task.
**Verify:** Tests cover `formatDisplayDate` (a date near midnight UTC shows the Indian date, and an invalid value returns an empty string) and the hook-import check. Client tests, lint and build pass. The built CSS contains the new classes. List the browser checks you didn't run.

### P2: Panel data APIs and one plan-status rule
**Problem:** The admin has no list of stores or vendors. To renew, end or remind, the admin types a store ID into a form (`AdminDashboard.jsx:599-686`). There's no count of anything for a dashboard, and no way for the client to ask whether an admin session exists. Plan status is worked out in three places that disagree: `catalogVisibility.js:13-40`, `getStoreSubscriptionInfo` (`subscriptionController.js:69-156`), and the client (`vendorDashboard.jsx:229-231`). `getStoreSubscriptionInfo` invents an active `yearly_standard` plan ending a year from now for any store with no subscription record (`:82-87`), and falls back to the ₹1,200 plan for an unknown plan ID (`:133`).
**Fix:**
1. Add `server/src/services/subscriptionStatus.js` with one function that takes a store and the current time and returns `computedStatus` (`active`, `expired`, `none` or `removal_hold`), `remainingDays`, `isExpiringSoon` (active with 30 days or fewer left) and `expiresAt`. Use it in `catalogVisibility.js`, `getStoreSubscriptionInfo` and the new routes below. Keep the existing public visibility rules exactly, including the one for stores with no subscription record, and add a test that pins them.
2. In `getStoreSubscriptionInfo`, stop inventing a subscription. For a store with no record, return what the helper computes and no made-up dates. For an unknown plan ID, return the ID with no plan details instead of another plan's.
3. Add `GET /api/admin/auth/me`, behind `requireAdmin`, returning the admin's email and nothing secret.
4. Add `GET /api/admin/vendors`, behind `requireAdmin`. Each row joins a store with its vendor: `vendorId`, `storeId`, store name, slug, subdomain, entity type, city, vendor email, contact phone, plan ID and plan name, the helper's fields, the removal state with days left in the hold, and the count of active items. Support `search` (store name, slug, email), `status` (the computed status, plus `expiring`), `skip` and `limit` with a maximum. Also return totals per status for the tabs, computed over all stores, not only the page returned. Use projections and counts as `M3` required, not whole collections per row.
5. Add `GET /api/admin/vendors/:vendorId/removal-impact`, returning the store name and the counts of items and photos that removal would delete.
6. Add `GET /api/admin/overview`, returning: applications waiting, plan requests waiting, stores per computed status, and active items.
7. In `getAdminPaymentRequests` (`subscriptionController.js:253-287`), also return the vendor's email and the totals per status.
8. Add the new routes to the table-driven test in `server/tests/protectedRoutes.test.js`.
**Verify:** Tests cover: the helper for active, expiring, expired, no record and removal hold, using injected time; a store whose stored status is `active` but whose expiry has passed is listed as expired; the directory search, status filter, page limit and totals; the removal-impact counts; no invented subscription for a store without one; every new route returning 401 without a cookie and rejecting a vendor cookie. Existing tests pass unchanged, apart from any that asserted the invented subscription: list those in `HANDOFF.md` with the reason.

### P3: Admin audit log and notifications
**Problem:** Nothing records who approved, rejected, renewed, ended or removed what. The admin learns of a new application or plan request only from email, which `E1` allows to fail without losing the record.
**Fix:**
1. Add `server/src/services/auditLogService.js` with `logAdminAction({ req, action, targetType, targetId, targetName, details })`, modelled on `src/services/auditLogService.js`. It writes to an `admin_audit_log` collection: the admin's ID and email, the action, the target, a details object, the client IP read the way the rate limiter reads it, and the time. Drop any details key containing `password`, `token`, `secret`, `code`, `otp`, `cookie` or `hash`, and cut strings longer than 500 characters. A logging failure must never fail the request: catch it and log it on the server. Await the write, as Vercel can stop background work.
2. Call it after each successful admin change: approve and reject application, approve and reject plan request, direct renew, discontinue, send renewal reminder, remove vendor and cancel removal. `P4` and `P8` add their own calls.
3. Add `GET /api/admin/audit-log`, behind `requireAdmin`, newest first, with `page`, a capped `limit`, and filters for `action`, `targetType` and a text search on the target name.
4. Add `server/src/services/notificationService.js` and an `admin_notifications` collection, modelled on `src/services/notificationService.js`. Create a notification when a vendor application is submitted, when a plan request is submitted, and when a vendor changes the store name. Each has a type, title, message, and a link to the admin page that handles it. Failure to create one must not fail the request.
5. Add `GET /api/admin/notifications` (latest 20 by default, plus the unread count) and `POST /api/admin/notifications/mark-read` (one ID or all), behind `requireAdmin`. Validate the ID.
6. Add both collections' indexes to `server/scripts/createIndexes.js`: by time, and for notifications by read state. Document them in `docs/operations.md`.
**Verify:** Tests cover: each listed admin action writing one entry with the right action and target; a failed action writing none; a details key named `code` being dropped; a logging failure not failing the request; the log route's paging and filters; notifications created by the three events; mark one and mark all; every new route returning 401 without a cookie and rejecting a vendor cookie. Mark as not verified anything that needs real MongoDB.

### P4: Listing moderation: hide and restore
**Problem:** The admin can't see listings at all, and the only way to take down a bad listing is to remove the whole vendor.
**Fix:**
1. Add `GET /api/admin/listings`, behind `requireAdmin`: items across all stores with the item name, first photo, price, store name and slug, the vendor's active flag, and the moderation state. Support `search` (item or store name), `storeId`, `state` (`visible`, `hidden`), `skip` and a capped `limit`, and return the total.
2. Add `POST /api/admin/listings/:productId/hide`, with a required `reason` of 5 to 500 characters, and `POST /api/admin/listings/:productId/restore`. Store the state on the product as `moderation: { status: "hidden", reason, hiddenAt }`, separate from `isActive`. Restore clears it. Hiding a hidden item or restoring a visible one returns 409.
3. Exclude hidden items everywhere the public can see items: `filterProductsByActiveStores`, the product page (404), the store page, store product search and global search. Put the rule in one place in `catalogVisibility.js`.
4. Return `moderation` to the vendor in `getVendorDashboardData`. Remove `moderation` from anything a vendor can write: it must not be in the `H1` allowlist, and a vendor's update or reactivation must not clear it.
5. A hidden item keeps counting toward the quota while the vendor leaves it active. Don't change the quota rule.
6. Email the vendor the item name and the reason through `emailService.js`, escaped as `R2` item 10 requires, and awaited. If the email fails, keep the change and return a warning. Log both actions with `logAdminAction`.
7. Admins still can't add, edit or delete products.
**Verify:** Tests cover: a hidden item missing from the feed, global search, store search and the store page, and returning 404 on its product page; restore bringing it back; a vendor update with `moderation` in the body leaving it hidden; a missing or short reason returning 400; hiding twice returning 409; a failed email keeping the change with a warning; HTML in the reason escaped in the email; the list route's filters; every route returning 401 without a cookie and rejecting a vendor cookie; an audit entry for each action.

### P5: Panel shell, routes and session guards
**Problem:** Each panel is one page with tabs held in component state (`vendorDashboard.jsx:33`, `AdminDashboard.jsx:20`), so no screen has its own URL, the back button leaves the panel, and a refresh always returns to the first tab. `AppRoutes.jsx:47-69` renders the marketplace header above `/vendor` and `/admin`. Every page is imported up front (`AppRoutes.jsx:3-11`), so shoppers download both panels. `/admin/:storeId` is a leftover route.
**Fix:**
1. Add `client/src/layouts/PanelLayout.jsx`, modelled on `frontend/src/layouts/PanelLayout.jsx`: navigation groups with icons and count badges, `aria-current` on the active link, a drawer on small screens that closes after navigating, a header that names the current page, and a slot for header extras. Use the `overflow-clip` container and the `relative` `<main>` the reference uses, for the reasons in its comments. Sign-out calls the existing logout route with `apiFetch` and then goes to the sign-in page. For the vendor, the header links to the vendor's own storefront. For the admin, it links to the marketplace.
2. Vendor routes, on the marketplace host and on tenant subdomains: `/vendor` (dashboard), `/vendor/items`, `/vendor/items/new`, `/vendor/items/:productId`, `/vendor/store`, `/vendor/plan`. Redirect `/manage` to `/vendor`. Admin routes, on the marketplace host only: `/admin`, `/admin/applications`, `/admin/vendors`, `/admin/plan-requests`, `/admin/listings`, `/admin/audit-log`. Remove `/admin/:storeId`. On a tenant subdomain, `/admin` paths keep falling through to the storefront.
3. Add a vendor session provider that calls `/api/vendor/auth/me` once, exposes the vendor and `storeId` to every vendor page, shows `LoadingState` while it waits, and sends a signed-out visitor to `/vendor/login`. Add the same for the admin with `/api/admin/auth/me` and `/admin/login`.
4. Don't render the marketplace header on panel routes or on the sign-in and application pages.
5. Load every panel page and the public pages with `lazy` inside a `Suspense` with `LoadingState`. Wrap the app in `ErrorBoundary` and `ToastProvider`.
6. Set the browser tab title on each route from the navigation config, in the form "Items · Vendor portal | BharatShopy".
7. In this task the new routes may render placeholder pages that show only a `PageHeader`. `P6` and `P7` fill them. Keep the old `/vendor` and `/admin` pages working at their paths until then, so the app is never without a panel.
**Verify:** Tests cover the route table in the style of `client/tests/domainRouting.test.js`: tenant hosts serve vendor routes and no admin route; the marketplace serves both. Client tests, lint and build pass, and the build output has separate chunks for panel pages. List the browser checks you didn't run: drawer on a phone, keyboard use of the sidebar, back button, refresh on a deep link.

### P6: Vendor portal pages
**Problem:** The vendor portal is one 926-line page. Adding an item is a modal (`productUploadModal.jsx`, 987 lines) that loses everything if it closes. The dashboard shows no plan name, status or expiry. Text is 11px and 12px on a phone, where most vendors will use it. The profile form has no field errors.
**Fix:** Build these pages on `PanelLayout` and the `P1` parts, then delete `vendorDashboard.jsx`, `subscriptionManager.jsx` and `productUploadModal.jsx`. Every page takes the store from the session provider.
1. **Dashboard (`/vendor`)**, modelled on `frontend/src/pages/VendorDashboard.jsx`: a banner when the plan has ended, when 30 days or fewer are left, or when the store is in a removal hold, each with one action; counts of active and inactive items; a `UsageBar` for items against the plan limit; the plan name and end date; the storefront link with copy and QR buttons, reusing `StoreQrModal`; quick links. For a new store, show a getting-started checklist worked out from the data, with no new database field: complete the store profile, add the first item, share the store link.
2. **Items (`/vendor/items`)**, modelled on `frontend/src/components/ListingManager.jsx`: search, a list that reads well on a phone, the photo with the `M8` fallback, price, a status badge, edit, and an active or inactive switch that asks for confirmation in a `Modal` before deactivating. An item hidden by the admin shows "Hidden by BharatShopy" and the reason, and its switch is disabled. Show the server's message when reactivating fails at the quota. No permanent delete.
3. **Add and edit item (`/vendor/items/new`, `/vendor/items/:productId`)**: a full page of numbered `FormSection`s, modelled on `frontend/src/pages/AddProduct.jsx`. Move the existing form logic out of the modal without changing behaviour: entity-specific fields, compression, direct Cloudinary upload with progress, `imageAssets`, the plan's photo limit, and the touch-friendly Remove and Cover buttons from `H2`. Keep `client/tests/productUpload.test.js` passing. Before any upload starts, block the save with a clear notice when the plan has ended or the quota is full. Show field errors beside the fields and scroll to the first one. After a save, go to the items list with a lasting notice.
4. **Store profile (`/vendor/store`)**: the current profile form in `FormSection`s with `Field` errors from the `M1` validation messages, the read-only store address, and the entity type picker as real radio inputs.
5. **Plan and usage (`/vendor/plan`)**, modelled on `frontend/src/pages/SubscriptionManager.jsx`: the current plan with its status and end date, usage, plan cards as radio inputs, the request form with the note, and the history of requests. Keep the wording honest about manual payment: the team contacts the vendor, then activates the plan. None of the words `E1` bans.
6. Follow every item in "Lessons from NBP's own browser test". Use `formatDisplayDate` for every date and toasts plus a lasting `Notice` for results.
7. Update `client/tests/accessibility.test.js` to assert the same things against the new files. Don't weaken it.
**Verify:** Client tests, lint and build pass. Search finds no `/api/admin/` call in vendor files, no `window.prompt`, `window.confirm` or `alert(`, and no remaining import of the three deleted files. `signMediaUpload` currently has no plan or quota check of its own: report under "New problems found" whether a refused save can still leave photos in Cloudinary. List the phone, keyboard and real-upload checks you didn't run.

### P7: Admin panel pages
**Problem:** The admin panel is one dark page with three tabs. Rejecting an application uses `window.prompt` (`AdminDashboard.jsx:93`) and ending a plan uses `window.confirm` (`:198`). Renew, remind and discontinue need a typed store ID. There's no vendor list, no way to remove a vendor or cancel a removal from the screen although the routes exist, no resend-email button although `E1` built the routes, and after a renewal nothing on the page changes.
**Fix:** Build these pages on `PanelLayout` and the `P1` parts, then delete `AdminDashboard.jsx`.
1. **Dashboard (`/admin`)**, modelled on `frontend/src/pages/AdminDashboard.jsx`: a notice when applications or plan requests are waiting, stat cards from `/api/admin/overview`, and link panels with counts.
2. **Applications (`/admin/applications`)**, modelled on `frontend/src/pages/UserApproval.jsx`: status tabs with waiting first, search, a card per application with every submitted detail and copy buttons for email and phone, approve, and reject in a `Modal` that requires the reason. When the server returns an email warning, show it with a resend button that calls the existing route.
3. **Vendor directory (`/admin/vendors`)**, modelled on `frontend/src/pages/UserManagement.jsx`: status tabs with totals (all, active, ending soon, ended, no plan, removal hold), search, and a table that drops columns on small screens. A row opens a detail `Modal` with the store link, contact details and these actions: set or renew plan (plan cards as radio inputs and a duration from 1 to 366 days, showing the resulting end date, which extends from the current expiry as `H6` decided), end plan now with confirmation, send renewal reminder, resend the last plan email, remove vendor (show the removal-impact counts and require confirmation that names the 7-day hold), and cancel removal during the hold. After every action, reload the row from the server. Never patch it locally.
4. **Plan requests (`/admin/plan-requests`)**, modelled on `frontend/src/pages/AdminPaymentRequests.jsx`: status tabs with totals, search, activate with the duration and resulting end date, and decline with a reason.
5. **Listings (`/admin/listings`)**: search, a store filter, a visible or hidden filter, hide with a required reason in a `Modal`, and restore. Show the item name and store name on every row.
6. **Audit log (`/admin/audit-log`)**, modelled on `frontend/src/pages/AdminAuditLogs.jsx`: paging, filters, a readable label and colour per action, and a detail `Modal` that lists the details as labelled rows, never raw JSON.
7. **Header and sidebar:** a notification bell modelled on `frontend/src/components/NotificationBell.jsx`, and count badges for applications and plan requests that refresh on every page change.
8. Show 409 responses from the server as plain messages: already decided, store pending removal, changed by someone else.
9. Follow every item in "Lessons from NBP's own browser test".
**Verify:** Client tests, lint and build pass. Search finds no `window.prompt`, `window.confirm` or `alert(` in `client/src`, no remaining import of `AdminDashboard.jsx`, and no admin page in the tenant route table. List the browser checks you didn't run, including each dialog with the keyboard.

### P8: Plans in the database and the plan editor
**Problem:** `getSubscriptionPlans` reads plans from a `subscription_plans` collection when it exists (`subscriptionController.js:42`), but requests, approval and renewal all read the fixed in-memory list (`:176`, `:333`, `:522`). The two can disagree, and changing a price or limit needs a code change and a deploy. `AdminDashboard.jsx:630-632` repeats plan names and prices by hand.
**Fix:**
1. Add `server/src/services/planService.js` as the only place plans are read. It reads the `subscription_plans` collection and falls back to the defaults in `subscriptionPlans.js` when the collection is empty or the database is unavailable. Replace every use of `inMemoryPlans` and `defaultPlans` in controllers with it.
2. Add `GET /api/admin/plans` and `PUT /api/admin/plans/:planId`, behind `requireAdmin`. Editable fields: name, both prices, item limit, photos per item, the extra feature lines, popular flag, active flag and sort order. Validate types and ranges, and compute the discount on the server. A plan that any store uses can be switched off for new requests but not deleted. No route creates or deletes plans in this task.
3. Generate the item and photo lines of the feature list from the numbers. The admin edits only the extra lines. Reject an extra line that contains a claim `M6` removed, using the same word list as `server/tests/planClaims.test.js`.
4. A plan edit doesn't change any store. A store gets the new limits at its next activation or renewal, which already copies them.
5. Add a documented script that copies the defaults into the collection once. It must refuse to run when `NODE_ENV=production` without an explicit flag, and must not overwrite existing plans.
6. Add the `/admin/plans` page, modelled on `frontend/src/pages/AdminPlanSettings.jsx`, without its platform settings sections. Use the plan list from the API in the set-plan dialogs from `P7`.
7. Log edits with `logAdminAction`.
**Verify:** Tests cover: every controller reading plans through the service; an edited limit applying to a new activation and not to a current subscriber; the generated lines matching the numbers; a banned claim returning 400; bad prices and limits returning 400; a switched-off plan refused for a new request but still shown as the current plan of a store that has it; both routes returning 401 without a cookie and rejecting a vendor cookie. Don't run the script against a remote database.

### P9: Sign-in and application pages on the shared layout
**Problem:** `VendorLogin.jsx`, `AdminLogin.jsx` and `VendorApply.jsx` each have their own layout and styles, different from the panels they lead to.
**Fix:** Rebuild the three pages on `AuthLayout`, `Field`, `Notice` and the button classes, modelled on `frontend/src/pages/UserLogin.jsx` and `AdminLogin.jsx` for layout only. Keep every request, step and message as it is: the email code steps, the password then code steps for the admin, the same response for known and unknown emails, and the link to `/vendor/apply` on the marketplace host. Lay out the application form as numbered `FormSection`s. A signed-in vendor or admin who opens a sign-in page goes straight to their panel.
**Verify:** Client tests, lint and build pass. The auth behaviour tests on the server pass unchanged. List the browser checks you didn't run.

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
