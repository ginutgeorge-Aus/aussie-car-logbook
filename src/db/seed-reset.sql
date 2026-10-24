-- LOCAL DEV ONLY: wipes every table (children first) and resets ids so seed.sql
-- can be re-run. Run only via `pnpm db:seed` (--local). Never run against real data.
DELETE FROM trip;
DELETE FROM expense;
DELETE FROM logbook_period;
DELETE FROM vehicle_fy_odometer;
DELETE FROM vehicle;
DELETE FROM settings;
DELETE FROM sqlite_sequence WHERE name IN ('trip', 'expense', 'logbook_period', 'vehicle_fy_odometer', 'vehicle', 'settings');
