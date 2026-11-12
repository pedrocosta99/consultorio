CREATE TABLE `lancamentos` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`tipo` text NOT NULL,
	`descricao` text NOT NULL,
	`valor_centavos` integer NOT NULL,
	`moeda` text NOT NULL,
	`categoria` text NOT NULL,
	`fixo` integer DEFAULT false NOT NULL,
	`serie_id` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lancamentos_data` ON `lancamentos` (`data`);--> statement-breakpoint
CREATE INDEX `lancamentos_serie` ON `lancamentos` (`serie_id`);