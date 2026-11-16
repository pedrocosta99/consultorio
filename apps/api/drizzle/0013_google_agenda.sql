CREATE TABLE `eventos_agenda` (
	`integracao_id` text NOT NULL,
	`origem` text NOT NULL,
	`origem_id` text NOT NULL,
	`google_evento_id` text NOT NULL,
	`etag` text,
	`sincronizado_em` text NOT NULL,
	PRIMARY KEY(`integracao_id`, `origem`, `origem_id`),
	FOREIGN KEY (`integracao_id`) REFERENCES `integracoes_google`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fila_saida` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`origem` text NOT NULL,
	`origem_id` text NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`processado_em` text,
	`tentativas` integer DEFAULT 0 NOT NULL,
	`erro` text
);
--> statement-breakpoint
CREATE INDEX `fila_saida_pendentes` ON `fila_saida` (`processado_em`,`id`);--> statement-breakpoint
CREATE TABLE `integracoes_google` (
	`id` text PRIMARY KEY NOT NULL,
	`consultorio_id` text NOT NULL,
	`usuario_id` text NOT NULL,
	`email_google` text NOT NULL,
	`calendario_id` text NOT NULL,
	`calendario_nome` text NOT NULL,
	`refresh_token_cifrado` text,
	`titulo_sessao` text DEFAULT 'iniciais' NOT NULL,
	`simulada` integer DEFAULT true NOT NULL,
	`ultimo_sync_em` text,
	`erro` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integracoes_google_pessoa` ON `integracoes_google` (`consultorio_id`,`usuario_id`);--> statement-breakpoint
-- Fila de saída para o Google Agenda: só enfileira se houver agenda conectada.
CREATE TRIGGER `fila_sessoes_ins` AFTER INSERT ON `sessoes` WHEN EXISTS (SELECT 1 FROM `integracoes_google`) BEGIN
	INSERT INTO `fila_saida` (`origem`, `origem_id`) VALUES ('sessao', new.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `fila_sessoes_upd` AFTER UPDATE OF `inicio`, `duracao_min`, `estado`, `paciente_id` ON `sessoes` WHEN EXISTS (SELECT 1 FROM `integracoes_google`) BEGIN
	INSERT INTO `fila_saida` (`origem`, `origem_id`) VALUES ('sessao', new.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `fila_sessoes_del` AFTER DELETE ON `sessoes` WHEN EXISTS (SELECT 1 FROM `integracoes_google`) BEGIN
	INSERT INTO `fila_saida` (`origem`, `origem_id`) VALUES ('sessao', old.`id`);
END;
--> statement-breakpoint
-- Trocar o apelido muda o título das sessões futuras no Google.
CREATE TRIGGER `fila_pacientes_apelido` AFTER UPDATE OF `apelido` ON `pacientes` WHEN EXISTS (SELECT 1 FROM `integracoes_google`) BEGIN
	INSERT INTO `fila_saida` (`origem`, `origem_id`)
	SELECT 'sessao', `id` FROM `sessoes` WHERE `paciente_id` = new.`id` AND `inicio` >= strftime('%Y-%m-%dT%H:%M:%fZ','now');
END;
--> statement-breakpoint
CREATE TRIGGER `fila_compromissos_ins` AFTER INSERT ON `compromissos` WHEN EXISTS (SELECT 1 FROM `integracoes_google`) BEGIN
	INSERT INTO `fila_saida` (`origem`, `origem_id`) VALUES ('compromisso', new.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `fila_compromissos_upd` AFTER UPDATE ON `compromissos` WHEN EXISTS (SELECT 1 FROM `integracoes_google`) BEGIN
	INSERT INTO `fila_saida` (`origem`, `origem_id`) VALUES ('compromisso', new.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `fila_compromissos_del` AFTER DELETE ON `compromissos` WHEN EXISTS (SELECT 1 FROM `integracoes_google`) BEGIN
	INSERT INTO `fila_saida` (`origem`, `origem_id`) VALUES ('compromisso', old.`id`);
END;
--> statement-breakpoint
CREATE TRIGGER `fila_excecoes_ins` AFTER INSERT ON `compromissos_excecoes` WHEN EXISTS (SELECT 1 FROM `integracoes_google`) BEGIN
	INSERT INTO `fila_saida` (`origem`, `origem_id`) VALUES ('compromisso', new.`compromisso_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `fila_excecoes_upd` AFTER UPDATE ON `compromissos_excecoes` WHEN EXISTS (SELECT 1 FROM `integracoes_google`) BEGIN
	INSERT INTO `fila_saida` (`origem`, `origem_id`) VALUES ('compromisso', new.`compromisso_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `fila_excecoes_del` AFTER DELETE ON `compromissos_excecoes` WHEN EXISTS (SELECT 1 FROM `integracoes_google`) BEGIN
	INSERT INTO `fila_saida` (`origem`, `origem_id`) VALUES ('compromisso', old.`compromisso_id`);
END;
