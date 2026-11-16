# Prompts usados nas Fases 1–3 (histórico)

> Guardados como registro. Descrevem a versão local (SQLite, SQLCipher, sync com o Drive), que foi substituída pela direção de nuvem do `docs/PLANO.md` (16 nov 2026). Não use para trabalho novo.

## Como começar no Claude Code

Exporte este doc como Markdown, salve como `docs/PLANO.md` numa pasta vazia, abra o Claude Code nela e cole o prompt abaixo. Peça uma fase por vez e revise antes de seguir.

```text
Leia docs/PLANO.md. Vamos construir a Fase 1 desse plano.

Stack: monorepo com pnpm. Front em React + Vite + TypeScript + Tailwind + shadcn/ui.
API local em Hono (Node) ouvindo só em 127.0.0.1. Banco SQLite com better-sqlite3
(ou SQLCipher) e Drizzle ORM com migrações. Validação com Zod compartilhado entre
front e API. Valores monetários em centavos (inteiro) + código de moeda.

Antes de codar:
1. Crie um CLAUDE.md com as convenções do projeto (pastas, comandos, regras de dinheiro
   e de sigilo).
2. Proponha o esquema Drizzle da Fase 1 e espere minha aprovação.

Depois implemente, com testes (Vitest) para: geração de sessões pela grade fixa,
cálculo de saldo por paciente e exportação/importação do snapshot cifrado.
Interface em português. Um comando só (pnpm dev) deve subir tudo.
```

Dicas de uso: comece cada fase com o modo de planejamento do Claude Code, faça commits pequenos no git e use dados fictícios até a fase 1 estar estável.

## Prompts por etapa

Quatro prompts, um por sessão do Claude Code, nesta ordem: Layout → Fase 1 → Fase 2 → Fase 3. Eles substituem o prompt inicial acima. Só passe para a próxima etapa quando a anterior estiver aprovada e commitada.

### Etapa 0 — Layout, calendário e testes visuais

```text
Leia docs/PLANO.md. Antes de qualquer regra de negócio, quero validar o visual do app.

1. Setup: monorepo pnpm com apps/web (React + Vite + TypeScript + Tailwind + shadcn/ui)
   e apps/api (Hono, só 127.0.0.1). Um comando: pnpm dev. Crie o CLAUDE.md com
   convenções de pastas, comandos, regras de dinheiro (centavos + moeda) e de sigilo.

2. Direção visual: proponha 3 direções (paleta, tipografia, densidade, cantos, uso de
   cor) para um app calmo e profissional de consultório + finanças. Monte as 3 numa
   rota /lab, lado a lado, e espere eu escolher. Depois transforme a escolhida em
   tokens (CSS variables) com tema claro e escuro.

3. Shell do app: sidebar com Painel, Agenda, Pacientes, Finanças, Configurações;
   topo com busca global (Cmd+K) e botão "+ Novo". Responsivo até 390 px.

4. Telas com dados fictícios (arquivo de mocks tipado, sem banco ainda):
   - Painel: sessões de hoje, a receber, receita do mês, faltas.
   - Pacientes: lista com filtro por status e origem; ficha com abas
     Resumo / Sessões / Pagamentos / Notas.
   - Finanças: contas com saldo por moeda (BRL, AED), lista de transações, um gráfico.

5. Calendário (o mais caprichado): construa um componente próprio com date-fns e
   dnd-kit, sem FullCalendar. Visões Dia, Semana e Mês; semana começando na segunda;
   linha do "agora"; sessões coloridas por estado (agendada, realizada, falta,
   cancelada) com o nome/iniciais do paciente; arrastar para remarcar; clique abre
   um painel lateral com ações rápidas (realizada, falta, pago). Fuso configurável,
   pois atendo pacientes no Brasil estando em outro fuso: mostre os dois horários.
   Estados vazios e carregando bem resolvidos.

6. Testes de layout: Playwright com screenshots de cada tela em 1440 px e 390 px,
   nos temas claro e escuro, salvos como baseline (toHaveScreenshot). Rode axe para
   acessibilidade. Adicione pnpm test:visual.

Trabalhe em modo de planejamento primeiro, mostre o plano e espere meu ok.
Ao terminar cada tela, me mostre as screenshots antes de seguir.
```

### Etapa 1 — Consultório básico

