CREATE TABLE `contas_pagar` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentoOcrId` int NOT NULL,
	`fornecedorId` int,
	`fornecedorNome` varchar(255) NOT NULL,
	`nifFornecedor` varchar(32),
	`numeroFatura` varchar(100),
	`dataEmissao` date,
	`dataVencimento` date,
	`condicoesPagamento` varchar(255),
	`valorTotal` decimal(12,2) NOT NULL,
	`estadoPagamento` enum('pendente','paga') NOT NULL DEFAULT 'pendente',
	`pagoEm` timestamp,
	`utilizadorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contas_pagar_id` PRIMARY KEY(`id`),
	CONSTRAINT `contas_pagar_documentoOcrId_unique` UNIQUE(`documentoOcrId`)
);
--> statement-breakpoint
CREATE INDEX `cp_vencimento_idx` ON `contas_pagar` (`dataVencimento`);--> statement-breakpoint
CREATE INDEX `cp_estado_idx` ON `contas_pagar` (`estadoPagamento`);--> statement-breakpoint
CREATE INDEX `cp_fornecedor_idx` ON `contas_pagar` (`fornecedorId`);