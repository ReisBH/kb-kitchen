CREATE TABLE `aprovacoes_operacionais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('producao','inventario','estorno_movimento','descarte_lote') NOT NULL,
	`entidadeId` int NOT NULL,
	`estado` enum('pendente','aprovada','rejeitada','cancelada') NOT NULL DEFAULT 'pendente',
	`solicitadoPor` int NOT NULL,
	`decididoPor` int,
	`motivo` text,
	`decisaoMotivo` text,
	`decididoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aprovacoes_operacionais_id` PRIMARY KEY(`id`),
	CONSTRAINT `aprovacao_entidade_unica_idx` UNIQUE(`tipo`,`entidadeId`)
);
--> statement-breakpoint
ALTER TABLE `producoes` ADD `estado` enum('pendente_aprovacao','aprovada','rejeitada') DEFAULT 'pendente_aprovacao' NOT NULL;--> statement-breakpoint
ALTER TABLE `producoes` ADD `idCliente` varchar(64);--> statement-breakpoint
ALTER TABLE `producoes` ADD `loteId` int;--> statement-breakpoint
ALTER TABLE `producoes` ADD `metodoConservacao` enum('vacuo','refrigerado','congelado','ambiente');--> statement-breakpoint
ALTER TABLE `producoes` ADD `dataValidade` date;--> statement-breakpoint
ALTER TABLE `producoes` ADD `notas` text;--> statement-breakpoint
ALTER TABLE `producoes` ADD CONSTRAINT `producoes_idCliente_unique` UNIQUE(`idCliente`);--> statement-breakpoint
CREATE INDEX `aprovacao_estado_idx` ON `aprovacoes_operacionais` (`estado`);--> statement-breakpoint
CREATE INDEX `aprovacao_solicitante_idx` ON `aprovacoes_operacionais` (`solicitadoPor`);--> statement-breakpoint
CREATE INDEX `producoes_estado_idx` ON `producoes` (`estado`);
--> statement-breakpoint
-- Produções anteriores à aprovação em dois níveis já tinham movimentos de stock.
-- São apenas classificadas como históricas aprovadas; não criam lote nem movimentos novos.
UPDATE `producoes` SET `estado` = 'aprovada' WHERE `idCliente` IS NULL;
--> statement-breakpoint
INSERT INTO `aprovacoes_operacionais` (`tipo`, `entidadeId`, `estado`, `solicitadoPor`, `decisaoMotivo`, `decididoEm`)
SELECT 'producao', p.`id`, 'aprovada', p.`utilizadorId`, 'Produção histórica anterior ao fluxo de aprovação em dois níveis.', p.`createdAt`
FROM `producoes` p
WHERE p.`idCliente` IS NULL;
