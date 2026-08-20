ALTER TABLE `inventarios` ADD `idCliente` varchar(64);--> statement-breakpoint
ALTER TABLE `vendas` ADD `idCliente` varchar(64);--> statement-breakpoint
ALTER TABLE `inventarios` ADD `idCliente` varchar(64);--> statement-breakpoint
ALTER TABLE `inventarios` ADD CONSTRAINT `inventarios_idCliente_unique` UNIQUE(`idCliente`);--> statement-breakpoint
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_documentoOcrId_unique` UNIQUE(`documentoOcrId`);--> statement-breakpoint
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_idCliente_unique` UNIQUE(`idCliente`);--> statement-breakpoint
CREATE INDEX `vendas_idcliente_idx` ON `vendas` (`idCliente`);
