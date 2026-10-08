# Fidelx neo-brutalist redesign: project notes

This is the COMPLETE frontend project with the redesign applied (Batches 1-3 merged).
Not included: node_modules, .git, dist (your original zip had an old committed `dist/` build).
Run `npm install` then `npm run build`. If your host serves the committed dist/, rebuild first or the redesign won't show.
Frontend only: nothing in the backend, database, `src/api`, `src/store` or hooks was changed.

## Redesigned so far
- Foundation: tailwind.config.js, src/index.css, index.html (fonts), shared components, nav shell
- Customer Home (incl. "Your order" under search, "Order again" at the bottom)
- Sign in / Create account (all roles share these screens; vendor and rider fields are part of the create-account screen)
- Vendor and rider sign-up journey after registering: Terms step, vendor setup (3 steps + progress bar), rider verification
  (NIN form, verified, failed + retry), and the under-review / rejected status cards (shared PopHeader component)
- Vendor Dashboard
- Customer buying path: Store, Store products, Product, Cart, Checkout (markup only; Checkout's money logic is byte-identical)
- Customer Orders list, Order detail (cancel, receipts, rider delivery code, review, dispute) and the order progress tracker
- The REST of the customer account: Search, Stores, Profile, Support, Refer friends, Receipts, Notifications, Payment verify, plus the
  pages customers reach from sign-in/Profile: Forgot password, Reset password, Change password, Terms. EVERY customer screen is done.
The customer side is complete. Vendor screens other than the Dashboard and sign-up journey (Orders, Products, Earnings, Withdrawals,
Reviews, Settings) get the new colours, fonts, nav, buttons, inputs, cards and modals, but still have their old layouts, so they look
like a hybrid until redesigned. Next up: those vendor screens, then rider and (if wanted) admin.

## Safety switches (rollback in one line each)
- Customer app: `theme="pop"` in src/layouts/CustomerLayout.jsx
- Vendor app:   `theme="pop"` in src/layouts/VendorLayout.jsx
- Sign-in/up:   `data-theme="pop"` in src/layouts/AuthLayout.jsx
- Rider: `theme={isOnboardingRoute ? "pop" : undefined}` in src/layouts/RiderLayout.jsx. Only the rider onboarding/verification
  route is themed; an approved rider's dashboard, orders, earnings etc. look exactly as before.
- Admin layout does NOT pass the theme, so it looks exactly as before.
- Remove Home sections: delete `<ActiveOrdersStrip />` / `<OrderAgainSection />` in HomePage.jsx

## The neo-brutalist kit (for building more screens)
Colours: bg-brand (orange) text-brand-deep, bg-ink / text-ink (brown-black), bg-paper, bg-peach, bg-sun, bg-lime, bg-coral, bg-lilac, bg-mint, bg-leaf, text-bad
Outlines: border-[2.5px] border-ink (cards, buttons, inputs), border-[3px] for big pills and sheets
Shadows (hard, no blur): shadow-pop-xs / shadow-pop-sm / shadow-pop / shadow-pop-lg
Press effect: active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_rgb(var(--c-ink))]
Shapes: rounded-full for buttons/chips/search, rounded-[22px] for cards, rounded-b-[34px] for orange headers
Type: font-display (Bricolage Grotesque, weight 800, tight tracking) for headings; Figtree for body
`pop:` prefix = "only inside the redesigned theme" (shared components use it so other roles are untouched).
Old token names still work (teal = orange accent, navy = page background) but use the new names in new code.

