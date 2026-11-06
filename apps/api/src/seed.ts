/**
 * Dados FICTÍCIOS para testar o app (os mesmos mocks da Etapa 0), gravados no banco.
 * Só é usado quando você escolhe "começar com dados fictícios" ou nos testes visuais.
 */
import { gerarMocks } from "@consultorio/shared";
import type { Db } from "./db/conexao";
import * as t from "./db/schema";
import { diaDaSemanaIso } from "./dominio/grade";
import { chaveDiaNoFuso, FUSO_CONSULTORIO } from "@consultorio/shared";

export function semearFicticio(db: Db, agora: Date) {
  const m = gerarMocks(agora);
  const contratoDoPaciente = new Map(m.contratos.map((k) => [k.pacienteId, k.id]));
  db.transaction((tx) => {
    for (const c of m.contas) tx.insert(t.contas).values(c).run();
    for (const p of m.pacientes) {
      tx.insert(t.pacientes)
        .values({ ...p, contato: p.contato ?? null, arquivadoEm: null })
        .run();
    }
    for (const k of m.contratos) {
      tx.insert(t.contratos)
        .values({
          id: k.id,
          pacienteId: k.pacienteId,
          diasSemana: k.diasSemana,
          horario: k.horario,
          duracaoMin: k.duracaoMin,
          valorCentavos: k.valor.centavos,
          moeda: k.valor.moeda,
          cobranca: k.cobranca,
          vigenteDe: k.vigenteDe,
          vigenteAte: k.vigenteAte,
        })
        .run();
    }
    for (const s of m.sessoes) {
      const dia = chaveDiaNoFuso(Date.parse(s.inicio), FUSO_CONSULTORIO);
      tx.insert(t.sessoes)
        .values({
          id: s.id,
          pacienteId: s.pacienteId,
          contratoId: contratoDoPaciente.get(s.pacienteId) ?? null,
          vaga: `${dia}#${diaDaSemanaIso(dia)}`,
          inicio: s.inicio,
          duracaoMin: s.duracaoMin,
          estado: s.estado,
          valorCentavos: s.valor.centavos,
          moeda: s.valor.moeda,
        })
        .run();
    }
    for (const pg of m.pagamentos) {
      tx.insert(t.pagamentos)
        .values({
          id: pg.id,
          pacienteId: pg.pacienteId,
          valorCentavos: pg.valor.centavos,
          moeda: pg.valor.moeda,
          data: pg.data,
          meio: pg.meio,
          contaId: pg.contaId,
        })
        .run();
      for (const sessaoId of pg.sessaoIds) tx.insert(t.pagamentoSessoes).values({ pagamentoId: pg.id, sessaoId }).run();
    }
  });
}
