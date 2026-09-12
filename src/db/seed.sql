-- Fake sample data for local dev/demo. No real personal or tax data.
INSERT INTO settings (fy_start_month, gst_registered, abn) VALUES (7, 1, '00 000 000 000');
INSERT INTO vehicle (make, model, rego, odo_open, purchase_date, purchase_cost_cents)
  VALUES ('Toyota', 'Corolla', 'ABC123', 50000, '2023-07-01', 3000000);
INSERT INTO logbook_period (vehicle_id, start_date, end_date, business_pct_bps, valid_until)
  VALUES (1, '2024-07-01', '2024-09-23', 6700, '2029-06-30');
INSERT INTO trip (vehicle_id, period_id, date, odo_start, odo_end, purpose, is_business) VALUES
  (1, 1, '2024-07-02', 50000, 50040, 'Client visit', 1),
  (1, 1, '2024-07-03', 50040, 50060, 'Groceries', 0);
INSERT INTO expense (vehicle_id, date, category, amount_incl_cents, gst_cents, vendor) VALUES
  (1, '2024-07-05', 'fuel', 8900, 809, 'BP'),
  (1, '2024-08-01', 'service', 45000, 4091, 'Local Mechanic');
