CREATE TABLE `utilizadores_autorizados` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64),
	`email` varchar(320),
	`nome` varchar(255),
	`role` enum('admin','head_chef','sub_chefe','cozinheiro') NOT NULL,
	`ativo` boolean NOT NULL DEFAULT true,
	`notas` text,
	`criadoPor` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `utilizadores_autorizados_id` PRIMARY KEY(`id`),
	CONSTRAINT `utilizadores_autorizados_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','head_chef','sub_chefe','cozinheiro','user') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `ativo` boolean DEFAULT true NOT NULL;