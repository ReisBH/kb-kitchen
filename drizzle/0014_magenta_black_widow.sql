CREATE TABLE `configuracoes_supervisao` (
	`id` int AUTO_INCREMENT NOT NULL,
	`desvioInventarioCriticoPct` decimal(6,3) NOT NULL DEFAULT '5.000',
	`alertaValidadeDias` int NOT NULL DEFAULT 2,
	`relatorioHoraLisboa` varchar(5) NOT NULL DEFAULT '08:00',
	`schedule_cron_task_uid` varchar(65),
	`ativo` boolean NOT NULL DEFAULT true,
	`atualizadoPor` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuracoes_supervisao_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificacoes_operacionais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`utilizadorId` int NOT NULL,
	`tipo` enum('aprovacao_pendente','validade_proxima','lote_expirado','relatorio_diario') NOT NULL,
	`severidade` enum('informacao','atencao','critica') NOT NULL DEFAULT 'informacao',
	`titulo` varchar(255) NOT NULL,
	`mensagem` text NOT NULL,
	`url` varchar(255),
	`chaveDedupe` varchar(120) NOT NULL,
	`lidaEm` timestamp,
	`emailEnviadoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notificacoes_operacionais_id` PRIMARY KEY(`id`),
	CONSTRAINT `notificacao_dedupe_idx` UNIQUE(`utilizadorId`,`chaveDedupe`)
);
--> statement-breakpoint
CREATE TABLE `relatorios_operacionais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('diario_validade_desperdicio') NOT NULL,
	`dataReferencia` date NOT NULL,
	`conteudo` text NOT NULL,
	`enviadoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `relatorios_operacionais_id` PRIMARY KEY(`id`),
	CONSTRAINT `relatorio_tipo_data_idx` UNIQUE(`tipo`,`dataReferencia`)
);
--> statement-breakpoint
CREATE INDEX `supervisao_schedule_idx` ON `configuracoes_supervisao` (`schedule_cron_task_uid`);--> statement-breakpoint
CREATE INDEX `notificacao_utilizador_idx` ON `notificacoes_operacionais` (`utilizadorId`);--> statement-breakpoint
CREATE INDEX `notificacao_lida_idx` ON `notificacoes_operacionais` (`lidaEm`);