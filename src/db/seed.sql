-- Fake sample data for local dev/demo. No real personal or tax data.
-- Re-runnable: wipes every table (children first) and resets ids, so ids below stay 1.
-- LOCAL DEV ONLY - never run against a database holding real data.
DELETE FROM trip;
DELETE FROM expense;
DELETE FROM logbook_period;
DELETE FROM vehicle_fy_odometer;
DELETE FROM vehicle;
DELETE FROM settings;
DELETE FROM sqlite_sequence WHERE name IN ('trip', 'expense', 'logbook_period', 'vehicle_fy_odometer', 'vehicle', 'settings');
INSERT INTO settings (fy_start_month, gst_registered, abn) VALUES (7, 1, NULL);
INSERT INTO vehicle (make, model, rego, odo_open, purchase_date, purchase_cost_cents, purchase_gst_cents)
  VALUES ('Toyota', 'Corolla', 'ABC123', 50000, '2023-07-01', 3000000, 272727);
-- Odometers span exactly the seeded trips (50000-50060): 40 business km of 60 = 66.67%.
INSERT INTO logbook_period (vehicle_id, start_date, end_date, business_pct_bps, valid_until, odo_start, odo_end)
  VALUES (1, '2024-07-01', '2024-09-23', 6667, '2029-06-30', 50000, 50060);
INSERT INTO vehicle_fy_odometer (vehicle_id, fy_label, odo_open, odo_close) VALUES
  (1, '2024-25', 50000, 58200);
INSERT INTO trip (vehicle_id, period_id, date, odo_start, odo_end, purpose, is_business) VALUES
  (1, 1, '2024-07-02', 50000, 50040, 'Client visit', 1),
  (1, 1, '2024-07-03', 50040, 50060, 'Groceries', 0);
INSERT INTO expense (vehicle_id, date, category, amount_incl_cents, gst_cents, vendor) VALUES
  (1, '2024-07-05', 'fuel', 8900, 809, 'BP'),
  (1, '2024-08-01', 'service', 45000, 4091, 'Local Mechanic');
