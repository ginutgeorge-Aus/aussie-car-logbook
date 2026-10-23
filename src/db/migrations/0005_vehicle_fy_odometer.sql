CREATE TABLE `vehicle_fy_odometer` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vehicle_id` integer NOT NULL,
	`fy_label` text NOT NULL,
	`odo_open` integer,
	`odo_close` integer,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicle`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicle_fy_odometer_vehicle_fy_unique` ON `vehicle_fy_odometer` (`vehicle_id`,`fy_label`);