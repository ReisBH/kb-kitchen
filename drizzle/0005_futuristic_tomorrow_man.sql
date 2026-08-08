CREATE TABLE `lotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoLote` varchar(10) NOT NULL,
	`artigoId` int,
	`fichaId` int,
	`quantidadeProduzida` decimal(12,3) NOT NULL,
	`quantidadeRestante` decimal(12,3) NOT NULL,
	`unidade` varchar(20) NOT NULL,
	`dataProducao` timestamp NOT NULL DEFAULT (now()),
	`dataValidade` date,
	`metodoConservacao` enum('vacuo','refrigerado','congelado','ambiente') NOT NULL,
	`estado` enum('ativo','esgotado','expirado','descartado') NOT NULL DEFAULT 'ativo',
	`utilizadorId` int,
	`descongelado` boolean NOT NULL DEFAULT false,
	`ingredientesUsados` text,
	`producaoId` int,
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `lotes_codigoLote_unique` UNIQUE(`codigoLote`)
);
--> statement-breakpoint
CREATE TABLE `regras_validade` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artigoId` int,
	`fichaId` int,
	`metodoConservacao` enum('vacuo','refrigerado','congelado','ambiente') NOT NULL,
	`diasValidade` int NOT NULL,
	`criadoPor` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `regras_validade_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessoes_pin_qr` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`revogadaEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessoes_pin_qr_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessoes_pin_qr_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `artigos` ADD `codigoCurto` varchar(8);--> statement-breakpoint
ALTER TABLE `movimentos` ADD `idCliente` varchar(64);--> statement-breakpoint
ALTER TABLE `movimentos` ADD `origem` enum('manual','qr','fatura','fecho_caixa','inventario','producao','sistema') DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `movimentos` ADD `anuladoEm` timestamp;--> statement-breakpoint
ALTER TABLE `movimentos` ADD `anuladoPorMovimentoId` int;--> statement-breakpoint
ALTER TABLE `artigos` ADD CONSTRAINT `artigos_codigoCurto_unique` UNIQUE(`codigoCurto`);--> statement-breakpoint
ALTER TABLE `movimentos` ADD CONSTRAINT `movimentos_idCliente_unique` UNIQUE(`idCliente`);--> statement-breakpoint
CREATE INDEX `lotes_artigo_idx` ON `lotes` (`artigoId`);--> statement-breakpoint
CREATE INDEX `lotes_codigo_idx` ON `lotes` (`codigoLote`);--> statement-breakpoint
CREATE INDEX `lotes_estado_idx` ON `lotes` (`estado`);--> statement-breakpoint
CREATE INDEX `lotes_validade_idx` ON `lotes` (`dataValidade`);--> statement-breakpoint
CREATE INDEX `rv_artigo_idx` ON `regras_validade` (`artigoId`);--> statement-breakpoint
CREATE INDEX `spq_user_idx` ON `sessoes_pin_qr` (`userId`);--> statement-breakpoint
CREATE INDEX `spq_token_idx` ON `sessoes_pin_qr` (`tokenHash`);--> statement-breakpoint
CREATE INDEX `artigos_codigo_curto_idx` ON `artigos` (`codigoCurto`);--> statement-breakpoint
CREATE INDEX `movimentos_idcliente_idx` ON `movimentos` (`idCliente`);