```text
Leia docs/PLANO.md e CLAUDE.md. O layout e o calendário da Etapa 0 estão aprovados;
não mude o visual, só ligue as telas ao banco. Escopo: Fase 1 do plano.

1. Banco: SQLite com better-sqlite3 + Drizzle, migrações versionadas, tabela
   meta_sistema (versão do esquema, id do dispositivo, último sync). Proponha o
   esquema de pacientes, contratos, sessoes e pagamentos e espere minha aprovação.
2. Senha ao abrir o app e bloqueio após 15 min de inatividade.
3. Pacientes e contratos: CRUD completo, com histórico de reajuste (vigente_de /
   vigente_ate), sem apagar o passado.
4. Sessões: gerar as próximas 8 semanas a partir da grade fixa; marcar estado pelo
   calendário e pela lista "Hoje"; remarcar arrastando já grava no banco.
5. Pagamentos e saldo: registrar pagamento (valor, data, meio, conta) e calcular
   saldo por paciente (sessões cobráveis − pagamentos).
6. Backup: botões Exportar/Importar que geram um snapshot com VACUUM INTO, cifrado com
   AES-256-GCM e chave derivada da senha (scrypt), salvo numa pasta que eu escolho
   (vou usar a do Google Drive para Desktop). Importar faz backup local antes.
7. Substitua os mocks pelas chamadas reais; mantenha um seed de dados fictícios.

Testes (Vitest): geração de sessões (incluindo feriados manuais e mudança de
contrato), cálculo de saldo, ida e volta do snapshot cifrado. Os testes visuais da
Etapa 0 devem continuar passando.
```

### Etapa 2 — Notas clínicas

```text
Leia docs/PLANO.md e CLAUDE.md. Escopo: Fase 2 do plano. Não altere regras de
sessões ou pagamentos.

1. Tabela notas (texto, tipo: sessao | fixa | supervisao, tags, datas), ligada a
   paciente e, opcionalmente, a sessão.
2. Editor markdown simples e rápido, com salvamento automático e atalho para abrir
   a nota da sessão direto do calendário.
3. Na ficha do paciente: bloco "Pontos fixos" sempre visível no topo e linha do
   tempo das notas de sessão.
4. Busca de texto completo com SQLite FTS5 em todas as notas, integrada ao Cmd+K,
   com destaque do termo encontrado.
5. Marcador "levar para supervisão" e uma página que reúne essas notas.
6. Separar registro documental de anotação pessoal (campo e filtro), e exportar o
   prontuário de um paciente em PDF.
7. Painel do consultório com dados reais: semana, ativos, faltas do mês, a receber.
8. Banco cifrado em disco com SQLCipher; migre o banco existente sem perder dados.

Testes: busca FTS (acentos e termos parciais), migração para SQLCipher, export PDF.
Atualize as baselines visuais só das telas que mudaram e me mostre as diferenças.
```

### Etapa 3 — Finanças essenciais e sync com o Drive

```text
Leia docs/PLANO.md e CLAUDE.md. Escopo: Fase 3 do plano.

1. Tabelas contas, categorias (2 níveis), transacoes, recorrencias,
   regras_importacao e cotacoes. Proponha o esquema e espere minha aprovação.
2. Contas por instituição, país e moeda (começo com uma conta BRL e uma AED).
   Saldo calculado + ajuste de conferência.
3. Transações: receita, despesa e transferência entre contas, inclusive entre moedas
   com a taxa usada gravada. Valor sempre na moeda original.
4. Integração: todo pagamento de paciente cria (e atualiza/apaga junto) uma
   transação de receita na categoria Clínica, ligada por pagamentos.transacao_id.
5. Recorrências (aluguel, parcelas, assinaturas) lançadas como "a confirmar" no mês.
6. Importação de extratos CSV e OFX com tela de pré-visualização, detecção de
   duplicadas e regras de categorização ("contém X → categoria Y").
7. Tela Finanças: saldo por conta e total na moeda de relatório escolhida,
   fluxo de caixa mensal e gastos por categoria (Recharts), receita da clínica por
   mês e por paciente.
8. Sync com Google Drive pela API: me guie para criar o projeto no Google Cloud e o
   OAuth (escopo drive.file). Push/pull dos snapshots cifrados, metadados com versão
   do esquema, dispositivo e hash, retenção dos últimos 30, detecção de conflito
   quando os dois lados mudaram (eu escolho; o outro vira backup).

Testes: conversão de moeda, transferências entre moedas, criação automática de
receita a partir de pagamento, importação com duplicadas, cenários de conflito do
sync (local novo, remoto novo, ambos mudaram). Testes visuais das telas novas.
```
