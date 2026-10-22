ALTER TABLE `expense` ADD `abn` text;--> statement-breakpoint
ALTER TABLE `expense` ADD `tax_invoice` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Existing expenses keep their GST credit after upgrade (pre-flag behaviour).
UPDATE `expense` SET `tax_invoice` = 1;
