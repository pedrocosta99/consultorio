-- Busca de texto completo (FTS5) em notas e pontos fixos.
-- unicode61 + remove_diacritics 2: "lírio" acha "lirio" e vice-versa.
CREATE VIRTUAL TABLE `busca_fts` USING fts5(
	`origem` UNINDEXED,
	`ref_id` UNINDEXED,
	`paciente_id` UNINDEXED,
	`texto`,
	`tags`,
	tokenize = 'unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `notas_fts_ins` AFTER INSERT ON `notas` BEGIN
	INSERT INTO `busca_fts` (`origem`, `ref_id`, `paciente_id`, `texto`, `tags`) VALUES ('nota', new.`id`, new.`paciente_id`, new.`texto`, new.`tags`);
END;
--> statement-breakpoint
CREATE TRIGGER `notas_fts_upd` AFTER UPDATE OF `texto`, `tags`, `paciente_id` ON `notas` BEGIN
	DELETE FROM `busca_fts` WHERE `origem` = 'nota' AND `ref_id` = old.`id`;
	INSERT INTO `busca_fts` (`origem`, `ref_id`, `paciente_id`, `texto`, `tags`) VALUES ('nota', new.`id`, new.`paciente_id`, new.`texto`, new.`tags`);
END;
--> statement-breakpoint
CREATE TRIGGER `notas_fts_del` AFTER DELETE ON `notas` BEGIN
	DELETE FROM `busca_fts` WHERE `origem` = 'nota' AND `ref_id` = old.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `pacientes_fts_ins` AFTER INSERT ON `pacientes` BEGIN
	INSERT INTO `busca_fts` (`origem`, `ref_id`, `paciente_id`, `texto`, `tags`) VALUES ('fixos', new.`id`, new.`id`, new.`pontos_fixos`, '');
END;
--> statement-breakpoint
CREATE TRIGGER `pacientes_fts_upd` AFTER UPDATE OF `pontos_fixos` ON `pacientes` BEGIN
	DELETE FROM `busca_fts` WHERE `origem` = 'fixos' AND `ref_id` = old.`id`;
	INSERT INTO `busca_fts` (`origem`, `ref_id`, `paciente_id`, `texto`, `tags`) VALUES ('fixos', new.`id`, new.`id`, new.`pontos_fixos`, '');
END;
--> statement-breakpoint
CREATE TRIGGER `pacientes_fts_del` AFTER DELETE ON `pacientes` BEGIN
	DELETE FROM `busca_fts` WHERE `paciente_id` = old.`id`;
END;
--> statement-breakpoint
-- Indexa o que já existe.
INSERT INTO `busca_fts` (`origem`, `ref_id`, `paciente_id`, `texto`, `tags`) SELECT 'fixos', `id`, `id`, `pontos_fixos`, '' FROM `pacientes`;
--> statement-breakpoint
INSERT INTO `busca_fts` (`origem`, `ref_id`, `paciente_id`, `texto`, `tags`) SELECT 'nota', `id`, `paciente_id`, `texto`, `tags` FROM `notas`;
