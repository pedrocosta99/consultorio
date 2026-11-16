CREATE TABLE `configuracoes` (
	`consultorio_id` text PRIMARY KEY NOT NULL,
	`moedas` text DEFAULT '[]' NOT NULL,
	`mensagens` text,
	`horario_atendimento` text,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`consultorio_id`) REFERENCES `consultorios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `consultorios` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`fuso` text NOT NULL,
	`moeda_principal` text DEFAULT 'BRL' NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `membros` (
	`consultorio_id` text NOT NULL,
	`usuario_id` text NOT NULL,
	`papel` text NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	PRIMARY KEY(`consultorio_id`, `usuario_id`),
	FOREIGN KEY (`consultorio_id`) REFERENCES `consultorios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` text PRIMARY KEY NOT NULL,
	`uid_externo` text,
	`nome` text NOT NULL,
	`email` text NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_email` ON `usuarios` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_uid` ON `usuarios` (`uid_externo`);--> statement-breakpoint
-- Versão local: um consultório, um usuário (dono) e as configurações que estavam no meta_sistema.
INSERT INTO `consultorios` (`id`, `nome`, `fuso`, `moeda_principal`) VALUES ('cons_local', 'Meu consultório', 'America/Sao_Paulo', 'BRL');
--> statement-breakpoint
INSERT INTO `usuarios` (`id`, `nome`, `email`) VALUES ('u_local', 'Você', 'local@consultorio.invalid');
--> statement-breakpoint
INSERT INTO `membros` (`consultorio_id`, `usuario_id`, `papel`) VALUES ('cons_local', 'u_local', 'dono');
--> statement-breakpoint
INSERT INTO `configuracoes` (`consultorio_id`, `moedas`, `mensagens`, `horario_atendimento`) VALUES (
  'cons_local',
  COALESCE((SELECT `valor` FROM `meta_sistema` WHERE `chave` = 'moedas_ativas'), '[]'),
  (SELECT `valor` FROM `meta_sistema` WHERE `chave` = 'mensagens'),
  (SELECT `valor` FROM `meta_sistema` WHERE `chave` = 'horario_atendimento')
);
--> statement-breakpoint
DELETE FROM `meta_sistema` WHERE `chave` IN ('moedas_ativas', 'mensagens', 'horario_atendimento');
