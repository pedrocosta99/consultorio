# Consultório + Finanças

App local (só na máquina do usuário) com dois módulos: **Consultório** (pacientes, sessões, cobranças, notas) e **Finanças** (entradas dos pacientes e lançamentos manuais: aluguel, supervisão…; sem investimentos). O plano completo e o roadmap por etapas estão em `docs/PLANO.md`. Leia antes de começar uma etapa.

Interface, código de domínio, mensagens e commits em **português**.

## Estrutura

```
apps/web/          React + Vite + TS + Tailwind v4 + shadcn/ui (porta 5173, só 127.0.0.1)
  src/app/         providers: preferências (tema, fusos, modo discreto) e dados
  src/components/  ui/ (shadcn, gerado), layout/ (shell, Cmd+K), calendar/, comuns
  src/pages/       uma página por rota
  e2e/             testes visuais Playwright + axe (baselines em e2e/__screenshots__)
apps/api/          Hono (Node), porta 8787, só 127.0.0.1. O web faz proxy de /api
packages/shared/   tipos + schemas Zod, dinheiro, mocks fictícios. Consumido como TS direto
docs/PLANO.md      plano do produto
```

## Comandos

- `pnpm dev` sobe API + web juntos. Banco em `data/consultorio.db` (ou `CONSULTORIO_DB`). `CONSULTORIO_AGORA` fixa o relógio da API (testes).
- Migrações: edite `apps/api/src/db/schema.ts` e rode `pnpm --filter @consultorio/api exec drizzle-kit generate --name <nome>`. SQL à mão (FTS5, triggers): `--custom`.
- Variáveis da API em `apps/api/src/infra/config.ts`. Fora do container, `HOST` só aceita loopback.
- Docker: `docker build -t consultorio .` e `docker run --rm -p 127.0.0.1:8080:8080 -v consultorio-dados:/dados consultorio` (publique só em 127.0.0.1).
- Logs: use `log()` de `apps/api/src/infra/log.ts` (JSON); nunca corpo, query, nomes ou ids de pacientes.
- `pnpm test` roda o Vitest (unitários em `packages/*/src/**/*.test.ts` e `apps/*/src/**`)
- `pnpm typecheck` roda o `tsc` em todos os pacotes
- `pnpm test:visual` roda Playwright (screenshots em 1440/390 px, claro/escuro) + axe
- `pnpm test:visual:update` regrava as baselines. Use só quando a mudança visual for intencional e aprovada.
- Componentes shadcn: `pnpm dlx shadcn@4.22.2 add <nome>` dentro de `apps/web`. **Depois confira os imports**: o CLI já gerou `import { cn } from "cn"` (pacote npm de terceiros). O certo é `@/lib/utils`.

## Regras de dinheiro

- Valor monetário é **sempre** `{ centavos: inteiro, moeda: "BRL" | "USD" | "EUR" }` (`Dinheiro` em `packages/shared/src/money.ts`). Nunca float, nunca string formatada no estado.
- **BRL é a moeda principal** (moeda de relatório padrão). USD e EUR são aceitas.
- Não some moedas diferentes: `somar()` lança erro. Para totais, agrupe por moeda (`somarPorMoeda`).
- Conversão só na exibição: se a preferência `moedaExibicao` não for "separada", Finanças e os cards financeiros do Painel convertem com `converter()` (`packages/shared/src/cambio.ts`) pela cotação do dia de cada movimento (tabela `cotacoes`: PTAX do Banco Central ou manual). Nada é gravado convertido; cobranças ficam sempre na moeda do paciente.
- Formatação só na borda, com `formatarDinheiro` / `<Valor>` (pt-BR, números tabulares).

## Datas e fusos

- Instantes são gravados em ISO UTC. Datas civis (pagamento, transação) como `yyyy-MM-dd`.
- Fuso padrão do consultório: `America/Sao_Paulo`. A agenda exibe no fuso principal das preferências e, opcionalmente, num fuso secundário. Cada paciente tem o próprio `fuso`.
- Use os helpers de `packages/shared/src/fuso.ts` (Intl) e `apps/web/src/lib/datas.ts`. Não use `TZDate` (quebra com o relógio falso do Playwright) nem `new Date().getHours()` para lógica de agenda.
- A semana começa na segunda (`weekStartsOn: 1`).

