CREATE TABLE `compromissos` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo` text NOT NULL,
	`titulo` text NOT NULL,
	`categoria` text NOT NULL,
	`inicio` text NOT NULL,
	`duracao_min` integer NOT NULL,
	`fuso` text NOT NULL,
	`recorrencia` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `compromissos_inicio` ON `compromissos` (`inicio`);--> statement-breakpoint
CREATE TABLE `compromissos_excecoes` (
	`compromisso_id` text NOT NULL,
	`data` text NOT NULL,
	`cancelado` integer DEFAULT false NOT NULL,
	`inicio` text,
	`duracao_min` integer,
	`titulo` text,
	PRIMARY KEY(`compromisso_id`, `data`),
	FOREIGN KEY (`compromisso_id`) REFERENCES `compromissos`(`id`) ON UPDATE no action ON DELETE cascade
);
