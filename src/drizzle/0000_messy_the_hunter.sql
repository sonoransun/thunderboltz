CREATE TABLE `setting` (
	`id` integer PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `setting_id_unique` ON `setting` (`id`);