# Food-Dash

Food delivery platform pilot for the Cebu area. Three-sided marketplace: customer app, rider app, restaurant dashboard — all sharing one Supabase backend and one design system (Style C: coral header, mint status, white surfaces).

## Structure

An npm workspace — one `npm install` at the root installs all three apps and
links the shared packages.

```
food-dash/
├── package.json            # Workspace root (apps/* + packages/*)
├── supabase/
│   ├── schema.sql          # Baseline schema + RLS policies (run first)
│   ├── migrations/         # Numbered changes since baseline — run in order
│   ├── seed.sql            # Sample Cebu restaurants + menus for dev
│   └── verify.sql          # Post-setup checks — every row should read PASS
├── packages/
│   ├── theme/              # @food-dash/theme — design tokens, single source of truth
│   └── money/              # @food-dash/money — centavo helpers + commission split
├── apps/
│   ├── customer/           # Expo (React Native) — browse, order, pay, track
│   ├── rider/              # Expo (React Native) — go online, accept, deliver, earnings
│   └── restaurant-web/     # Vite + React — order kanban for restaurant staff
```

## Getting started

1. **Backend** — Create a project at supabase.com (region: **Singapore**, it
   can't be changed later). In the SQL editor run `supabase/schema.sql`, then
   every file in `supabase/migrations/` in numeric order, then
   `supabase/seed.sql`, then `supabase/verify.sql` — every row of that last
   one should read PASS. Then create a test user under Authentication → Users
   and run `verify.sql` again: checks 9 and 10 confirm the signup trigger
   actually fired. If it didn't, stop and fix that before anything else.
2. **Keys** — In each app, copy `.env.example` to `.env` and fill in the
   project URL and **anon** key from Settings → API. The `service_role` key
   never goes in an app — it bypasses every RLS policy in `schema.sql`.
3. **Install once, at the repo root** — `npm install`. Never run `npm install`
   inside an app directory; that breaks the workspace links to `@food-dash/*`.
4. **Customer app** — `npm start -w food-dash-customer` (Expo Go on your phone).
5. **Rider app** — `npm start -w food-dash-rider`.
6. **Restaurant dashboard** — `npm run dev -w food-dash-restaurant-web`.

`EXPO_PUBLIC_*` vars are inlined at build time — after editing `.env`, restart
Metro with `--clear` or you'll keep running the old values.

All apps currently run on mock data (`src/lib/mockData.js` / mock arrays) so
UI development isn't blocked while the backend is wired up. Every mock is
marked with a `TODO` comment showing the Supabase query that replaces it.

## Design system rules (Style C)

1. Every screen opens with a pastel-coral header (`#FFD9C9`) with deep-coral text.
2. Exactly ONE deep-coral (`#D85A30`) CTA per screen, always with white text.
3. Mint (`#CFF0E8`) means status only — never actions.
4. Status shown on the coral header = white pill with teal text.
5. Content below headers stays neutral: white, hairline dividers, muted grays.

All values come from `@food-dash/theme`. Never hardcode a hex in a screen.

## Accounts & registration

Three sides, three different paths — they are deliberately not the same flow.

- **Customers** self-register with phone OTP. No address at signup; capture it
  at first checkout.
- **Riders** self-register but start `pending` and cannot work until you
  approve them by hand. `riders.status` plus a check constraint enforces this
  in the database, so no app bug can put an unvetted rider online.
- **Restaurants** have no public signup, on purpose. A restaurant account can
  accept orders and is owed money — you create it yourself after agreeing a
  commission rate and collecting payout details. `restaurants.owner_id` is
  nullable so the row can exist before the owner account does.

Accounts are per-app: a rider who also orders food signs up separately as a
customer. Each app rejects the wrong role at login.

**Current method is email + password with confirmations off** — signup logs
you straight in, no verification round-trip, so every other flow can be built
and tested without waiting on an SMS provider. Phone OTP replaces this before
launch; `AuthScreen` keeps its shape either way.

`handle_new_user()` creates the profile row on signup. It runs
`security definer` and whitelists the role to `customer` or `rider`, because
the client must never be able to name itself `admin`. Signup must pass
`full_name` (and `role` for riders) in the auth metadata.

Session storage in the Expo apps must be set to AsyncStorage explicitly —
the Supabase client defaults to `localStorage`, which doesn't exist in React
Native, and users get silently logged out on every app restart.

## Money model

- Every amount — database, app state, props — is an integer number of centavos.
  Floats never touch money. If a value isn't named `*_cents` / `*Cents`, it
  isn't money.
- Convert at exactly two boundaries, both in `@food-dash/money`:
  `pesos(129)` when authoring a literal, `formatMoney(12900)` when rendering.
  The ₱ symbol and decimal convention live in that one file.
- Platform takes a cut of **both** the food subtotal (from the restaurant) and
  the delivery fee (from the rider). Both rates are snapshotted per order so
  changing them later never rewrites historical payouts.
- `splitOrderMoney()` in `@food-dash/money` is the single implementation of that
  split. It rounds each party's cut and gives the platform the remainder, so
  the three payouts always sum back to exactly the order total.

Current rates: **10% of the food subtotal** (per restaurant, on
`restaurants.commission_rate`) and **15% of the delivery fee** (platform-wide,
defaulted on `orders.rider_commission_rate`). On a ₱258 order with a ₱29
delivery fee that's ₱232.20 to the restaurant, ₱24.65 to the rider, ₱30.15 to
you. Changing either rate only affects future orders.

## 8-week build plan

| Week | Dev 1 (backend)            | Dev 2 (customer app)      | Dev 3 (rider + dashboard)          |
| ---- | -------------------------- | ------------------------- | ---------------------------------- |
| 1    | Supabase setup, auth       | Expo scaffold, navigation | Rider scaffold                     |
| 2    | Orders API + RLS hardening | Home + restaurant screens | Incoming orders + accept           |
| 3    | PayMongo integration       | Cart + checkout           | Active delivery flow               |
| 4    | Order status functions     | Live tracking (realtime)  | Restaurant dashboard               |
| 5    | Rider assignment logic     | Auth + addresses          | Rider earnings (real data)         |
| 6    | Push notifications (FCM)   | Polish + error states     | Polish + error states              |
| 7    | Integration testing        | Integration testing       | Integration testing                |
| 8    | Pilot launch prep          | Pilot launch prep         | Pilot: 1 barangay, 3-5 restaurants |

## Deliberately NOT in the MVP

- Automated rider dispatch (assign manually or nearest-available at first)
- Promo/voucher engine
- In-app chat (use phone/Messenger)
- Multi-restaurant carts
- In-app navigation (hand off to Google Maps)

## Before going live

- [ ] PayMongo business verification (start early — can take weeks)
- [ ] DTI/SEC + BIR + LGU permits
- [ ] Rider agreements reviewed by a lawyer (contractor classification)
- [ ] Privacy policy + NPC registration if required at your scale
- [ ] **Turn email confirmations back on**, or switch to phone OTP. They are
      off for development, which means anyone can sign up as anyone's address.
