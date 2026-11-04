# Progresso

Plano completo: [PLANO.md](PLANO.md). Aqui cada etapa é quebrada em passos pequenos. Cada passo termina num ponto testável, com pausa para revisão e commits próprios.

Legenda: ✅ feito · 🔄 em andamento · ⬜ a fazer

## Etapa 0: layout, calendário e testes visuais (só mocks, sem banco)

Decisões tomadas: direção visual **Sálvia**; fuso principal **Brasília** (`America/Sao_Paulo`), com fuso secundário opcional; moedas **BRL (principal), USD e EUR**.

| Passo | O quê | Status |
| --- | --- | --- |
| 0.1 | Monorepo pnpm, API Hono (127.0.0.1), pacote `shared` (dinheiro, tipos, mocks) | ✅ |
| 0.2 | Tokens Sálvia (claro/escuro), shadcn/ui, rota `/lab` | ✅ |
| 0.3 | Shell: sidebar, gaveta mobile, busca Cmd+K, menu "+ Novo", alternar tema | ✅ |
| 0.4 | Painel: indicadores, lista "Hoje" com ações rápidas, a receber, receita por paciente | ✅ |
| 0.5 | Pacientes: lista com filtros (status/origem) e ficha com abas | ⬜ |
| 0.6 | Finanças: contas por moeda, transações, gráfico | ⬜ |
| 0.7 | Calendário: Dia/Semana/Mês, linha do agora, arrastar, painel lateral, dois fusos | ⬜ |
| 0.8 | Configurações (tema, fusos, modo discreto) | ⬜ |
| 0.9 | Testes visuais Playwright (1440/390, claro/escuro) + axe, `pnpm test:visual` | ⬜ |

### Commits

**0.1**
- `chore: estrutura do monorepo pnpm`
- `feat(shared): dinheiro em centavos, tipos de domínio e mocks fictícios`
- `feat(api): servidor Hono só em 127.0.0.1 com /api/health`

**0.2**
- `feat(web): setup Vite + Tailwind + shadcn/ui e tokens Sálvia`

**0.3**
- `feat(web): shell do app, preferências, busca Cmd+K e /lab`

**0.4**
- `feat(web): Painel com dados fictícios e ações rápidas de sessão`
- `docs: CLAUDE.md e PROGRESSO.md`

### Como testar (pausa após 0.4)

1. `pnpm dev`, depois abra http://127.0.0.1:5173
2. **Painel**: os botões Realizada / Falta / Pago da lista "Hoje" atualizam o estado e os totais. Os dados são só em memória: recarregar volta ao inicial.
3. **Tema**: botão lua/sol no topo, ou "Alternar tema" no Cmd+K.
4. **Cmd+K**: busque um paciente pelo nome ou pelas iniciais, ou navegue entre telas.
5. **+ Novo**: "Sessão" leva à Agenda; os outros itens avisam que o formulário chega na Etapa 1.
6. **/lab**: tokens, tipografia e estados nos dois temas, lado a lado.
7. **Mobile**: estreite a janela até ~390 px. A sidebar vira gaveta (☰).
8. **Estados forçados**: `/?mock=carregando` e `/?mock=vazio`.
9. `pnpm test` roda os testes de dinheiro e mocks.

Ainda não existem: Agenda, Pacientes, Finanças e Configurações (aparecem como "Em construção").

## Etapa 1: consultório básico (banco SQLite)

Detalhamento quando a Etapa 0 for aprovada. Resumo: SQLite (better-sqlite3 + Drizzle) com migrações e `meta_sistema`; senha e bloqueio; CRUD de pacientes/contratos; geração de sessões; pagamentos e saldo; snapshot cifrado.

## Etapas 2 e 3

Ver [PLANO.md](PLANO.md#prompts-por-etapa).
