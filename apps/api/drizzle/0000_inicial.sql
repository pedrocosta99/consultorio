CREATE TABLE `contas` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`instituicao` text NOT NULL,
	`pais` text NOT NULL,
	`moeda` text NOT NULL,
	`tipo` text NOT NULL,
	`ativa` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contratos` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`dias_semana` text NOT NULL,
	`horario` text NOT NULL,
	`duracao_min` integer NOT NULL,
	`valor_centavos` integer NOT NULL,
	`moeda` text NOT NULL,
	`cobranca` text NOT NULL,
	`politica_faltas` text DEFAULT '' NOT NULL,
	`vigente_de` text NOT NULL,
	`vigente_ate` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contratos_paciente` ON `contratos` (`paciente_id`);--> statement-breakpoint
CREATE TABLE `feriados` (
	`data` text PRIMARY KEY NOT NULL,
	`descricao` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meta_sistema` (
	`chave` text PRIMARY KEY NOT NULL,
	`valor` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pacientes` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`apelido` text NOT NULL,
	`contato` text,
	`origem` text NOT NULL,
	`modalidade` text NOT NULL,
	`status` text NOT NULL,
	`inicio_em` text NOT NULL,
	`fuso` text NOT NULL,
	`pontos_fixos` text DEFAULT '' NOT NULL,
	`arquivado_em` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pacientes_status` ON `pacientes` (`status`);--> statement-breakpoint
CREATE TABLE `pagamento_sessoes` (
	`pagamento_id` text NOT NULL,
	`sessao_id` text NOT NULL,
	PRIMARY KEY(`pagamento_id`, `sessao_id`),
	FOREIGN KEY (`pagamento_id`) REFERENCES `pagamentos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sessao_id`) REFERENCES `sessoes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pagamento_sessoes_sessao` ON `pagamento_sessoes` (`sessao_id`);--> statement-breakpoint
CREATE TABLE `pagamentos` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`valor_centavos` integer NOT NULL,
	`moeda` text NOT NULL,
	`data` text NOT NULL,
	`meio` text NOT NULL,
	`conta_id` text NOT NULL,
	`transacao_id` text,
	`observacao` text DEFAULT '' NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conta_id`) REFERENCES `contas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pagamentos_paciente` ON `pagamentos` (`paciente_id`);--> statement-breakpoint
CREATE TABLE `sessoes` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`contrato_id` text,
	`vaga` text,
	`inicio` text NOT NULL,
	`duracao_min` integer NOT NULL,
	`estado` text NOT NULL,
	`valor_centavos` integer NOT NULL,
	`moeda` text NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contrato_id`) REFERENCES `contratos`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sessoes_paciente` ON `sessoes` (`paciente_id`);--> statement-breakpoint
CREATE INDEX `sessoes_inicio` ON `sessoes` (`inicio`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessoes_vaga` ON `sessoes` (`contrato_id`,`vaga`);