import { Check } from "lucide-react";
import { corDaPaleta, usePreferencias } from "@/app/preferencias";
import { amostra, LIMITES_CROMA, PALETAS } from "@/lib/paletas";
import { cn } from "@/lib/utils";

/** Amostra redonda: metade com a cor no tema claro, metade no escuro. */
function Bolinha({ matiz, croma, fundo }: { matiz: number; croma: number; fundo?: string }) {
  return (
    <span
      aria-hidden
      className="block size-9 rounded-full border shadow-xs"
      style={{
        background:
          fundo ?? `linear-gradient(135deg, ${amostra(matiz, croma, "claro")} 50%, ${amostra(matiz, croma, "escuro")} 50%)`,
      }}
    />
  );
}

function Opcao({
  selecionada,
  rotulo,
  onSelecionar,
  children,
}: {
  selecionada: boolean;
  rotulo: string;
  onSelecionar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selecionada}
      onClick={onSelecionar}
      className={cn(
        "group flex flex-col items-center gap-1.5 rounded-lg p-1.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
        selecionada && "text-foreground",
      )}
    >
      <span className={cn("relative rounded-full p-0.5 ring-2 ring-transparent", selecionada && "ring-ring")}>
        {children}
        {selecionada && (
          <Check aria-hidden className="absolute inset-0 m-auto size-4 text-white drop-shadow-[0_1px_1px_rgb(0_0_0/0.6)]" />
        )}
      </span>
      {rotulo}
    </button>
  );
}

const ARCO_IRIS = `conic-gradient(${Array.from({ length: 13 }, (_, i) => `oklch(0.62 0.12 ${i * 30})`).join(", ")})`;
const TRILHA_MATIZ = `linear-gradient(90deg, ${Array.from({ length: 13 }, (_, i) => `oklch(0.6 0.11 ${i * 30})`).join(", ")})`;

const CLASSE_SLIDER =
  "h-2 w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow";

/** Escolha da cor principal do app. Cada cor já vem com a versão do modo escuro. */
export function SeletorPaleta() {
  const prefs = usePreferencias();
  const { matiz, croma } = corDaPaleta(prefs);
  const personalizada = prefs.paleta === "personalizada";
  const ajustar = (c: Partial<typeof prefs.corPersonalizada>) =>
    prefs.atualizar({ paleta: "personalizada", corPersonalizada: { matiz, croma, ...c } });

  return (
    <div className="flex flex-col gap-3 py-4 last:pb-0">
      <div>
        <p id="rotulo-paleta" className="text-sm font-medium">
          Cor principal
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Botões, destaques e menu. Cada amostra mostra a cor no claro e no escuro. As cores de estado das sessões não mudam.
        </p>
      </div>

      <div role="radiogroup" aria-labelledby="rotulo-paleta" className="flex flex-wrap gap-1">
        {PALETAS.map((p) => (
          <Opcao key={p.id} rotulo={p.nome} selecionada={prefs.paleta === p.id} onSelecionar={() => prefs.atualizar({ paleta: p.id })}>
            <Bolinha matiz={p.matiz} croma={p.croma} />
          </Opcao>
        ))}
        <Opcao
          rotulo="Personalizada"
          selecionada={personalizada}
          onSelecionar={() => prefs.atualizar({ paleta: "personalizada", corPersonalizada: { matiz, croma } })}
        >
          <Bolinha matiz={matiz} croma={croma} fundo={personalizada ? undefined : ARCO_IRIS} />
        </Opcao>
      </div>

      {personalizada && (
        <div className="grid gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs text-muted-foreground">
            <span className="flex justify-between">
              Matiz <span className="tabular text-foreground">{matiz}°</span>
            </span>
            <input
              type="range"
              min={0}
              max={359}
              value={matiz}
              onChange={(e) => ajustar({ matiz: Number(e.target.value) })}
              className={CLASSE_SLIDER}
              style={{ background: TRILHA_MATIZ }}
            />
          </label>
          <label className="flex flex-col gap-2 text-xs text-muted-foreground">
            <span className="flex justify-between">
              Intensidade <span className="tabular text-foreground">{Math.round(croma * 100)}%</span>
            </span>
            <input
              type="range"
              min={LIMITES_CROMA.min}
              max={LIMITES_CROMA.max}
              step={0.05}
              value={croma}
              onChange={(e) => ajustar({ croma: Number(e.target.value) })}
              className={CLASSE_SLIDER}
              style={{ background: `linear-gradient(90deg, ${amostra(matiz, 0, "claro")}, ${amostra(matiz, LIMITES_CROMA.max, "claro")})` }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
