CREATE TABLE `expense` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vehicle_id` integer NOT NULL,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`amount_incl_cents` integer NOT NULL,
	`gst_cents` integer DEFAULT 0 NOT NULL,
	`vendor` text,
	`receipt_key` text,
	`notes` text,
	`ocr_raw` text,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicle`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `logbook_period` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vehicle_id` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`business_pct_bps` integer,
	`valid_until` text,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicle`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fy_start_month` integer DEFAULT 7 NOT NULL,
	`gst_registered` integer DEFAULT true NOT NULL,
	`abn` text
);
--> statement-breakpoint
CREATE TABLE `trip` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vehicle_id` integer NOT NULL,
	`period_id` integer,
	`date` text NOT NULL,
	`odo_start` integer NOT NULL,
	`odo_end` integer NOT NULL,
	`purpose` text,
	`is_business` integer NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicle`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`period_id`) REFERENCES `logbook_period`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vehicle` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`rego` text,
	`odo_open` integer,
	`odo_close` integer,
	`purchase_date` text,
	`purchase_cost_cents` integer
);
