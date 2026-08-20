ALTER TABLE `testes_rendimento` ADD `idCliente` varchar(64);--> statement-breakpoint
ALTER TABLE `testes_rendimento` ADD COLUMN `idCliente` varchar(64);--> statement-breakpoint
ALTER TABLE `testes_rendimento` ADD CONSTRAINT `testes_rendimento_idCliente_unique` UNIQUE(`idCliente`);--> statement-breakpoint
CREATE INDEX `testes_idcliente_idx` ON `testes_rendimento` (`idCliente`);
