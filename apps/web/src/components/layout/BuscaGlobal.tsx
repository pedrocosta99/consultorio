import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { EyeOff, Moon, NotebookPen, Palette, Pin } from "lucide-react";
import { ROTULO_STATUS, type ResultadoBusca } from "@consultorio/shared";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useDados } from "@/app/dados";
import { usePreferencias } from "@/app/preferencias";
import { PacienteAvatar } from "@/components/comuns";
import { NAVEGACAO } from "./navegacao";
import { api } from "@/lib/api";
import { fmt } from "@/lib/datas";
import { TextoInline } from "@/lib/markdown";

export function BuscaGlobal({ aberta, aoMudar }: { aberta: boolean; aoMudar: (v: boolean) => void }) {
  const navegar = useNavigate();
  const { pacientes, nomeExibicao, paciente } = useDados();
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<ResultadoBusca[]>([]);

  // Busca de texto completo nas notas e pontos fixos (FTS5 na API), com pequena espera.
  useEffect(() => {
    const q = termo.trim();
    if (q.length < 2) {
      setAchados([]);
      return;
    }
    let vivo = true;
    const t = window.setTimeout(() => {
      api<ResultadoBusca[]>("GET", `/busca?q=${encodeURIComponent(q)}`)
        .then((r) => vivo && setAchados(r))
        .catch(() => vivo && setAchados([]));
    }, 180);
    return () => {
      vivo = false;
      window.clearTimeout(t);
    };
  }, [termo]);

  useEffect(() => {
    if (!aberta) setTermo("");
  }, [aberta]);
  const { temaEfetivo, modoDiscreto, atualizar } = usePreferencias();

  const ir = (rota: string) => {
    aoMudar(false);
    navegar(rota);
  };

  return (
    <CommandDialog open={aberta} onOpenChange={aoMudar} title="Busca global" description="Busque pacientes, telas e ações">
      <CommandInput placeholder="Buscar pacientes, notas, telas, ações…" value={termo} onValueChange={setTermo} />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Pacientes">
          {pacientes.map((p) => (
            <CommandItem
              key={p.id}
              value={`${p.nome} ${p.apelido}`}
              onSelect={() => ir(`/pacientes/${p.id}`)}
            >
              <PacienteAvatar paciente={p} className="size-6 text-[10px]" />
              <span>{nomeExibicao(p)}</span>
              <span className="ml-auto text-xs text-muted-foreground">{ROTULO_STATUS[p.status]}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {achados.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Nas notas e pontos fixos">
              {achados.map((a) => {
                const p = paciente(a.pacienteId);
                return (
                  <CommandItem
                    key={`${a.origem}-${a.refId}`}
                    value={`busca ${a.origem} ${a.refId}`}
                    keywords={[termo]}
                    onSelect={() => ir(a.origem === "nota" ? `/pacientes/${a.pacienteId}?aba=notas&nota=${a.refId}` : `/pacientes/${a.pacienteId}`)}
                    className="items-start"
                  >
                    {a.origem === "nota" ? <NotebookPen aria-hidden className="mt-0.5" /> : <Pin aria-hidden className="mt-0.5" />}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{nomeExibicao(p)}</span>
                        {a.origem === "fixos" ? "pontos fixos" : a.criadoEm ? fmt(new Date(a.criadoEm), "d MMM yyyy") : "nota"}
                      </span>
                      <span className="line-clamp-2 text-sm">
                        <TextoInline texto={a.trecho.replace(/\s+/g, " ")} destacar />
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading="Ir para">
          {NAVEGACAO.map(({ rota, rotulo, icone: Icone }) => (
            <CommandItem key={rota} value={`ir ${rotulo}`} onSelect={() => ir(rota)}>
              <Icone aria-hidden />
              {rotulo}
            </CommandItem>
          ))}
          <CommandItem value="ir laboratório visual lab tokens" onSelect={() => ir("/lab")}>
            <Palette aria-hidden />
            Laboratório visual
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ações">
          <CommandItem
            value="alternar tema claro escuro"
            onSelect={() => {
              atualizar({ tema: temaEfetivo === "escuro" ? "claro" : "escuro" });
              aoMudar(false);
            }}
          >
            <Moon aria-hidden />
            Alternar tema claro/escuro
          </CommandItem>
          <CommandItem
            value="modo discreto iniciais sigilo"
            onSelect={() => {
              atualizar({ modoDiscreto: !modoDiscreto });
              aoMudar(false);
            }}
          >
            <EyeOff aria-hidden />
            {modoDiscreto ? "Desligar modo discreto" : "Ligar modo discreto"}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
