import { sqliteTable, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const vehicle = sqliteTable("vehicle", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  make: text("make").notNull(),
  model: text("model").notNull(),
  rego: text("rego"),
  odoOpen: integer("odo_open"),
  odoClose: integer("odo_close"),
  purchaseDate: text("purchase_date"),
  purchaseCostCents: integer("purchase_cost_cents"),
  purchaseGstCents: integer("purchase_gst_cents"), // GST on the tax invoice; 0 = private sale, null = not recorded
  effectiveLifeYears: integer("effective_life_years"), // self-assessed effective life (years); null = ATO default (8)
});

/** Odometer at the start (1 Jul) and end (30 Jun) of an income year; the ATO wants both for each year a logbook is relied on. */
export const vehicleFyOdometer = sqliteTable(
  "vehicle_fy_odometer",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    vehicleId: integer("vehicle_id").notNull().references(() => vehicle.id),
    fyLabel: text("fy_label").notNull(), // e.g. "2025-26"
    odoOpen: integer("odo_open"), // km at 1 July; null = not recorded
    odoClose: integer("odo_close"), // km at 30 June; null = not recorded
  },
  (t) => [uniqueIndex("vehicle_fy_odometer_vehicle_fy_unique").on(t.vehicleId, t.fyLabel)],
);

export const logbookPeriod = sqliteTable("logbook_period", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicle.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  businessPctBps: integer("business_pct_bps"), // basis points (business% x 100), computed cache
  validUntil: text("valid_until"),
  nominatedFy: text("nominated_fy"), // FY label the logbook is for when it crosses 30 June; null = start FY
  odoStart: integer("odo_start"), // odometer at period start (km); null = not recorded yet
  odoEnd: integer("odo_end"), // odometer at period end (km); total km = end - start
});

export const trip = sqliteTable("trip", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicle.id),
  periodId: integer("period_id").references(() => logbookPeriod.id),
  date: text("date").notNull(),
  endDate: text("end_date"), // null = the trip ends the same day as `date`
  odoStart: integer("odo_start").notNull(),
  odoEnd: integer("odo_end").notNull(),
  purpose: text("purpose"),
  isBusiness: integer("is_business", { mode: "boolean" }).notNull(),
});

export const expense = sqliteTable("expense", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicle.id),
  date: text("date").notNull(),
  category: text("category").notNull(),
  amountInclCents: integer("amount_incl_cents").notNull(),
  gstCents: integer("gst_cents").notNull().default(0),
  vendor: text("vendor"),
  abn: text("abn"), // seller ABN, 11 digits, no spaces
  taxInvoice: integer("tax_invoice", { mode: "boolean" }).notNull().default(false),
  receiptKey: text("receipt_key"), // R2 object key
  notes: text("notes"),
  ocrRaw: text("ocr_raw"), // legacy (OCR removed); kept so migrations stay non-destructive
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fyStartMonth: integer("fy_start_month").notNull().default(7),
  gstRegistered: integer("gst_registered", { mode: "boolean" }).notNull().default(true),
  abn: text("abn"),
});
