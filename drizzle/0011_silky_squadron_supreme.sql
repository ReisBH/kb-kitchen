ALTER TABLE `fichas_tecnicas` ADD `estadoPublicacao` enum('rascunho','em_revisao','publicada') DEFAULT 'rascunho' NOT NULL;--> statement-breakpoint
ALTER TABLE `fichas_tecnicas` ADD `estadoPublicacao` enum('rascunho','em_revisao','publicada') NOT NULL DEFAULT 'rascunho';--> statement-breakpoint
ALTER TABLE `fichas_tecnicas` ADD `publicadaEm` timestamp;--> statement-breakpoint
ALTER TABLE `fichas_tecnicas` ADD `publicadaPor` int;--> statement-breakpoint
ALTER TABLE `mapa_pos` ADD `ativo` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `mapa_pos` ADD `validadoEm` timestamp;--> statement-breakpoint
ALTER TABLE `mapa_pos` ADD `validadoPor` int;
--> statement-breakpoint
UPDATE `fichas_tecnicas` f SET f.`estadoPublicacao` = 'publicada'
WHERE f.`ativo` = 1 AND EXISTS (SELECT 1 FROM `fichas_tecnicas_componentes` c WHERE c.`fichaId` = f.`id`);
