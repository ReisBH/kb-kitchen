ALTER TABLE `fichas_tecnicas` ADD `unidadePrecoVenda` enum('dose','un','pessoa','g') DEFAULT 'dose' NOT NULL;--> statement-breakpoint
ALTER TABLE `fichas_tecnicas` ADD `unidadePrecoVenda` enum('dose','un','pessoa','g') NOT NULL DEFAULT 'dose';
ALTER TABLE `fichas_tecnicas` ADD `quantidadeMinimaVenda` decimal(10,3);
