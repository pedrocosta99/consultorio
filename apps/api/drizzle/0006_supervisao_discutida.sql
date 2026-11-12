ALTER TABLE `notas` ADD `supervisao_texto` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `notas` ADD `supervisao_em` text;--> statement-breakpoint
-- A busca passa a achar também o que foi discutido em supervisão.
DROP TRIGGER IF EXISTS `notas_fts_ins`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `notas_fts_upd`;
--> statement-breakpoint
CREATE TRIGGER `notas_fts_ins` AFTER INSERT ON `notas` BEGIN
	INSERT INTO `busca_fts` (`origem`, `ref_id`, `paciente_id`, `texto`, `tags`) VALUES ('nota', new.`id`, new.`paciente_id`, new.`texto` || char(10) || new.`supervisao_texto`, new.`tags`);
END;
--> statement-breakpoint
CREATE TRIGGER `notas_fts_upd` AFTER UPDATE OF `texto`, `tags`, `paciente_id`, `supervisao_texto` ON `notas` BEGIN
	DELETE FROM `busca_fts` WHERE `origem` = 'nota' AND `ref_id` = old.`id`;
	INSERT INTO `busca_fts` (`origem`, `ref_id`, `paciente_id`, `texto`, `tags`) VALUES ('nota', new.`id`, new.`paciente_id`, new.`texto` || char(10) || new.`supervisao_texto`, new.`tags`);
END;
