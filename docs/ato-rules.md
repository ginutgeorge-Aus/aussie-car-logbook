# ATO rules map

Every tax rule the app applies, the official page it comes from, and where it lives in code.
ato.gov.au is the rule book. Last re-checked **2026-10-22**. Re-check every July, when the car
limit is indexed.

Code comments in `src/lib/tax/` link the same pages. Tests sit next to the code (`*.test.ts`).

## GST and BAS

| Rule | Source | Code |
|------|--------|------|
| GST is 1/11 of the GST-inclusive price, rounded to the nearest cent (0.5 up) | [ATO: Tax invoices](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/tax-invoices) | `gstFromInclusive` (`src/lib/tax/gst.ts`) |
| BAS GST credit covers only the business-use share | [ATO: When you can claim a GST credit](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/claiming-gst-credits/when-you-can-claim-a-gst-credit) | `gstCredit` (`gst.ts`) |
| A GST credit on a purchase over $82.50 (incl. GST) needs a tax invoice | same page | `TAX_INVOICE_THRESHOLD_CENTS`, `gstCreditEligible` (`gst.ts`) |
| A tax invoice for $1,000+ must also show the buyer's identity or ABN | [ATO: Tax invoices](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/tax-invoices) | `TAX_INVOICE_BUYER_ID_THRESHOLD_CENTS` (`gst.ts`) |
| Quarterly BAS: Q1 Jul–Sep, Q2 Oct–Dec, Q3 Jan–Mar, Q4 Apr–Jun | [ATO: Due dates for lodging and paying your BAS](https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/business-activity-statements-bas/due-dates-for-lodging-and-paying-your-bas) | `basQuarter`, `fyQuarters` (`src/lib/tax/dates.ts`) |
| ABN checksum: subtract 1 from the first digit, apply the weights, and the sum must divide by 89 | [ABR: ABN format](https://abr.business.gov.au/Help/AbnFormat) | `isValidAbn` (`src/lib/tax/abn.ts`) |

## Car purchase and depreciation

| Rule | Source | Code |
|------|--------|------|
| Car limit for each FY (2020-21 to 2026-27) | ATO *Guide to depreciating assets* for each year ([2026 edition](https://www.ato.gov.au/forms-and-instructions/depreciating-assets-guide-2026/depreciating-assets-effective-life-cost-and-decline-in-value/cost-of-a-depreciating-asset)); [2026-27 thresholds](https://www.ato.gov.au/businesses-and-organisations/small-business-newsroom/car-thresholds-from-1-july) | `CAR_LIMIT_CENTS` (`src/lib/tax/depreciation.ts`) |
| Car purchase GST credit is the GST on the tax invoice, capped at 1/11 of the car limit. A private sale has no GST, so no credit. GST that isn't recorded gets no credit (#46) | [ATO: Purchasing a motor vehicle](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/in-detail/your-industry/motor-vehicle-and-transport/gst-and-motor-vehicles/purchasing-a-motor-vehicle) | `carPurchaseGstCents` (`depreciation.ts`) |
| Depreciation cost base: cost less the GST credit claimed, then capped at the car limit for the FY the car was first held | Guide to depreciating assets, *Cost of a depreciating asset* (link above) | `depreciationForFy` (`depreciation.ts`) |
| Diminishing value: base × days/365 × 200% ÷ effective life | [ATO: Prime cost and diminishing value methods](https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/general-depreciation-rules-capital-allowances/prime-cost-straight-line-and-diminishing-value-methods) | `diminishingValue` (`depreciation.ts`) |
| Effective life of a car: 8 years (**not re-confirmed**: TR 2022/1 is withdrawn, so check the ATO Effective Life lookup) | [ATO: Effective life of an asset](https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/general-depreciation-rules-capital-allowances/effective-life-of-an-asset) | `EFFECTIVE_LIFE_YEARS` (`depreciation.ts`) |

## Logbook method and income-tax deduction

| Rule | Source | Code |
|------|--------|------|
| Business-use % = business km ÷ total km over the logbook period | [ATO: Logbook method](https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business/deductions/deductions-for-motor-vehicle-expenses/logbook-method) | `businessPct` (`src/lib/tax/logbook.ts`) |
| The logbook must cover at least 12 continuous weeks | ITAA 1997 s28-120(1); ATO logbook method page | `LOGBOOK_MIN_DAYS` (`logbook.ts`) |
| A logbook is valid for its income year plus the next 4 (5 years) | ITAA 1997 s28-115(2); ATO: "Each logbook you keep is valid for five years" | `LOGBOOK_VALID_YEARS`, `logbookValidity` (`logbook.ts`) |
| A period that crosses 30 June can serve either income year: it "may overlap the start or end of the income year, so long as it includes part of the year" (#45) | [ITAA 1997](https://www.legislation.gov.au/C2004A05138/latest/text) s28-120(2) | `logbookFirstFy`, `logbookNominableFys` (`logbook.ts`) |
| No valid logbook, no logbook-method claim (#52) | ITAA 1997 s28-100(2) | `buildFyReport` (`src/lib/reports/build.ts`) |
| The logbook shows the odometer at the start and end of the period; total km = end − start, not the sum of logged trips, so unlogged private trips count (#49) | [ATO: Work-related car expenses](https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026/deductions/work-related-expenses/work-related-car-expenses) | `logbookPeriodUse`, `logbookPeriodBusinessPctBps`, `resolveBusinessUse` (`src/lib/logbook/compute.ts`); `parsePeriodOdometers` (`parse.ts`) |
| Each business journey shows the date it began and ended, start/end odometer, km travelled and the reason for it; a missing reason is flagged on the report (#50) | [ATO: Work-related car expenses](https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026/deductions/work-related-expenses/work-related-car-expenses) | `parseTripForm` (`parse.ts`, `purpose` required when business, optional `endDate`); `businessTripsMissingPurpose` (`compute.ts`); `buildFyReport` notice (`build.ts`) |
| For every income year a logbook is relied on, keep odometer readings at the start (1 July) and end (30 June) of the year; a missing one is flagged on the report (#51) | [ATO: Work-related car expenses](https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026/deductions/work-related-expenses/work-related-car-expenses) | `vehicle_fy_odometer` table (`schema.ts`); `parseVehicleFyOdometerForm` (`parse.ts`); `missingFyOdometers` (`compute.ts`; close only due once the FY has ended); `buildFyReport` notice (`build.ts`, only for a year the logbook covers) |
| The logbook the ATO may ask to see shows the period dates, odometer at start and end, total km, business km, business-use % and each journey; the app prints it as one page (#53) | [ATO: Work-related car expenses](https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026/deductions/work-related-expenses/work-related-car-expenses) | `/trips/logbook/[id]` (`src/app/trips/logbook/[id]/page.tsx`); `tripsInPeriod`, `logbookPeriodUse` (`compute.ts`) |
| GST-registered: deduct the cost less the GST credit you're entitled to | [ATO: Effect of GST credits on income tax deductions](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/claiming-gst-credits/effect-of-gst-credits-on-income-tax-deductions) | `annualDeduction` (`src/lib/tax/deduction.ts`) |
| Australian income year runs 1 July to 30 June | ITAA 1997 s995-1 | `financialYear` (`dates.ts`) |

## Known gaps

- **Yearly odometer readings** (#51) are entered by hand, not backfilled from the vehicle's single opening/closing odometer (no FY attached, so a guess could be wrong tax data). Years with no readings stay flagged on the report.
- **Effective life** isn't re-confirmed, and users can't override it yet (see row above).
- **Held-back GST** (no tax invoice yet): the ATO deducts the cost less the GST credit you're *entitled to*. The app still deducts GST-exclusive for these expenses.
