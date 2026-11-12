/**
 * Monta as mensagens prontas (lembrete de sessão, cobrança do mês) a partir dos
 * modelos de Configurações. A mensagem vai para o paciente: usa o primeiro nome
 * real e o horário no fuso DELE.
 */
import {
  chaveDiaNoFuso,
  formatarDinheiro,
  preencherModelo,
  type Fechamento,
  type Mensagens,
  type Paciente,
  type Sessao,
} from "@consultorio/shared";
import { fmt, hora, nomeFuso, noFuso } from "./datas";

export const primeiroNome = (p: Paciente) => p.nome.trim().split(/\s+/)[0] ?? p.nome;

/** "hoje", "amanhã" ou "na quarta-feira (11/11)", no fuso do paciente. */
function quando(inicio: string, fuso: string, agora: Date): string {
  const dia = chaveDiaNoFuso(Date.parse(inicio), fuso);
  if (dia === chaveDiaNoFuso(agora.getTime(), fuso)) return "hoje";
  if (dia === chaveDiaNoFuso(agora.getTime() + 86_400_000, fuso)) return "amanhã";
  const d = noFuso(inicio, fuso);
  const semana = fmt(d, "EEEE");
  const artigo = semana.startsWith("sábado") || semana.startsWith("domingo") ? "no" : "na";
  return `${artigo} ${semana} (${fmt(d, "dd/MM")})`;
}

export function mensagemLembrete(s: Sessao, p: Paciente, m: Mensagens, fusoConsultorio: string, agora = new Date()): string {
  const fuso = p.fuso || fusoConsultorio;
  const h = hora(s.inicio, fuso) + (fuso !== fusoConsultorio ? ` (horário de ${nomeFuso(fuso)})` : "");
  return preencherModelo(m.modeloLembrete, { nome: primeiroNome(p), dia: quando(s.inicio, fuso, agora), hora: h });
}

/** Mensagem de cobrança do mês: lista as sessões e cobra o que está em aberto. */
export function mensagemCobranca(f: Fechamento, p: Paciente, m: Mensagens, mes: string, fusoConsultorio: string): string {
  const lista = f.sessoes
    .map((s) => {
      const extra = [s.estado === "falta_cobrada" ? "falta" : null, s.pago ? "pago" : null].filter(Boolean).join(", ");
      return `• ${fmt(noFuso(s.inicio, fusoConsultorio), "dd/MM")}: ${formatarDinheiro(s.valor)}${extra ? ` (${extra})` : ""}`;
    })
    .join("\n");
  const total = (f.aberto.length ? f.aberto : f.total).map((v) => formatarDinheiro(v)).join(" + ");
  const nomeMes = fmt(new Date(`${mes}-15T12:00:00`), "MMMM");
  return preencherModelo(m.modeloCobranca, {
    nome: primeiroNome(p),
    mes: nomeMes,
    qtd: String(f.sessoes.length),
    lista,
    total,
    pix: m.chavePix ? `Pix: ${m.chavePix}` : "",
  })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Link wa.me se o contato parecer um telefone; senão null. Número sem DDI vira +55. */
export function linkWhatsApp(contato: string | undefined, texto: string): string | null {
  if (!contato || contato.includes("@")) return null;
  const digitos = contato.replace(/\D/g, "");
  let numero: string | null = null;
  if (contato.trim().startsWith("+") && digitos.length >= 8) numero = digitos;
  else if (digitos.length === 10 || digitos.length === 11) numero = `55${digitos}`;
  else if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) numero = digitos;
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null;
}

export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Fallback (permissão negada / contexto sem clipboard API).
    const el = document.createElement("textarea");
    el.value = texto;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  }
}
