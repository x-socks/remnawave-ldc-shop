ALTER TABLE `products` ADD `type` text DEFAULT 'card_key' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `tier` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD `months` integer;
--> statement-breakpoint
ALTER TABLE `orders` ADD `monthly_ldc` integer;
--> statement-breakpoint
ALTER TABLE `login_users` ADD `telegram_id` text;
