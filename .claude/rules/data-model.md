---
paths:
  - "src/db/schema.ts"
  - "src/db/seed.ts"
  - "src/lib/data/**"
  - "src/lib/logbook/**"
---

# Data model

Single-user, **single-car** app (one deployment per user). Tables in `src/db/schema.ts`:

- **`vehicle`** — one active car. `odoOpen`/`odoClose` km; `purchaseCostCents` (cents). `getVehicle()`/`upsertVehicle()` assume the first (only) row — `.limit(1)`, no vehicle picker.
- **`logbookPeriod`** — an ATO 12-week logbook window (`startDate`/`endDate`, `validUntil`). `businessPctBps` = business% × 100 (basis points), a **computed cache** — recompute from trips, don't trust for reports.
- **`trip`** — `odoStart`/`odoEnd` (km, `end > start` enforced in `parseTripForm`), `date` ISO, `isBusiness` bool, optional `periodId`/`purpose`. Distance = `odoEnd − odoStart` (`tripKm`).
- **`expense`** — `amountInclCents` (GST-inclusive), `gstCents` (default 0), `category`, `vendor?`, `receiptKey?` (R2 object key), `ocrRaw?` (Workers AI OCR text), `notes?`.
- **`settings`** — `fyStartMonth` (default 7 = Jul), `gstRegistered` (default true), `abn?`.

## Money / dates (repeat, because it's the #1 trap)

- All money columns are **integer cents** (`*Cents`). Dollars only at the UI edge.
- All dates are **ISO `YYYY-MM-DD` text**. AU FY = 1 Jul–30 Jun.

## Ownership scoping

Because it's single-car, data helpers don't filter by `vehicleId` on read (there's one car). If a multi-car slice ever lands, revisit `listTrips`/`getVehicle`/`updateTrip` — they currently return/mutate across all rows.
