PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_embeddings` (
	`id` text PRIMARY KEY NOT NULL,
	`email_message_id` text,
	`embedding` F32_BLOB(384),
	FOREIGN KEY (`email_message_id`) REFERENCES `email_messages`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_embeddings`("id", "email_message_id", "embedding") SELECT "id", "email_message_id", "embedding" FROM `embeddings`;--> statement-breakpoint
DROP TABLE `embeddings`;--> statement-breakpoint
ALTER TABLE `__new_embeddings` RENAME TO `embeddings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `embeddings_id_unique` ON `embeddings` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `embeddings_email_message_id_unique` ON `embeddings` (`email_message_id`);