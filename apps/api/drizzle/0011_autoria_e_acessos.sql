CREATE TABLE `acessos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`consultorio_id` text NOT NULL,
	`usuario_id` text NOT NULL,
	`acao` text NOT NULL,
	`paciente_id` text,
	`em` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `acessos_em` ON `acessos` (`consultorio_id`,`em`);--> statement-breakpoint
ALTER TABLE `notas` ADD `criado_por` text;--> statement-breakpoint
ALTER TABLE `notas` ADD `atualizado_por` text;--> statement-breakpoint
ALTER TABLE `pacientes` ADD `atualizado_em` text;--> statement-breakpoint
ALTER TABLE `pacientes` ADD `criado_por` text;--> statement-breakpoint
ALTER TABLE `pacientes` ADD `atualizado_por` text;--> statement-breakpoint
ALTER TABLE `pagamentos` ADD `atualizado_em` text;--> statement-breakpoint
ALTER TABLE `pagamentos` ADD `criado_por` text;--> statement-breakpoint
ALTER TABLE `pagamentos` ADD `atualizado_por` text;--> statement-breakpoint
ALTER TABLE `sessoes` ADD `atualizado_em` text;--> statement-breakpoint
ALTER TABLE `sessoes` ADD `criado_por` text;--> statement-breakpoint
ALTER TABLE `sessoes` ADD `atualizado_por` text;--> statement-breakpoint
-- O que já existe foi feito pelo usuário local (sessões da grade ficam sem autor: foi o sistema).
UPDATE `pacientes` SET `criado_por` = 'u_local', `atualizado_em` = `criado_em`;
--> statement-breakpoint
UPDATE `pagamentos` SET `criado_por` = 'u_local', `atualizado_em` = `criado_em`;
--> statement-breakpoint
UPDATE `notas` SET `criado_por` = 'u_local';
--> statement-breakpoint
UPDATE `sessoes` SET `atualizado_em` = `criado_em`, `criado_por` = CASE WHEN `contrato_id` IS NULL THEN 'u_local' END;
