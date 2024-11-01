CREATE TABLE `applicant_types` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`description` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `applicants` (
	`user_id` text NOT NULL,
	`application_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` integer,
	PRIMARY KEY(`user_id`, `application_id`),
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `application_validation_features` (
	`application_id` integer NOT NULL,
	`feature_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` integer,
	PRIMARY KEY(`application_id`, `feature_id`),
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`feature_id`) REFERENCES `validation_features`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `applications` (
	`id` integer PRIMARY KEY NOT NULL,
	`application_purpose` text NOT NULL,
	`form_id` integer NOT NULL,
	`parent_application_id` integer,
	`data` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `applications_additional_requests` (
	`id` integer PRIMARY KEY NOT NULL,
	`application_id` integer NOT NULL,
	`type` text(255) NOT NULL,
	`status` text NOT NULL,
	`response` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_trail` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text(255) NOT NULL,
	`entity_type` text(50) NOT NULL,
	`entity_id` integer NOT NULL,
	`details` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text(255) NOT NULL,
	`path` text(1024) NOT NULL,
	`mime_type` text(100) NOT NULL,
	`size` numeric NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `forms` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text(255) NOT NULL,
	`description` text,
	`purpose` text NOT NULL,
	`form_key` text NOT NULL,
	`dmn_key` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `form_additional_requests` (
	`id` integer PRIMARY KEY NOT NULL,
	`form_id` integer NOT NULL,
	`title` text(255) NOT NULL,
	`description` text,
	`type` text(255) NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `form_features_validation` (
	`form_id` integer NOT NULL,
	`feature_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` integer,
	PRIMARY KEY(`form_id`, `feature_id`),
	FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`feature_id`) REFERENCES `validation_features`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`purpose` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY NOT NULL,
	`application_id` integer NOT NULL,
	`reviewer_id` integer NOT NULL,
	`status` text NOT NULL,
	`comments` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users_roles` (
	`id` integer PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`user_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `validation_features` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`description` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `applicants__application_id_idx` ON `applicants` (`application_id`);--> statement-breakpoint
CREATE INDEX `applicants__user_id_idx` ON `applicants` (`user_id`);--> statement-breakpoint
CREATE INDEX `applicants__user_application_id_idx` ON `applicants` (`user_id`,`application_id`);--> statement-breakpoint
CREATE INDEX `applications__form_id_idx` ON `applications` (`form_id`);--> statement-breakpoint
CREATE INDEX `applications__parent_application_id_idx` ON `applications` (`parent_application_id`);--> statement-breakpoint
CREATE INDEX `applications__status_idx` ON `applications` (`status`);--> statement-breakpoint
CREATE INDEX `applications__purpose_idx` ON `applications` (`application_purpose`);