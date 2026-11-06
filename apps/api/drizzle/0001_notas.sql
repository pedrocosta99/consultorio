CREATE TABLE `notas` (
	`id` text PRIMARY KEY NOT NULL,
	`paciente_id` text NOT NULL,
	`sessao_id` text,
	`tipo` text NOT NULL,
	`texto` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`levar_supervisao` integer DEFAULT false NOT NULL,
	`natureza` text NOT NULL,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`atualizado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`paciente_id`) REFERENCES `pacientes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sessao_id`) REFERENCES `sessoes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `notas_paciente` ON `notas` (`paciente_id`);--> statement-breakpoint
CREATE INDEX `notas_sessao` ON `notas` (`sessao_id`);