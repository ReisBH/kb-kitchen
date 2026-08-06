CREATE TABLE `aliases_fornecedor` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fornecedorId` int,
	`alias` varchar(255) NOT NULL,
	`artigoId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aliases_fornecedor_id` PRIMARY KEY(`id`),
	CONSTRAINT `af_alias_fornecedor_idx` UNIQUE(`alias`,`fornecedorId`)
);
--> statement-breakpoint
CREATE TABLE `artigos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`tipo` enum('ingrediente','proteina_limpa','receita_base') NOT NULL,
	`categoria` varchar(100),
	`unidadeBase` varchar(20) NOT NULL,
	`unidadeCompra` varchar(20),
	`fatorConversao` decimal(12,6) DEFAULT '1',
	`densidade` decimal(10,4),
	`stockMinimo` decimal(12,3) DEFAULT '0',
	`stockMaximo` decimal(12,3),
	`pontoEncomenda` decimal(12,3),
	`custoMedioPonderado` decimal(12,6) DEFAULT '0',
	`fornecedorId` int,
	`prazoEntregaDias` int DEFAULT 1,
	`perecivel` boolean NOT NULL DEFAULT false,
	`validadeDias` int,
	`ativo` boolean NOT NULL DEFAULT true,
	`alergenios` int DEFAULT 0,
	`artigoBrutoId` int,
	`rendimentoEsperado` decimal(12,3),
	`validadeProducaoDias` int,
	`tempoPrepMin` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `artigos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documentos_ocr` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('fatura','fecho_caixa') NOT NULL,
	`estado` enum('pendente','extraido','em_revisao','confirmado','erro') NOT NULL DEFAULT 'pendente',
	`imagemUrl` text,
	`imagemKey` text,
	`dadosExtraidos` text,
	`fornecedorId` int,
	`dataDocumento` timestamp,
	`numeroDocumento` varchar(100),
	`vendaId` int,
	`utilizadorId` int,
	`erroMsg` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documentos_ocr_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fichas_tecnicas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`secaoMenu` varchar(100),
	`precoVenda` decimal(10,2),
	`foodCostAlvo` decimal(5,2),
	`tempoPrepMin` int,
	`fotoUrl` text,
	`modoPreparacao` text,
	`alergenios` int DEFAULT 0,
	`ativo` boolean NOT NULL DEFAULT true,
	`explodir_receitas` enum('auto','sempre','nunca') DEFAULT 'auto',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fichas_tecnicas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fichas_tecnicas_componentes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fichaId` int NOT NULL,
	`componenteId` int NOT NULL,
	`quantidade` decimal(12,4) NOT NULL,
	`unidade` varchar(20) NOT NULL,
	`ordem` int DEFAULT 0,
	CONSTRAINT `fichas_tecnicas_componentes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fornecedores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`nif` varchar(20),
	`email` varchar(320),
	`telefone` varchar(30),
	`morada` text,
	`envioAutomatico` boolean NOT NULL DEFAULT false,
	`horaEnvio` varchar(5) DEFAULT '08:00',
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fornecedores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventario_linhas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inventarioId` int NOT NULL,
	`artigoId` int NOT NULL,
	`stockTeorico` decimal(12,3),
	`stockReal` decimal(12,3),
	`desvioQtd` decimal(12,3),
	`desvioValor` decimal(12,4),
	`desvioPct` decimal(6,3),
	`ajusteMovimentoId` int,
	CONSTRAINT `inventario_linhas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255),
	`zona` varchar(100),
	`estado` enum('em_curso','fechado') NOT NULL DEFAULT 'em_curso',
	`utilizadorId` int,
	`fechadoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mapa_pos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nomePos` varchar(255) NOT NULL,
	`fichaId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mapa_pos_id` PRIMARY KEY(`id`),
	CONSTRAINT `mapa_pos_nomePos_unique` UNIQUE(`nomePos`)
);
--> statement-breakpoint
CREATE TABLE `movimentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artigoId` int NOT NULL,
	`tipo` enum('entrada_compra','producao_consumo','producao_entrada','venda_consumo','quebra','transformacao_saida','transformacao_entrada','ajuste_inventario') NOT NULL,
	`quantidade` decimal(12,3) NOT NULL,
	`custoUnitario` decimal(12,6) NOT NULL,
	`custoMedioApos` decimal(12,6),
	`stockApos` decimal(12,3),
	`documentoId` varchar(64),
	`documentoTipo` varchar(50),
	`motivo` text,
	`utilizadorId` int,
	`dataMovimento` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `movimentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notas_encomenda` (
	`id` int AUTO_INCREMENT NOT NULL,
	`numero` varchar(30) NOT NULL,
	`fornecedorId` int NOT NULL,
	`estado` enum('rascunho','aprovada','enviada','recebida') NOT NULL DEFAULT 'rascunho',
	`dataEntregaPretendida` timestamp,
	`enviadaEm` timestamp,
	`recebidaEm` timestamp,
	`utilizadorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notas_encomenda_id` PRIMARY KEY(`id`),
	CONSTRAINT `notas_encomenda_numero_unique` UNIQUE(`numero`)
);
--> statement-breakpoint
CREATE TABLE `notas_encomenda_linhas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notaId` int NOT NULL,
	`artigoId` int NOT NULL,
	`quantidade` decimal(12,3) NOT NULL,
	`unidade` varchar(20) NOT NULL,
	`precoEstimado` decimal(10,4),
	CONSTRAINT `notas_encomenda_linhas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `producoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receitaId` int NOT NULL,
	`quantidadeProduzida` decimal(12,3) NOT NULL,
	`rendimentoReal` decimal(12,3),
	`rendimentoEsperado` decimal(12,3),
	`desvioPct` decimal(6,3),
	`custoLote` decimal(12,4),
	`utilizadorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `producoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `receitas_base_componentes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receitaId` int NOT NULL,
	`componenteId` int NOT NULL,
	`quantidade` decimal(12,4) NOT NULL,
	`unidade` varchar(20) NOT NULL,
	`ordem` int DEFAULT 0,
	CONSTRAINT `receitas_base_componentes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `testes_rendimento` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artigoId` int NOT NULL,
	`artigoLimpoId` int,
	`pesoBruto` decimal(10,3) NOT NULL,
	`pesoLimpo` decimal(10,3) NOT NULL,
	`pesoAparas` decimal(10,3) DEFAULT '0',
	`valorAparas` decimal(10,4) DEFAULT '0',
	`pesoDesperdicio` decimal(10,3) DEFAULT '0',
	`precoKgBruto` decimal(10,4) NOT NULL,
	`aproveitamentoPct` decimal(6,3),
	`perdaPct` decimal(6,3),
	`custoRealPorKg` decimal(12,4),
	`sobrecusto` decimal(12,4),
	`movimentoSaidaId` int,
	`movimentoEntradaId` int,
	`utilizadorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `testes_rendimento_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `venda_linhas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendaId` int NOT NULL,
	`fichaId` int NOT NULL,
	`quantidade` decimal(10,3) NOT NULL,
	`precoUnitario` decimal(10,2),
	`custoUnitario` decimal(10,4),
	CONSTRAINT `venda_linhas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vendas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`data` timestamp NOT NULL,
	`origem` enum('manual','ocr_pos') NOT NULL DEFAULT 'manual',
	`documentoOcrId` int,
	`totalReceita` decimal(12,2),
	`custoTotal` decimal(12,4),
	`foodCostPct` decimal(6,3),
	`processada` boolean NOT NULL DEFAULT false,
	`utilizadorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vendas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `artigos_tipo_idx` ON `artigos` (`tipo`);--> statement-breakpoint
CREATE INDEX `artigos_fornecedor_idx` ON `artigos` (`fornecedorId`);--> statement-breakpoint
CREATE INDEX `ftc_ficha_idx` ON `fichas_tecnicas_componentes` (`fichaId`);--> statement-breakpoint
CREATE INDEX `ftc_componente_idx` ON `fichas_tecnicas_componentes` (`componenteId`);--> statement-breakpoint
CREATE INDEX `il_inventario_idx` ON `inventario_linhas` (`inventarioId`);--> statement-breakpoint
CREATE INDEX `movimentos_artigo_idx` ON `movimentos` (`artigoId`);--> statement-breakpoint
CREATE INDEX `movimentos_tipo_idx` ON `movimentos` (`tipo`);--> statement-breakpoint
CREATE INDEX `movimentos_data_idx` ON `movimentos` (`dataMovimento`);--> statement-breakpoint
CREATE INDEX `movimentos_documento_idx` ON `movimentos` (`documentoId`);--> statement-breakpoint
CREATE INDEX `ne_fornecedor_idx` ON `notas_encomenda` (`fornecedorId`);--> statement-breakpoint
CREATE INDEX `nel_nota_idx` ON `notas_encomenda_linhas` (`notaId`);--> statement-breakpoint
CREATE INDEX `producoes_receita_idx` ON `producoes` (`receitaId`);--> statement-breakpoint
CREATE INDEX `rbc_receita_idx` ON `receitas_base_componentes` (`receitaId`);--> statement-breakpoint
CREATE INDEX `rbc_componente_idx` ON `receitas_base_componentes` (`componenteId`);--> statement-breakpoint
CREATE INDEX `testes_artigo_idx` ON `testes_rendimento` (`artigoId`);--> statement-breakpoint
CREATE INDEX `vl_venda_idx` ON `venda_linhas` (`vendaId`);--> statement-breakpoint
CREATE INDEX `vendas_data_idx` ON `vendas` (`data`);