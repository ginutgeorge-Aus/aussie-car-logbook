# GLB-8 — "Odometer" UI redesign (iPhone + desktop)

Status: approved direction (PO picked B "Odometer", 2026-10-07). Presentation only — no tax,
data, or action changes.

## Goal

Replace the unstyled pages (no nav, `p-8`, overflowing tables, ~24px tap targets, Arial,
half dark mode, raw ISO dates and category codes) with one coherent, phone-first design that
also works on a desktop browser.

## Look

Source of truth: the `OdoPhone` (390px) and `OdoDesktop` mockups on the GLB-8 design canvas.

| Token | Dark (default) | Light (`prefers-color-scheme: light`) |
|---|---|---|
| `--bg` ground | `#0F1113` | `#F4F5F7` |
| `--surface` card | `#181B1F` | `#FFFFFF` |
| `--nav` nav surface | `#15181B` | `#FFFFFF` |
| `--line` border | `#2A2F35` | `#D3D8DE` |
| `--rule` row rule | `#22262B` | `#E5E8EC` |
| `--ink` text | `#EDEFF2` | `#14171A` |
| `--muted` secondary text | `#A3ABB5` | `#555D67` |
| `--nav-ink` inactive nav | `#C4CAD2` | `#3B424A` |
| `--accent` amber fill | `#F5A524` | `#F5A524` |
| `--accent-hover` | `#FFC15C` | `#E0951A` |
| `--on-accent` text on amber | `#1A1300` | `#1A1300` |
| `--accent-ink` amber as text | `#F5A524` | `#9A5B00` |
| `--private` private-trip marker | `#5A636E` | `#8A929C` |
| `--danger` / `--success` | `#F87171` / `#4ADE80` | `#B42318` / `#15803D` |

All text pairs meet WCAG AA (≥4.5:1) in both themes; amber is only used as a text colour via
`--accent-ink`. Tokens are CSS variables in `globals.css`, mapped to Tailwind colours with
`@theme inline`. Print forces the light palette.

Type: IBM Plex Sans (UI) + IBM Plex Mono (every number: money, km, odometer, %, FY chip), loaded
with `next/font/google`; the Arial override is removed.

## Shell

- `viewport-fit=cover`, `color-scheme: dark light`, per-scheme `theme-color` meta; manifest +
  offline page recoloured to the dark ground.
- **Mobile (<768px):** fixed bottom tab bar — Home, Trips, Expenses, Reports, Settings — 5 equal
  tabs, ≥44px, `env(safe-area-inset-bottom)` padding; content gets top safe-area padding and
  bottom padding that clears the bar. Vehicle is reached from the dashboard's vehicle line
  (as in the mockup); the Settings tab also highlights on `/vehicle`.
- **Desktop (≥768px):** top bar "GINOO / LOGBOOK" wordmark, text nav (Dashboard, Trips,
  Expenses, Reports, Vehicle, Settings) with amber underline on the active item, amber
  "Log a trip" button.
- `/settings` is built by GLB-7 (in parallel). This PR only links to it; it does not create the
  page or its action.

## Pages

- **Dashboard:** vehicle + rego line (links to Vehicle), FY chip, semicircle business-use gauge,
  boxed odometer digits (latest trip odometer, else opening odometer), business/total km line,
  stat tiles (expenses, GST credit, deduction in amber; whole dollars on phone, cents on desktop
  with an amber-bordered deduction tile), "Log a trip" (phone) / "Scan a receipt" (desktop),
  recent 5 trips (cards on phone, table with odometer column on desktop). Onboarding empty
  state when no vehicle; empty state when no trips.
- **Trips:** header + FY switcher chips, business-use summary, add-trip card (`#add-trip`),
  trips as cards (phone) / table (desktop, in an overflow-x box). Edit opens a stacked form in
  place of the card/row. Business/Private dot markers.
- **Expenses:** add-expense card (`#add-expense`) with scan, list as cards / table, friendly
  category labels, receipt link, human dates with year (list spans all FYs).
- **Reports:** FY switcher, vehicle + business use, notices panel, BAS quarter and annual tables
  in cards with right-aligned mono figures, total deduction in amber, category labels. Print
  keeps working (light palette, nav hidden).
- **Vehicle:** form card, mono numeric inputs.
- `loading.tsx` skeleton, restyled `error.tsx`.

## Behaviour rules

- Every number input gets `inputMode` (`decimal` for money, `numeric` for km); all tap targets
  ≥44px.
- Dates shown as "Tue 14 Sep" via a pure, timezone-free formatter on the stored `YYYY-MM-DD`
  (no `Date` local-time parsing, so no UTC/Sydney drift).
- Form field names, actions, `useFormSubmit`, confirm-before-delete, reset-on-add,
  exit-edit-on-save (GLB-2) are unchanged. Errors get `role="alert"`; adds show a short
  `role="status"` confirmation.

## Out of scope

Tax/report maths (GLB-4..7), settings page/logic (GLB-7), server-side error-message changes.