## Sigilo (LGPD: notas clínicas são dado sensível)

> **Nuvem (Fase 6 do `PLANO.md`):** o app vai para o Google Cloud (Cloud Run, Cloud SQL PostgreSQL, Identity Platform). Até a Fase 6.3 (login de verdade) terminar, as regras abaixo valem como estão. Na 6.1 entra uma tela de login **mockada**: o app local continua abrindo direto, logado como `dono`, e o login só aparece com `?mock=deslogado`. Na 6.3, as regras de loopback, `x-consultorio` e "sem tela de acesso" são substituídas; atualize esta seção nessa hora.

- Servidores escutam **apenas em 127.0.0.1**. Nunca `0.0.0.0`.
- Nada de dados reais em mocks, seeds, testes, logs ou screenshots. Os mocks são fictícios.
- Não logar conteúdo de notas nem dados de pacientes no console da API.
- Banco (`*.db`), snapshots, backups `.cofre`, `.env*` e `data/` ficam fora do git (ver `.gitignore`).
- Modo discreto (preferência) troca nomes por iniciais/pseudônimo em toda a interface. Use sempre `nomeExibicao()` do `useDados()` para mostrar o nome de um paciente.
- Nada sai da máquina sem cifra: backups `.cofre` = AES-256-GCM com senha própria (≥10).
- **Sem tela de acesso** (decisão do usuário, 6 nov 2026): o app abre direto e o banco em disco fica em claro. A proteção do disco é a do sistema (FileVault). Não reintroduza PIN/login sem pedido.
- Toda chamada à API exige o cabeçalho `x-consultorio: 1` e Host loopback (barra outros sites e DNS rebinding).

## Google Agenda (simulado até a Fase 6.6)

- Mudanças em `sessoes`, `compromissos`, `compromissos_excecoes` e no `apelido` de pacientes entram na `fila_saida` por **trigger** (migração 0013), só se houver agenda conectada. Não enfileire à mão.
- `apps/api/src/agendaGoogle.ts` esvazia a fila com um `AdaptadorGoogle` (local: simulado, nada sai da máquina).
- O evento leva só "Sessão" e, se escolhido, o `apelido`. Nunca nome, contato, valor, estado ou nota (`packages/shared/src/google.ts`).
- Nos testes de tela, simule as rotas `/api/integracoes/google*` (ver `e2e/google.spec.ts`): o banco é compartilhado entre testes em paralelo.

## Visual: direção "Sálvia"

- Tokens em CSS variables em `apps/web/src/index.css` (`:root` claro, `.dark` escuro). Use as classes de token (`bg-card`, `text-muted-foreground`…), nunca cores soltas.
- Títulos em Fraunces (`font-serif`), texto em Inter. Cor forte só para estado de sessão (`--st-*`) e entradas/saídas (`text-positivo` / `text-negativo`).
- `/lab` mostra os tokens nos dois temas.
- Responsivo até 390 px.

## Testes visuais

- Playwright fixa o relógio em **2026-11-04 14:30 (Brasília)** e `timezoneId: America/Sao_Paulo`. Os mocks são determinísticos a partir dessa data.
- `?mock=vazio` e `?mock=carregando` na URL forçam os estados vazio/carregando.
- `?mock=deslogado` abre na tela de entrar (login simulado; ver `apps/web/src/app/sessao.tsx`). A simulação usa `setTimeout`: nos testes de fluxo, chame `page.clock.resume()`.

## Supply chain

- `pnpm-workspace.yaml` tem `minimumReleaseAge: 14 dias`: o pnpm só instala versões publicadas há pelo menos duas semanas.

## Segredos

- O repositório é público no GitHub. **Nada de segredo, dado real ou e-mail pessoal** em código, docs ou commits.
- `gitleaks` no pre-commit (`.githooks/pre-commit`; ative num clone novo com `git config core.hooksPath .githooks` e `brew install gitleaks`) e no CI (`.github/workflows/segredos.yml`, versão e checksum fixos). Ações do GitHub ficam presas por SHA.
