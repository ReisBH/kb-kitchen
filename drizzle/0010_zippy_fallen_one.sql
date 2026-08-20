ALTER TABLE `movimentos` ADD `loteId` int;--> statement-breakpoint
ALTER TABLE `movimentos` ADD `loteId` int;--> statement-breakpoint
CREATE INDEX `movimentos_lote_idx` ON `movimentos` (`loteId`);
