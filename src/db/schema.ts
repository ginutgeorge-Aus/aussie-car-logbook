import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const vehicle = sqliteTable("vehicle", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  make: text("make").notNull(),
  model: text("model").notNull(),
  rego: text("rego"),
  odoOpen: integer("odo_open"),
  odoClose: integer("odo_close"),
  purchaseDate: text("purchase_date"),
  purchaseCostCents: integer("purchase_cost_cents"),
});

export const logbookPeriod = sqliteTable("logbook_period", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicle.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  businessPctBps: integer("business_pct_bps"), // basis points (business% x 100), computed cache
  validUntil: text("valid_until"),
});

export const trip = sqliteTable("trip", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicle.id),
  periodId: integer("period_id").references(() => logbookPeriod.id),
  date: text("date").notNull(),
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
  receiptKey: text("receipt_key"), // R2 object key
  notes: text("notes"),
  ocrRaw: text("ocr_raw"),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fyStartMonth: integer("fy_start_month").notNull().default(7),
  gstRegistered: integer("gst_registered", { mode: "boolean" }).notNull().default(true),
  abn: text("abn"),
});
