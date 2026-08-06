CREATE TABLE `credenciais_locais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`ativo` boolean NOT NULL DEFAULT true,
	`deveAlterarSenha` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credenciais_locais_id` PRIMARY KEY(`id`),
	CONSTRAINT `credenciais_locais_username_unique` UNIQUE(`username`)
);
