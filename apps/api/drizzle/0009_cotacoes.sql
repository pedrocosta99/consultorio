CREATE TABLE `cotacoes` (
	`data` text NOT NULL,
	`moeda` text NOT NULL,
	`taxa` integer NOT NULL,
	`fonte` text NOT NULL,
	PRIMARY KEY(`data`, `moeda`)
);
