import { useNavigate } from "react-router";
import { Moon, Palette } from "lucide-react";
import { ROTULO_STATUS } from "@consultorio/shared";
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

export function BuscaGlobal({ aberta, aoMudar }: { aberta: boolean; aoMudar: (v: boolean) => void }) {
  const navegar = useNavigate();
  const { pacientes, nomeExibicao } = useDados();
  const { temaEfetivo, atualizar } = usePreferencias();

  const ir = (rota: string) => {
    aoMudar(false);
    navegar(rota);
  };

  return (
    <CommandDialog open={aberta} onOpenChange={aoMudar} title="Busca global" description="Busque pacientes, telas e ações">
      <CommandInput placeholder="Buscar pacientes, telas, ações…" />
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
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