## Test on staging before deploying (live users)
Sign in as customer, vendor, rider, admin; create accounts for each role; Home with and without orders; Order again
(with another store's items in the cart, out-of-stock item, closed store); vendor dashboard status/share/earnings;
checkout and withdrawals end to end; rider and admin dashboards unchanged.
Sign-up journeys: create a vendor account (Terms, 3 setup steps, shop location, pending screen, rejected + resubmit) and a rider
account (NIN submit, verified, failed + retry, pending/rejected); WhatsApp verification links open; Terms checkbox gates Continue. `node src/features/customer/home/reorderPlan.test.mjs` runs 13 unit tests.

## React Query v5 fixes (applied) and what is still open
FIXED
1. Order Detail auto-refresh: `refetchInterval` now reads `query.state.data` (v5 passes the query, not the data), so an in-progress
   order refreshes every 15s again.
2. Closed-store check on the Product page: GET /products/:id doesn't return the store's availability_status, so "Store Unavailable"
   could never trigger. ProductPage now reads the status from the store endpoint (same cache key as StorePage, `["store", id]`),
   and skips that extra request automatically if the product endpoint ever returns the status itself.
3. All 45 old-style `invalidateQueries([...])` calls (array form) were converted to `{ queryKey: [...] }`. In v5 the array form matched
   EVERY query, so every mutation refreshed the whole screen. Now each refreshes only what it should. Two companion keys were added
   where something else mounted depends on the mutation: the notification bell badge (`notifications-unread-count`) after marking
   notifications read, and the rider's `available-orders` + layout profile (`my-rider-profile`) after going online/offline.
   Verified by round-trip: converting the new calls back gives the original files exactly (21 files), plus 4 hand-edited files.
   Watch on staging: after a mutation, confirm the data you expect on that screen still updates (bell badge, rider online toggle,
   vendor/rider withdrawals, admin approve/reject actions, product save/delete, order status updates).
STILL OPEN (not changed)
- GET /orders returns flat rows without sub_orders; the Orders list now hides the vendor count instead of printing "0 vendors".
- GET /products/:id still returns soft-deleted products (Order again skips them; the Product page does not).
- `keepPreviousData` is passed in 5 places (SearchPage, StorePage, StoreProductsPage, StoresPage, vendor ReviewsPage). v5 ignores it
  (it became `placeholderData: keepPreviousData`), so those lists flash to skeletons when you change sort/page instead of keeping the old rows.

## Buying-path notes (Store, Store products, Product, Cart, Checkout)
- Store, Store products and Product also serve the LOGGED-OUT share links (/s/:id, /p/:id), which sit outside the themed shell.
  Each wraps itself in `data-theme="pop"` so both routes look identical. PublicCartButton (public floating cart) was restyled too.
- Fixed bottom bars (View Products, Add to cart, Proceed to checkout, Pay with Paystack) were re-offset for the taller nav:
  `bottom-[calc(4.75rem+env(safe-area-inset-bottom))]`. If you change the nav height in AppShell, update these.
- Checkout: lines above the markup are untouched (idempotency key, coupon validation, fee maths, createOrder, Paystack redirect).
  Cart and Checkout kept every displayed money expression verbatim.
- New helper `src/utils/popTint.js` (visual only): `tintFor(id)` and `AVAILABILITY_DOT`.
- Reviews (RatingStars, RatingBreakdown, ReviewCard) and GpsLocationCapture got `pop:` variants only, so admin screens still look the same.
- Staging checklist: add to cart, change quantity, remove, "Clear all", out-of-stock notice; Product variants and quantity, add to cart,
  "Start a new cart?" prompt; Store tabs, review filters/pagination, call/WhatsApp when unlocked; Checkout delivery vs pickup, set location,
  fee estimate, apply/remove coupon, total matches Cart, pay redirects to Paystack; open an /s/... and /p/... link while logged OUT;
  check no bottom bar is hidden behind the nav on a small phone and on an iPhone with a home indicator.

## Orders notes (Orders list, Order detail, tracker)
- Order detail: everything above the markup (queries, polling, cancel, receipts, evidence upload, dispute, review state) is byte-identical.
- Progress tracker: same step lists and logic. New: the current step is always spelled out under the dots ("Finding Rider · Step 3 of 7");
  before, phones saw unlabeled dots because the labels were `hidden sm:block`. The final step shows a green check once reached.
- Orders list: paid, unfinished orders get the yellow "live" card (same rule as Home's "Your order").
- The rider's delivery code is now a large yellow ticket so it is easy to read out loud.
- OrderProgress, ReviewForm and PhotoPicker are only used by Order detail, so they were restyled directly (no `pop:` prefixes).
- Label copy was sentence-cased in a few places (e.g. "Edit your review", "Submit dispute", "Total paid"). Behaviour is unchanged.
- Staging checklist: Orders list (empty, in progress, delivered, cancelled); open each; tracker for a delivery order AND a pickup order;
  cancel a PAYMENT_CONFIRMED item; rider assigned shows name, call link and the delivery code (and hides it once delivered/cancelled);
  View Receipt and PDF download; Rate & Review (create, edit, with photos); Report a problem (reason + photo upload + submit, then "Dispute filed").

## Customer account notes (Search, Stores, Profile, Support, Refer, Receipts, Notifications, Payment verify, auth-flow pages)
- Payment verify is a top-level route (outside the app shell), so it carries its own `data-theme="pop"` scope.
- NotificationsPage is shared by customer, vendor, rider AND admin. It was restyled with `pop:` variants only, so customer and vendor get the
  new look while rider and admin render exactly as before. Replace the `pop:` classes with plain ones when those apps are redesigned.
- Profile and Search/Stores keep every query, handler and link; Profile uses the new orange header.
- Forgot / Reset / Change password and Terms live inside the auth layout (always themed). Change password and Terms keep their top bar's back button.
- Labels were sentence-cased in a few places ("Reset password", "Contact support"); behaviour is unchanged.
- Staging checklist: Search (query, category, sort, pagination, open product/store); Stores (category list, open store); Profile (toggle each
  notification preference, every shortcut, Log out); Support (validation, submit, ticket list); Refer (share/copy link, progress, paused state);
  Receipts (open a receipt in a new tab); Notifications (mark one read, mark all read, bell badge updates); Payment verify (success redirects to the
  order, failure shows Back to Cart, missing reference shows Go Home); Forgot, Reset, Change password; Terms.

## Opening hours + live rider tracking (frontend)
Needs the BACKEND changes (see the backend project's BACKEND-CHANGES.md). Deploy order: migration, backend, then this frontend.
- Vendor: Settings > "Opening hours" card (switch, weekly times in Nigerian time, "Copy Monday to every day", validation). The Dashboard
  pill reads "Closed by opening hours . Opens ..." when the hours (not the vendor's own switch) are closing the store.
- Customer: Store page shows "Today 8:00 AM - 9:00 PM" or "Closed right now . Opens tomorrow at 8:00 AM". Home, Stores, Search chips and the
  Product page guard already read availability_status, which is now the effective status. Cart and Checkout show a notice and disable the
  button for a closed store (src/features/customer/useStoreOpenStatus.js). The server refuses the order regardless.
- Rider tracking card (src/features/customer/tracking/RiderTrackingCard.jsx) on Order detail, only while a delivery is Rider assigned /
  Picked up / Delivering. Stylised map from the design reference; the rider glides along the route, trail fills, home pin pulses under 300 m,
  ETA chip. Honest states: no live position -> "Your rider is on the way" with no numbers; stale -> "Last known position". The status tracker above it is unchanged.
- Rider app: src/components/rider/LiveLocationSharing.jsx (mounted in RiderLayout for approved riders) sends the rider's position about every
  12 s, only while a delivery is in progress, with a small "Sharing live location" pill. Foreground only (browser limitation).
- Animations are pure CSS and switch off under the OS "reduce motion" setting.
- Tests: `node src/features/customer/tracking/trackingMath.test.mjs` (12 tests). `fidelx-tracking-preview.html` shows the card in its states.
- Cart/Checkout: the only existing lines touched are the lucide import and the single button that gains `disabled={storeBlocked}`.
- Staging checklist: vendor saves hours (incl. a closed day and an overnight window); Store page labels; Cart + Checkout blocked outside hours and
  working inside; rider app shows the sharing pill only during a delivery and asks for location permission; the customer card appears, moves, and
  falls back to "Last known position" when the rider app is closed.


## Batch 4 — vendor operations screens (October 2026)
- Redesigned Vendor Orders, Products, Earnings, Withdrawals, Reviews and Settings with the existing neo-brutalist kit.
- Restyled the vendor-used Withdrawal PIN modal, Change PIN section and bank-account verification fields with `pop:` variants so unthemed rider/admin screens retain their old appearance.
- Presentation-only changes: existing hooks, queries, mutations, handlers, validation, money expressions, status transitions, uploads, bank verification, GPS capture, opening hours and logout behavior were preserved.
- Vendor Orders still uses the existing `PAYMENT_CONFIRMED → PREPARING`, `PREPARING → READY_FOR_PICKUP`, and pickup `READY_FOR_PICKUP → DELIVERED` transitions.
- Audit: JSX parser passed for all 9 changed JSX files; logic parity found no lost dynamic logic; project import/class checks passed (602 imports checked, 0 unresolved).
- Full `npm run build` could not be run in this environment because dependency installation timed out and the resulting `node_modules` is incomplete (`vite` executable unavailable).
- Staging before deployment: vendor orders/status transitions; product create/edit/delete/image upload/copy link; earnings balances and refund liability; withdrawal preview, bank verification, PIN gate and history; reviews sort/reply/photo links; settings profile/GPS/opening hours/PIN/logout.
- Remaining redesign order: Rider screens next. Admin remains an explicit owner decision: restyle or leave as-is.
