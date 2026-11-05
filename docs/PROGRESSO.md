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
| 0.5 | Pacientes: lista com filtros (status/origem) e ficha com abas | ✅ |
| 0.6 | Finanças: contas por moeda, transações, gráfico | ✅ |
| 0.7 | Divulgação (básico): campanhas de anúncios, gasto, contatos, custo por paciente | ✅ |
| 0.8 | Calendário: Dia/Semana/Mês, linha do agora, arrastar, painel lateral, dois fusos | ✅ |
| 0.9 | Configurações (tema, fusos, modo discreto) | ⬜ |
| 0.10 | Testes visuais Playwright (1440/390, claro/escuro) + axe, `pnpm test:visual` | ⬜ |

### Lembretes para etapas futuras

- **Excluir paciente** (Etapa 1): só para status *interrompido*, com confirmação. Padrão = arquivar (guarda de 5 anos do CFP); exclusão definitiva com aviso.
- **Divulgação avançada** (Etapas 3 e 5): gasto vindo do extrato/cartão, retorno por campanha, funil, orçamento de anúncios.

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

**0.5**
- `fix(shared): conversão de fuso só com Intl (sem TZDate)`
- `feat(web): lista de pacientes com filtros e ficha com abas`

**Plano**
- `docs: módulo Divulgação e regra de exclusão de pacientes no plano`

**0.6**
- `feat(shared): origem anúncio, campanhas e mocks financeiros mais realistas`
- `feat(web): Finanças com totais por moeda, fluxo de caixa e transações`

**0.7**
- `feat(web): aba Divulgação com campanhas de anúncios`

**0.8**
- `feat(web): lógica do calendário (sobreposição e encaixe de 15 min) com testes`
- `feat(web): Agenda com visões Dia/Semana/Mês, arrastar, painel lateral e dois fusos`

### Como testar (pausa após 0.8)

1. **/agenda**: abre na Semana (no celular, no Dia). Use Dia / Semana / Mês, as setas e "Hoje". Atalhos: ← → navegam, T vai para hoje, D/S/M trocam a visão.
2. **Arrastar**: arraste uma sessão *agendada* para outro horário ou dia; ela encaixa de 15 em 15 min e mostra o horário novo durante o arrasto. Aparece um aviso com **Desfazer**. Sessões realizadas, faltas e canceladas não são arrastáveis (só abrem o painel).
3. **Mês**: arraste um chip para outro dia (mantém o horário). "+N mais" e o número do dia abrem a visão Dia.
4. **Painel lateral** (clique numa sessão): Realizada / Falta / Pago, os horários nos fusos e "Remarcar" por data e hora (alternativa ao arrasto, também pelo teclado).
5. **Dois fusos**: o botão 🌐 "Brasília" escolhe um segundo fuso (ex.: Lisboa). A coluna de horas mostra os dois, e as sessões também.
6. **Fuso do paciente**: abra uma sessão da Lenu (Roma) ou do Thomas (Nova York); o painel mostra o horário para o paciente.
7. **Linha do agora**: linha vermelha no dia de hoje, com a hora na coluna da esquerda.
8. `/agenda?mock=vazio` mostra o aviso de agenda vazia; `/agenda?mock=carregando` mostra os blocos carregando.

### Como testar (pausa após 0.7)

1. **/financas › Visão geral**: totais por moeda (R$, US$, €), fluxo de caixa em R$ com tooltip e tabela embaixo, gastos do mês por categoria e as contas com saldo (cartão negativo).
2. **Transações**: começa no mês atual. Filtros de mês, conta, categoria e busca; as entradas e saídas do filtro aparecem no topo.
3. **Divulgação**: indicadores (gasto, contatos, custo por contato e por paciente) e cartões das campanhas com orçamento usado, métricas e pacientes captados. Clique num paciente captado para abrir a ficha.
4. Em **Pacientes**, filtre a origem por "Anúncio": aparecem Paula e Igor.
5. Em Transações, a categoria "Divulgação" mostra o gasto dos anúncios.
6. Mobile (~390 px) e tema escuro.

### Como testar (pausa após 0.5)

1. **/pacientes**: filtros de status (o padrão é "Ativo") e de origem; a busca aceita nome ou iniciais. Os filtros ficam na URL. Na largura de celular a lista vira cartões.
2. **Ficha** (clique num paciente): abas Resumo / Sessões / Pagamentos / Notas. A aba também fica na URL (`?aba=sessoes`).
3. **Fuso do paciente**: Lenu (Roma) e Thomas (Nova York) mostram o horário local deles ao lado do de Brasília.
4. **Aba Sessões**: os botões Realizada / Falta / Pago mudam o estado, e o "A receber" do Resumo e da lista acompanha.
5. **Multimoeda**: Lenu paga em €, Thomas em US$, o resto em R$.
6. `/pacientes?mock=vazio` mostra o estado vazio; `/pacientes/xyz` mostra "paciente não encontrado".

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
