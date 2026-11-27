ALTER TABLE `calibrations` ADD `source` text DEFAULT 'bluetooth' NOT NULL;--> statement-breakpoint
ALTER TABLE `calibrations` ADD `band_name` text;