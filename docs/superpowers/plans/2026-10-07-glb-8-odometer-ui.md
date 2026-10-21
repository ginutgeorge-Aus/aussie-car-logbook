# GLB-8 Odometer UI — implementation plan

Spec: `docs/superpowers/specs/2026-10-07-glb-8-odometer-ui.md`. Branch `feat/glb-8-ui-redesign`.
Presentation only; keep every form field name, action and `useFormSubmit` contract.

## Tasks

1. **Pure formatters (TDD)** — `src/lib/format.ts` + test: `humanDate`, `formatMoney`,
   `formatMoneyWhole`, `formatKm`, `odometerDigits`, `fyShort`. `categoryLabel` in
   `src/lib/expenses/categories.ts`; `currentOdometer` + `fyKmTotals` in
   `src/lib/logbook/compute.ts` (tests first).
2. **Tokens + fonts** — `globals.css` CSS variables (dark default, light via media, print = light),
   `@theme inline` mapping, safe-area utilities; `layout.tsx` IBM Plex Sans/Mono, viewport
   (`viewportFit: "cover"`, `colorScheme`, per-scheme `themeColor`); manifest + `sw.js` offline
   colours.
3. **App shell** — `src/components/icons.tsx`, `src/components/AppNav.tsx` (client,
   `usePathname`): desktop top bar + mobile bottom tab bar; wire into layout.
4. **UI primitives** — `src/components/ui.tsx`: class constants (buttons, inputs, card) +
   `PageHeader`, `EmptyState`, `TypeDot`; restyle `FieldError` (`role="alert"`), `FySwitcher`.
5. **Dashboard** — `BusinessGauge`, `OdometerDigits`, stat tiles, recent trips cards/table,
   onboarding + empty states.
6. **Trips** — `TripForm` (shared `TripFields`), `TripItem` card/row variants with stacked edit
   form, page layout.
7. **Expenses** — `ExpenseForm` restyle, `ExpenseItem` card/row variants, page layout.
8. **Reports + Vehicle + error/loading** — restyle tables/notices/print button, vehicle form,
   `loading.tsx`, `error.tsx`.
9. **Verify** — `pnpm test`, `pnpm lint`, `pnpm knip`, `tsc --noEmit`, `pnpm build`; screenshots at
   390px and 1440px against local D1 seed if a browser is available.
10. **PR** — push, open PR, `@codex review`, add to board, append PR URL to the GLB-8 ticket.
