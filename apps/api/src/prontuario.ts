/**
 * Prontuário do paciente em PDF (gerado aqui, sem serviço externo).
 * Por padrão inclui só o registro DOCUMENTAL; anotações pessoais só se pedidas.
 */
import { asc, eq } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import {
  FUSO_CONSULTORIO,
  formatarDinheiro,
  partesNoFuso,
  ROTULO_ESTADO,
  ROTULO_MODALIDADE,
  ROTULO_ORIGEM,
  ROTULO_STATUS,
  type EstadoSessao,
} from "@consultorio/shared";
import type { Db } from "./db/conexao";
import * as t from "./db/schema";
import { ErroDominio } from "./servico";

const A4 = { w: 595.28, h: 841.89 };
const MARGEM = 56;
const COR_TEXTO = rgb(0.13, 0.15, 0.13);
const COR_SUAVE = rgb(0.42, 0.45, 0.42);
const COR_LINHA = rgb(0.85, 0.86, 0.83);

const dataBr = (iso: string) => {
  const p = partesNoFuso(Date.parse(iso.length === 10 ? iso + "T12:00:00Z" : iso), FUSO_CONSULTORIO);
  return `${String(p.dia).padStart(2, "0")}/${String(p.mes + 1).padStart(2, "0")}/${p.ano}`;
};
const horaBr = (iso: string) => {
  const p = partesNoFuso(Date.parse(iso), FUSO_CONSULTORIO);
  return `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
};

/** Remove a marcação markdown (o PDF mostra texto corrido). */
function semMarkdown(s: string) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1$2")
    .replace(/_([^_\s][^_]*)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ");
}

class Escritor {
  pagina!: PDFPage;
  y = 0;
  private suportado = new Map<string, boolean>();
  constructor(
    private doc: PDFDocument,
    private fonte: PDFFont,
    private negrito: PDFFont,
  ) {
    this.novaPagina();
  }
  novaPagina() {
    this.pagina = this.doc.addPage([A4.w, A4.h]);
    this.y = A4.h - MARGEM;
  }
  /** Troca caracteres que a fonte padrão (WinAnsi) não tem. */
  limpar(s: string, f: PDFFont) {
    return [...s.normalize("NFC")]
      .map((c) => {
        if (c === "\n") return c;
        let ok = this.suportado.get(c);
        if (ok === undefined) {
          try {
            f.encodeText(c);
            ok = true;
          } catch {
            ok = false;
          }
          this.suportado.set(c, ok);
        }
        return ok ? c : "?";
      })
      .join("");
  }
  espaco(h: number) {
    if (this.y - h < MARGEM + 20) this.novaPagina();
  }
  texto(s: string, { tam = 10, negrito = false, cor = COR_TEXTO, recuo = 0, apos = 4 } = {}) {
    const f = negrito ? this.negrito : this.fonte;
    const largura = A4.w - 2 * MARGEM - recuo;
    const alt = tam * 1.4;
    for (const paragrafo of this.limpar(s, f).split("\n")) {
      const palavras = paragrafo.split(/ +/);
      let linha = "";
      const linhas: string[] = [];
      for (const p of palavras) {
        const tenta = linha ? `${linha} ${p}` : p;
        if (f.widthOfTextAtSize(tenta, tam) > largura && linha) {
          linhas.push(linha);
          linha = p;
        } else linha = tenta;
      }
      linhas.push(linha);
      for (const l of linhas) {
        this.espaco(alt);
        this.y -= alt;
        this.pagina.drawText(l, { x: MARGEM + recuo, y: this.y + tam * 0.3, size: tam, font: f, color: cor });
      }
    }
    this.y -= apos;
  }
  titulo(s: string) {
    this.espaco(40);
    this.y -= 10;
    this.texto(s, { tam: 13, negrito: true, apos: 2 });
    this.pagina.drawLine({ start: { x: MARGEM, y: this.y }, end: { x: A4.w - MARGEM, y: this.y }, thickness: 0.6, color: COR_LINHA });
    this.y -= 8;
  }
  par(rotulo: string, valor: string) {
    this.texto(`${rotulo}: ${valor}`, { apos: 1 });
  }
}

export async function gerarProntuario(db: Db, pacienteId: string, opcoes: { pessoais: boolean; agora: Date }): Promise<Uint8Array> {
  const p = db.select().from(t.pacientes).where(eq(t.pacientes.id, pacienteId)).get();
  if (!p) throw new ErroDominio(404, "Paciente não encontrado");
  const contratos = db.select().from(t.contratos).where(eq(t.contratos.pacienteId, pacienteId)).orderBy(asc(t.contratos.vigenteDe)).all();
  const sessoes = db.select().from(t.sessoes).where(eq(t.sessoes.pacienteId, pacienteId)).orderBy(asc(t.sessoes.inicio)).all();
  const notas = db
    .select()
    .from(t.notas)
    .where(eq(t.notas.pacienteId, pacienteId))
    .orderBy(asc(t.notas.criadoEm))
    .all()
    .filter((n) => opcoes.pessoais || n.natureza === "documental");
  const sessaoPorId = new Map(sessoes.map((s) => [s.id, s]));

  const doc = await PDFDocument.create();
  doc.setTitle(`Prontuário — ${p.nome}`);
  doc.setCreator("Consultório (app local)");
  doc.setProducer("Consultório");
  doc.setCreationDate(opcoes.agora);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const e = new Escritor(doc, fonte, negrito);

  e.texto("PRONTUÁRIO", { tam: 9, negrito: true, cor: COR_SUAVE, apos: 2 });
  e.texto(p.nome, { tam: 20, negrito: true, apos: 6 });
  e.texto(
    `Documento confidencial. Gerado em ${dataBr(opcoes.agora.toISOString())} às ${horaBr(opcoes.agora.toISOString())}. ${opcoes.pessoais ? "Inclui anotações pessoais do analista." : "Contém apenas o registro documental."}`,
    { tam: 8.5, cor: COR_SUAVE, apos: 6 },
  );

  e.titulo("Identificação");
  e.par("Iniciais/pseudônimo", p.apelido);
  if (p.contato) e.par("Contato", p.contato);
  e.par("Início do atendimento", dataBr(p.inicioEm));
  e.par("Situação", ROTULO_STATUS[p.status] + (p.arquivadoEm ? " (arquivado)" : ""));
  e.par("Origem", ROTULO_ORIGEM[p.origem]);
  e.par("Modalidade", ROTULO_MODALIDADE[p.modalidade]);

  if (contratos.length) {
    e.titulo("Contratos");
    const DIAS = ["", "seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
    for (const k of contratos) {
      e.texto(
        `${dataBr(k.vigenteDe)} a ${k.vigenteAte ? dataBr(k.vigenteAte) : "atual"} · ${k.diasSemana.map((d) => DIAS[d]).join(", ")} às ${k.horario} · ${k.duracaoMin} min · ${formatarDinheiro({ centavos: k.valorCentavos, moeda: k.moeda })} · cobrança ${k.cobranca === "mensal" ? "mensal" : "por sessão"}`,
        { apos: 2 },
      );
    }
  }

  if (p.pontosFixos.trim()) {
    e.titulo("Pontos fixos");
    e.texto(semMarkdown(p.pontosFixos));
  }

  const passadas = sessoes.filter((s) => Date.parse(s.inicio) <= opcoes.agora.getTime());
  e.titulo(`Sessões (${passadas.length} até a data)`);
  const contagem = new Map<EstadoSessao, number>();
  for (const s of passadas) contagem.set(s.estado, (contagem.get(s.estado) ?? 0) + 1);
  e.texto([...contagem.entries()].map(([k, n]) => `${ROTULO_ESTADO[k]}: ${n}`).join(" · ") || "Nenhuma sessão registrada.", { apos: 4 });
  for (const s of passadas) e.texto(`${dataBr(s.inicio)} ${horaBr(s.inicio)} — ${ROTULO_ESTADO[s.estado]}`, { tam: 9, apos: 0 });

  e.titulo(opcoes.pessoais ? "Notas" : "Registro documental");
  if (!notas.length) e.texto("Nenhuma nota.", { cor: COR_SUAVE });
  for (const n of notas) {
    const s = n.sessaoId ? sessaoPorId.get(n.sessaoId) : undefined;
    const quando = s ? `Sessão de ${dataBr(s.inicio)} ${horaBr(s.inicio)}` : `Nota de ${dataBr(n.criadoEm)}`;
    e.espaco(40);
    e.texto(`${quando}${n.natureza === "pessoal" ? " · anotação pessoal" : ""}${n.tags.length ? " · " + n.tags.map((x) => "#" + x).join(" ") : ""}`, {
      tam: 9,
      negrito: true,
      cor: COR_SUAVE,
      apos: 1,
    });
    e.texto(semMarkdown(n.texto), { apos: 8 });
    // Discussão de supervisão é material do analista: só com as anotações pessoais.
    if (opcoes.pessoais && n.supervisaoTexto?.trim()) {
      e.texto(`Discutido em supervisão${n.supervisaoEm ? ` (${dataBr(n.supervisaoEm)})` : ""}:`, { tam: 9, negrito: true, cor: COR_SUAVE, apos: 1 });
      e.texto(semMarkdown(n.supervisaoTexto), { apos: 8 });
    }
  }

  // Rodapé com numeração.
  const paginas = doc.getPages();
  paginas.forEach((pg, i) => {
    pg.drawText(e.limpar(`${p.apelido} · confidencial · ${i + 1}/${paginas.length}`, fonte), { x: MARGEM, y: MARGEM / 2, size: 8, font: fonte, color: COR_SUAVE });
  });
  return doc.save();
}
