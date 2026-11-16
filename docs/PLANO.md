# Plano — Sistema de Consultório + Finanças

Nov 3, 2026 · @Pedro · revisado em 16 nov 2026 para a nuvem (banco vivo no Google Cloud, login normal e com Google)

## Visão geral

Um app com dois módulos que conversam entre si: **Consultório** (pacientes, sessões, cobranças, notas) e **Finanças** (entradas dos pacientes e lançamentos manuais: aluguel, supervisão…). Todo pagamento de paciente já conta como entrada em Finanças, sem digitar nada duas vezes.

Hoje o app roda só na sua máquina (SQLite, sem login). O destino é um **app na nuvem**, com web agora e mobile depois, **login com e-mail/senha ou com Google**, banco vivo no **Google Cloud** e integração com o **Google Agenda**.

Princípios que guiam as decisões:

- **Um backend, vários clientes:** web hoje, mobile depois. As regras ficam em `packages/shared` e a API tem um contrato (OpenAPI) que os dois usam.
- **Banco vivo na nuvem:** o Postgres no Google Cloud é a fonte da verdade. Não há sincronização de arquivos nem "um computador por vez". No desenvolvimento, o mesmo stack roda local.
- **Registrar em segundos:** marcar uma sessão como realizada e paga deve levar 2 cliques; uma nota, um campo de texto.
- **Multimoeda desde o dia 1:** BRL é a moeda principal; USD e EUR quando precisar.
- **Sigilo por padrão:** login com MFA, isolamento por consultório no banco, registro de quem abriu o quê, dados no Brasil, e nada clínico sai do app (nem para o Google Agenda).
- **Pronto para mais de um consultório:** `consultorio_id` desde já, para poder vender sem refazer.

Fora do escopo por ora: integração direta com bancos (extratos). A emissão de nota fiscal e uma área do paciente entraram no plano em 16 nov 2026 (ver [App completo](#app-completo-fase-8)).

## Módulo Consultório

O centro do módulo é a ficha do paciente: dali você vê sessões, pagamentos e notas sem trocar de tela.

**Pacientes**

- Cadastro: nome (ou iniciais/pseudônimo), contato, data de início, origem (clínica-escola, particular, indicação, anúncio), modalidade (online/presencial), status (ativo, pausa, alta, interrompido).
- Contrato: frequência (1x, 2x semana…), dia e horário fixos, valor por sessão, moeda, forma de cobrança (por sessão ou fechamento mensal) e política de faltas.
- Histórico de reajustes de valor, com data, para os relatórios não distorcerem o passado.
- **Excluir paciente:** permitido só para quem está com status *interrompido*, sempre com confirmação. Por padrão é um **arquivamento** (some das listas, mas o prontuário fica guardado, por causa da guarda mínima de 5 anos do CFP). A exclusão definitiva fica disponível com aviso explícito.

**Sessões e agenda**

- A grade fixa gera as sessões futuras automaticamente.
- Cada sessão recebe um estado: realizada, falta cobrada, falta não cobrada, cancelada, remarcada.
- Visão semanal da agenda e lista "hoje" para marcar tudo rápido ao fim do dia.
- **Google Agenda** (Fase 6.6): as sessões aparecem na sua agenda do Google, só com iniciais/pseudônimo. Depois, opcionalmente, os horários ocupados do Google aparecem na agenda do app, para evitar conflito.

**Agenda no estilo do Google Agenda** (decidido em 16 nov 2026)

A agenda deve se comportar como a do Google, porque as duas vão conversar e você já tem esse hábito na mão.

- **Criar clicando:** clicar num horário vazio abre um cartão rápido no lugar (paciente ou compromisso, início, duração: a do contrato ou 50 min). Arrastar na grade seleciona o intervalo. "Mais opções" abre o diálogo completo. Atalho `c` cria.
- **Tipos de evento:** *sessão* (de um paciente, avulsa ou da grade), *compromisso do consultório* (supervisão, análise pessoal, grupo de estudo, reunião) e *bloqueio* (folga, férias, horário pessoal: aparece só como "ocupado"). Compromissos têm categoria e cor própria; sessões continuam coloridas por estado.
- **Arrastar e redimensionar:** arrastar move; puxar a borda de baixo muda a duração. Em algo recorrente, aparece a mesma pergunta do Google:
  - **Só esta sessão:** vira uma exceção (a sessão fica *remarcada* e a vaga da grade é preservada, como hoje).
  - **Esta e as seguintes:** o contrato atual termina na véspera (`vigente_ate`) e começa uma nova versão (`vigente_de`) com o novo dia, horário ou duração. As sessões futuras ainda *agendadas* são refeitas; as que já têm nota, pagamento ou foram remarcadas à mão ficam como estão e são listadas no aviso.
  - **Todas** não existe para sessões: as passadas são histórico clínico e financeiro e não mudam. Para compromissos, existe.
- **A mesma pergunta vale para cancelar ou excluir:** só esta (fica *cancelada*) ou esta e as seguintes (encerra o contrato ou a série).
- **Desfazer:** depois de mover, criar ou excluir, um aviso com "Desfazer" por alguns segundos.
- **Conflitos:** aviso ao sobrepor sessão, compromisso, bloqueio ou horário ocupado do Google (sem impedir).
- **Visões:** dia, semana e mês (já existem), mais *semana de trabalho* (sem fim de semana) e *lista* (próximos eventos). Mini calendário para pular de data e atalhos de teclado (`t` hoje, `d`/`s`/`m` para a visão, setas para navegar).
- **Horário de atendimento:** configurável por dia da semana; fora dele a grade fica sombreada.
- **Sessão online:** opção de gerar um link do Google Meet no evento (6.6). O link vai para o paciente pela mensagem pronta (WhatsApp/copiar), **sem convidar o paciente pelo Google**, para não expor o e-mail dele nem o vínculo terapêutico.
- **Como vai para o Google:** cada sessão vira um evento individual (exceções, estados e remarcações ficam simples e robustas). Compromissos recorrentes viram um evento recorrente com a mesma regra (RRULE, o formato do Google). No começo o sentido é só app → Google. Depois, se você mover no Google um evento criado pelo app, o app pergunta se aplica a mudança, em vez de aplicar sozinho.

**Cobranças e pagamentos**

- Saldo por paciente: sessões devidas × pagamentos recebidos.
- Registro de pagamento (valor, data, meio: Pix, transferência, dinheiro) e em qual conta entrou.
- Fechamento mensal com lista de quem deve e quanto, e mensagem pronta com a chave Pix.
- Recibos da Receita Saúde: o sistema guarda só a data e o número.
- Recibo em PDF (Fase 5).

**Notas clínicas**

- Nota por sessão (texto livre em markdown).
- Pontos fixos do paciente: o que é importante lembrar sempre — história, significantes recorrentes, sonhos, hipóteses.
- Tags e busca de texto completo em todas as notas.
- Marcador "levar para supervisão", com o que foi discutido e quando.
- Separação entre registro documental (o que poderia ser exigido) e anotações pessoais do analista.

**Painel do consultório**

- Sessões da semana, pacientes ativos, faltas do mês, valores a receber e receita do mês por paciente.

## Módulo Finanças

> **Simplificado em 9 nov 2026 (v0).** Finanças cuida só do dinheiro do trabalho: o que entra (pacientes e outras entradas) e o que sai (sala, supervisão, análise, divulgação…). **Investimentos e patrimônio saíram do escopo.** O que está abaixo de "v0" fica como ideia para depois, se fizer falta.

**v0 — o que existe hoje**

- **Entradas:** os pagamentos de pacientes já são entradas por si (não são copiados para outra tabela). Dá para lançar entradas avulsas (palestra, repasse).
- **Lançamentos:** tabela `lancamentos` com data, descrição, valor (`Dinheiro`, sempre positivo), tipo entrada/saída e categoria (sugestões + texto livre).
- **Fixo mensal:** um lançamento marcado como fixo forma uma série (`serie_id`). "Lançar fixos" repete no mês o último de cada série; desmarcar o fixo no último encerra a série.
- **Tela:** Resumo (mês atual, mês a mês com gráfico em R$, saídas por categoria, entradas por origem), Lançamentos (por mês, com filtros e edição) e Divulgação (ainda fictícia).
- Contas servem só para dizer onde o pagamento de paciente entrou; sem saldo nem transferências.

**Ideias para depois (fora da v0)**

- Contas com saldo calculado e ajuste de conferência; transferências entre contas e moedas.
- Categorias em dois níveis; importação de extratos CSV/OFX com regras ("contém UBER → Transporte").
- Relatórios: receita por mês, por paciente, por origem (clínica-escola × particular), ticket médio e taxa de faltas.
- Visão fiscal mensal: total recebido de pessoas físicas, útil para o carnê-leão (ou para a PJ).
- Orçamento mensal por categoria e metas.
- Câmbio: cotações registradas; todo valor guardado na moeda original e convertido só na exibição.
- ~~Investimentos e patrimônio~~ (fora do escopo, decisão de 9 nov 2026).

## Módulo Divulgação (anúncios)

Ajuda a controlar quanto se gasta com anúncios (Instagram, Google, outros) e se isso traz pacientes. Começa simples e será refinado depois.

**Básico (hoje com dados fictícios)**

- Campanhas: nome, plataforma (Instagram, Google, Facebook, outro), período, orçamento, valor gasto, alcance/impressões, cliques e contatos recebidos.
- Pacientes captados: pacientes com origem "anúncio" ligados à campanha.
- Indicadores do mês: gasto total, contatos, custo por contato, pacientes captados e custo por paciente captado.
- O gasto com anúncios entra em Finanças como saída na categoria *Divulgação*.

**Depois (a definir)**

- Retorno por campanha: receita gerada pelos pacientes captados × gasto.
- Funil simples (contato → primeira sessão → paciente ativo) e orçamento mensal de divulgação com alerta.
- Talvez importar relatórios CSV do Meta/Google Ads.

## App completo (Fase 8)

Sugestões de 16 nov 2026 para o app cobrir o dia a dia inteiro de quem atende, não só agenda e prontuário. A ordem e o escopo de cada bloco serão decididos depois; alguns (nota fiscal, documentos) são bons diferenciais para a venda.

**Documentos e arquivos**

- **Anexos ao prontuário:** encaminhamentos, exames, laudos de outros profissionais, documentos do paciente. Cada anexo tem natureza (documental/pessoal), como as notas, e entra na exportação do prontuário.
- **Documentos emitidos pela psicóloga** com modelos que seguem a **Resolução CFP 06/2019** (declaração, atestado psicológico, relatório, laudo, parecer): editor com modelo, numeração, PDF e assinatura digital (certificado ICP-Brasil ou assinatura gov.br).
- **Contrato terapêutico e termo de consentimento:** gerados a partir do contrato do paciente e enviados para assinatura eletrônica por link (ex.: Clicksign, ZapSign), com registro de quando foi aceito. Serve também como registro de consentimento da LGPD.
- **Comprovantes:** comprovante de Pix enviado pelo paciente anexado ao pagamento; notas e recibos de despesas anexados aos lançamentos (útil no imposto de renda).
- **Gestão:** pré-visualização, busca por nome e tag, versões, lixeira por 30 dias, limite de tamanho e lista de tipos permitidos. Guarda mínima de 5 anos para o que é prontuário.
- **Armazenamento:** bucket privado do Cloud Storage por ambiente, uma pasta por consultório, acesso só por link assinado de curta duração gerado pela API (o arquivo nunca fica público), registro em `acessos` a cada download.

**Nota fiscal e impostos**

- **NFS-e facilitada** (para quem atende como PJ ou MEI): a partir de um pagamento, ou em lote no fechamento do mês, a nota já vem preenchida (tomador com nome e CPF do paciente, serviço "psicologia e psicanálise", descrição **sem nada clínico**, como "Atendimento psicológico — sessões de novembro", valor e ISS). O app guarda o XML e o PDF, mostra o status e permite cancelar ou substituir.
- **Como emitir:** começar por um intermediário de NFS-e com API (ex.: Focus NFe, NFE.io, PlugNotas), que cuida das diferenças entre prefeituras e do padrão nacional. Avaliar depois a emissão direta pelo Emissor Nacional. O certificado digital A1 fica no Secret Manager, cifrado, nunca no navegador.
- **Reforma tributária:** acompanhar os campos novos de IBS/CBS na NFS-e, que entram em fase de testes a partir de 2026.
- **Receita Saúde** (para quem atende como pessoa física): continua manual, porque não há API pública conhecida; o app prepara os dados de cada recibo para copiar e marca o que foi emitido (já existe).
- **Carnê-leão:** relatório mensal do que foi recebido de pessoas físicas, pronto para lançar; despesas dedutíveis (sala, supervisão…) vindas dos lançamentos.

**Pagamentos**

- **Cobrança por Pix com QR Code e baixa automática:** integração com um provedor de pagamento (ex.: Asaas, Efí, Mercado Pago). O app gera a cobrança do fechamento do mês; quando o paciente paga, um webhook marca o pagamento sozinho.
- Link de pagamento por cartão, para quem pedir.
- Lembrete de cobrança em aberto, com a mensagem pronta de hoje.

**Comunicação com pacientes**

- Lembrete de sessão e de cobrança enviados automaticamente por WhatsApp (API oficial do WhatsApp Business, mensagens com modelo aprovado e custo por envio) ou por e-mail, além do envio manual de hoje.
- Confirmação de presença por um link na mensagem (confirmo / preciso remarcar).
- Nenhum conteúdo clínico nas mensagens; o texto segue os modelos de Configurações.

**Área do paciente** (a decidir: muda o escopo original)

- Link seguro (sem senha, com código por e-mail ou WhatsApp) para o paciente ver as próximas sessões, confirmar presença, pagar, baixar recibos e notas fiscais, assinar contrato e termo, e preencher uma ficha antes da primeira sessão.
- Depois, talvez: pedido de horário dentro dos horários livres da agenda.

**Atendimento online**

- Link do Google Meet na sessão (ver Agenda) e checklist do cadastro no **e-Psi**, que o CFP exige de quem atende online.

**Lista de espera e primeiros contatos**

- Quem pediu atendimento, de onde veio, quando foi a entrevista inicial e se virou paciente. Alimenta o funil da Divulgação.

**Clínica com vários profissionais**

- Agenda compartilhada, salas (reserva de sala e conflito), repasse por profissional (percentual ou valor fixo) e relatórios por profissional.
- **Clínica-escola e estágio:** supervisor com acesso de leitura às notas dos estagiários que supervisiona, com registro de acesso.

**Formação (o tripé)**

- Registro de análise pessoal, supervisão e estudo teórico (horas, datas, com quem), ligado aos compromissos da agenda e aos lançamentos fixos de Finanças. Útil para formação em instituições psicanalíticas e para comprovar horas.

**Relatórios e indicadores**

- Frequência e faltas por paciente, receita por mês e por origem, tempo médio de tratamento, pacientes novos e altas, inadimplência.

**LGPD na prática**

- Atender o pedido de um paciente (exportar ou corrigir os dados dele) em poucos cliques, com registro do pedido.
- Importação de pacientes de planilha ou de outro sistema (ajuda a vender: a pessoa chega com dados).

**A avaliar com cuidado**

- Assistente com IA (resumo de notas, transcrição): mexe com o dado mais sensível do app. Só com consentimento explícito, processamento no Brasil ou sem retenção pelo fornecedor, e desligado por padrão.
- Mobile offline (rascunho de nota sem rede): só depois do mobile básico, e sem guardar notas no aparelho sem cifra.

**Fórum entre profissionais** (registrado em 16 nov 2026; a expandir)

- Espaço de diálogo clínico entre profissionais, no modelo do Reddit: comunidades por tema ou abordagem (psicanálise, TCC, infância, supervisão de casos, ética…), posts, comentários em árvore, votos, salvos e sinalização.
- Perfis de profissionais verificados (CRP), com opção de postar anonimamente para os outros membros.
- **Sigilo:** casos só desidentificados. O fórum fica separado dos dados clínicos (banco ou schema próprio, sem acesso ao prontuário) e não tem botão de "compartilhar nota". Antes de publicar, um aviso lembra o Código de Ética e, se possível, uma checagem procura nomes, datas e lugares.
- Moderação (regras da comunidade, moderadores, denúncias) e termos de uso próprios.

## Arquitetura e stack

**Destino (nuvem):**

```text
  Web (React)            Mobile (Expo, depois)
        \                      /
   Firebase Hosting — app.<domínio>          Login: Identity Platform
        |  /api/**                            (e-mail/senha ou Google)
   API Hono — Cloud Run ──── Cloud Tasks ──── Google Agenda
        |
   Cloud SQL PostgreSQL (RLS por consultório)
```

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Linguagem | TypeScript em tudo | Tipos e regras compartilhados entre web, mobile e API |
| Interface | React + Vite + Tailwind + shadcn/ui | Rápido de montar telas bonitas e consistentes |
| Dados no web | TanStack Query sobre o cliente tipado da API | Cache por recurso, recarga só do que mudou; o mesmo padrão vale no mobile |
| Gráficos | Recharts | Simples para entradas, saídas e categorias |
| API | Hono (Node) + Zod + `@hono/zod-openapi` | Leve, tipada, mesmo container local e no Cloud Run |
| Banco | PostgreSQL + Drizzle ORM | Banco vivo, RLS, backup contínuo. Local: Postgres em Docker; testes: PGlite |
| Busca | `tsvector` + `unaccent` | Busca nas notas sem serviço extra |
| Login | Identity Platform (Firebase Auth) | E-mail/senha e Google, MFA, SDK para web e mobile. Local: emulador do Firebase Auth |
| Testes | Vitest + Playwright + axe | Regras de dinheiro e sessões, e telas em 1440/390 px |
| Mobile | React Native + Expo | Reaproveita `packages/shared` e o cliente da API |
| Infra | Pulumi (TypeScript) no Google Cloud | Ver [Infraestrutura no Google Cloud](#infraestrutura-no-google-cloud) |

**Hoje:** API local em Hono com SQLite + FTS5 (até a Fase 6.2), só em `127.0.0.1` e sem login (até a 6.3). O web busca tudo de uma vez (`GET /consultorio`) e recarrega tudo depois de cada mudança. Isso funciona na máquina, mas não serve para rede nem para o mobile; a Fase 6.1 troca por chamadas por recurso.

## Modelo de dados

Valores sempre em centavos (inteiro) + código da moeda. Instantes em ISO UTC; datas civis como `yyyy-MM-dd`. Os ids continuam texto com prefixo (`p_…`, `s_…`), o que funciona igual no Postgres.

**Tabelas de hoje (SQLite)**

| Tabela | Campos principais |
| --- | --- |
| pacientes | nome, apelido, contato, origem, modalidade, status, inicio\_em, fuso, pontos\_fixos, arquivado\_em |
| contratos | dias\_semana, horario, duracao\_min, valor, cobranca, politica\_faltas, vigente\_de, vigente\_ate |
| sessoes | paciente, contrato (null = avulsa), vaga da grade, inicio, duracao\_min, estado, valor |
| pagamentos + pagamento\_sessoes | valor, data, meio, conta, observação, recibo\_em, recibo\_numero; quais sessões quita |
| feriados | data, descrição |
| contas | nome, instituição, país, moeda, tipo |
| notas (+ busca\_fts) | paciente, sessão, tipo, texto, tags, levar\_supervisao, natureza, supervisao\_texto, supervisao\_em |
| lancamentos | data, tipo, descrição, valor, categoria, fixo, serie\_id |
| meta\_sistema | chave/valor: moedas ativas, mensagens e modelos, id do dispositivo |

**O que entra para a nuvem** (Fase 6.1, ainda no SQLite; vai junto para o Postgres na 6.2)

| Tabela | Campos principais | Para quê |
| --- | --- | --- |
| consultorios | nome, fuso, moeda principal | A raiz de tudo: toda tabela clínica e financeira ganha `consultorio_id` |
| usuarios | uid do Identity Platform, nome, e-mail | Quem faz login (o mesmo e-mail por Google ou senha é a mesma conta) |
| membros | consultorio\_id, usuario\_id, papel (`dono`, `profissional`, `suporte`) | Quem acessa qual consultório, e com que papel |
| convites | consultorio\_id, e-mail, papel, hash do token, expira\_em, aceito\_em | Só entra quem foi convidado (sem cadastro aberto até a Fase 7) |
| configuracoes | consultorio\_id, moedas ativas, mensagens e modelos, chave Pix | Sai do `meta_sistema` |
| preferencias | usuario\_id, tema, paleta, tamanho do texto, fusos, modo discreto | Sai do `localStorage`, para valer no web e no celular |
| acessos | consultorio\_id, usuario\_id, ação, recurso (paciente, nota, PDF), recurso\_id, quando | Registro de quem abriu o quê, visível para o `dono`. Nunca guarda o conteúdo |
| integracoes\_google | usuario\_id, consultorio\_id, e-mail Google, calendário, refresh token cifrado, sync token, estado, último sync, erro | A conexão com o Google Agenda de cada pessoa |
| eventos\_agenda | sessao\_id, integracao\_id, id do evento no Google, etag, sincronizado\_em | Liga sessão ↔ evento sem poluir `sessoes` |
| fila\_saida | tipo (ex.: `sessao.alterada`), ids envolvidos, criado\_em, processado\_em, tentativas | Gravada na mesma transação da mudança; um worker repassa (local: no processo; nuvem: Cloud Tasks). Garante que nenhuma mudança se perde a caminho do Google |
| compromissos | consultorio\_id, tipo (compromisso/bloqueio), categoria, título, início, duração, fuso, regra de recorrência (RRULE), até quando | Supervisão, análise, folgas: o que não é sessão de paciente. A RRULE é a mesma do Google |
| compromissos\_excecoes | compromisso\_id, data original, novo início/duração ou cancelado | "Só este evento" num compromisso recorrente |
| horarios\_atendimento | consultorio\_id, usuario\_id, dia da semana, início, fim | Sombrear fora do horário e, depois, oferecer horários livres |

**Mudanças nas tabelas existentes**

- `consultorio_id` em todas, com índice e RLS. `feriados` passa a ter chave (`consultorio_id`, `data`).
- `atualizado_em` em todas, e `criado_por`/`atualizado_por` nas clínicas (pacientes, sessões, pagamentos, notas).
- **Conflito de edição:** quem edita envia o `atualizado_em` que leu; se mudou no meio, a API responde 409 ("isto foi alterado em outro lugar"). Com web e celular abertos ao mesmo tempo e notas com salvamento automático, isso evita sobrescrever texto.
- Excluir ou remarcar uma sessão grava na `fila_saida`, para o evento no Google sair ou mudar junto.
- Saem: `pagamentos.transacao_id` (ponte com a antiga tabela de transações) e as chaves de dispositivo/sync do `meta_sistema`.

## Backup, exportação e portabilidade

> Substitui a antiga "Sincronização com o Google Drive" (16 nov 2026). Com o banco vivo na nuvem, não há snapshot para subir e baixar nem conflito entre computadores.

- **Backup do banco:** PITR do Cloud SQL (volta a qualquer minuto dos últimos 7 dias) + backup diário. Um teste de restauração antes da produção e depois a cada poucos meses.
- **Exportação pelo `dono`:** o `.cofre` (o consultório inteiro, AES-256-GCM com senha própria, ≥10 caracteres) e o prontuário em PDF por paciente. Depois, uma exportação aberta (JSON/CSV) para a portabilidade da LGPD.
- **Migração:** o `.cofre` (ou o arquivo SQLite) da versão local é o que leva seus dados para a produção (Fase 6.5).
- O Drive deixa de ser destino automático. Se quiser uma cópia fora do Google Cloud, baixe o `.cofre` e guarde onde preferir.

## Privacidade e segurança

Notas clínicas são dado pessoal sensível pela LGPD, então o sistema trata sigilo como requisito, não como extra.

- **Login:** e-mail/senha ou Google. MFA (app autenticador) obrigatório para o `dono`. O app bloqueia depois de um tempo sem uso e pede o login de novo.
- **Só convidados entram:** sem cadastro aberto até a Fase 7. Quem faz login sem ser membro de um consultório vê "sem acesso".
- **Isolamento:** RLS por `consultorio_id`. A API define o consultório da requisição dentro da transação; uma consulta sem ele não enxerga nada.
- **Papéis:** `dono` faz tudo; `profissional` atende e registra; `suporte` ajuda com a conta e **não lê notas clínicas**.
- **Registro de acesso:** quem abriu qual paciente, nota ou PDF, e quando; visível para o `dono`.
- **Dados no Brasil:** banco e API em `southamerica-east1` (São Paulo).
- **Minimização:** modo discreto (iniciais/pseudônimo na interface). No Google Agenda, o evento é privado, leva só iniciais/pseudônimo e nenhuma informação clínica.
- **Logs:** nunca conteúdo de notas nem dados de pacientes.
- **Guarda e exclusão:** arquivar ≠ excluir. A Resolução CFP 001/2009 pede guarda dos registros por no mínimo 5 anos; a exclusão definitiva é só do `dono`, com aviso.
- **Papéis na LGPD:** a psicóloga é a controladora dos dados dos pacientes; quando o app for vendido, ele é o operador (contrato de tratamento de dados, Fase 7).
- **Clínica-escola:** pacientes atendidos por ela provavelmente já têm prontuário no sistema da instituição; vale confirmar a política dela antes de duplicar notas aqui.
- **Senha do `.cofre`** guardada fora do app: sem ela, a exportação cifrada não abre.
- Até a Fase 6.3 terminar, o app local segue as regras de sigilo do `CLAUDE.md` (só `127.0.0.1`, abre direto).

## Infraestrutura no Google Cloud

> Decidida em 12 nov 2026. Substitui a de 9 nov (SQLite por conta + libSQL/Turso + Lightsail) e a primeira versão de 12 nov (AWS: Lambda + RDS + Cognito). A escolha ficou no **Google Cloud** porque o Google já entra no projeto de qualquer jeito (login, Agenda, push no mobile). Concentrando tudo lá, fica mais consistente e mais barato, e não precisa de VPC nem de NAT.

**Objetivo:** publicar numa URL com login, primeiro para você e para as pessoas que refinam o app, e depois poder vender para outros consultórios sem reescrever nada.

**Dois ambientes, mesmo código, projetos GCP separados:**

| Ambiente | Projeto GCP | Quem usa | Dados |
|---|---|---|---|
| Produção (`app.<domínio>`) | `consultorio-prod` | Só você (depois, clientes) | Reais |
| Homologação (`teste.<domínio>`) | `consultorio-staging` | Você + refinadores | Mocks fictícios, recriados a cada deploy |

Os dois projetos ficam numa só conta de cobrança. Quem refina o app só recebe acesso ao projeto de homologação e **nunca** acessa a produção: notas clínicas reais não são vistas por quem desenvolve. Quando o domínio existir, os projetos entram numa **organização** (Cloud Identity Free, grátis), o que libera políticas para a organização toda.

**Serviços**

| Camada | Escolha | Por quê |
|---|---|---|
| Domínio | `.com.br` no Registro.br (+ `.com` se estiver livre), DNS na Cloudflare (o mesmo da landing page) | `.com.br` passa mais confiança para psicólogas no Brasil. A landing page já fica no Cloudflare Pages, então o DNS fica num lugar só. O Google exige domínio verificado para liberar a agenda |
| Web | Firebase Hosting (CDN + HTTPS automático) | Grátis nesse tamanho. Os registros na Cloudflare ficam "só DNS" (sem o proxy laranja), para o certificado sair |
| API | Hono num container no **Cloud Run** (`southamerica-east1`), servido em `app.<domínio>/api/**` por um rewrite do Firebase Hosting | O mesmo `@hono/node-server` de hoje, sem adaptador. Desliga sem uso (mínimo 0 instâncias) e tem um teto de instâncias. Mesma origem do web: sem CORS no navegador e sem subdomínio `api.`. Limite: 60 s por requisição pelo Hosting |
| Banco | **Cloud SQL PostgreSQL** em `southamerica-east1`, conectado pelo conector do Cloud Run com autenticação IAM | Sem VPC e sem NAT. O IP público fica sem redes autorizadas, então só o conector entra. Backup automático + PITR, proteção contra exclusão |
| Login | **Identity Platform**: e-mail/senha + Google, uma conta por e-mail, MFA (TOTP) para o `dono` | Google nativo, SDK para web e mobile. Grátis até 50 mil usuários ativos por mês. A API valida o ID token; o papel vem da tabela `membros` |
| Google Agenda | "Conectar agenda" em Configurações, OAuth separado do login, no mesmo projeto. Refresh token cifrado com **Cloud KMS** | O token do login não serve para chamar a agenda. A `fila_saida` alimenta o **Cloud Tasks**, que tenta de novo sozinho se o Google falhar |
| Segredos | Secret Manager | Nada de segredo em variável fixa nem no repositório. Inclui, na Fase 8, o certificado A1 da NFS-e |
| Arquivos (Fase 8) | Cloud Storage privado, uma pasta por consultório, links assinados de curta duração | Anexos, documentos emitidos, XML/PDF de notas fiscais, comprovantes |
| Webhooks (Fase 8) | Rotas da própria API no Cloud Run, com assinatura conferida | Pix pago, NFS-e emitida, documento assinado |
| Mobile | Expo; push pelo **Firebase Cloud Messaging** | Login, push e API no mesmo projeto |
| Infra como código | **Pulumi em TypeScript** (`@pulumi/gcp`), estado num bucket do Cloud Storage, segredos do Pulumi cifrados com Cloud KMS | O projeto fica numa linguagem só, e o estado não depende de outro serviço |
| CI/CD | GitHub Actions com **Workload Identity Federation** (sem chave de conta de serviço). Imagem no Artifact Registry | Deploy automático na homologação a cada push |

**Custo** (aproximado, confirmar na calculadora do GCP)

- Produção ~US$ 15–25/mês: quase tudo é o Cloud SQL na menor instância (núcleo compartilhado). Cloud Run, Hosting, KMS e Artifact Registry ficam perto de zero.
- Homologação ~US$ 5–10/mês: o Cloud Run desliga sozinho, e o banco desliga fora do horário de uso (Cloud Scheduler).
- **O alerta de orçamento não bloqueia o gasto.** O freio é o teto de instâncias do Cloud Run. Na homologação, um alerta que passar do limite pode desligar a cobrança do projeto automaticamente.
- A menor instância do Cloud SQL é compartilhada e sem SLA: serve para começar. Para vender, sobe para uma instância dedicada.

**Segurança da infraestrutura**

- **Acesso:** sua conta Google com verificação em duas etapas (chave de segurança ou passkey). Papéis IAM mínimos; uma conta de serviço por serviço, só com o que ele usa. Política da organização proíbe criar chaves de conta de serviço.
- **Auditoria:** Cloud Audit Logs (atividade administrativa já vem ligada; ligar também os logs de acesso a dados do Cloud SQL e do KMS) e o nível gratuito do Security Command Center.
- **Banco:** cifrado em disco por padrão (chave gerenciada pelo Google; chave própria no Cloud KMS, CMEK, quando for vender) e TLS.
- **Cifra campo a campo das notas fica para depois.** Ela impediria a busca no servidor. Se vier, começa só pelas anotações pessoais.
- **Repositório:** privado no GitHub, com secret scanning e push protection, `master` protegida. O Dependabot fica desligado ou configurado para respeitar o `minimumReleaseAge` de 14 dias.

**Google (começar cedo)**

O login com Google e, principalmente, o escopo da agenda exigem domínio verificado, uma página de política de privacidade nele, o logo do app e uma verificação do app pelo Google. O escopo da agenda é "sensível" e a verificação pode levar semanas. Por isso a tela de consentimento OAuth do projeto `consultorio-prod` e o pedido de verificação entram na Fase 6.0, em paralelo com o resto. Na homologação, a tela de consentimento fica em modo de teste, com os refinadores como usuários de teste.

**Por que Postgres (e não SQLite por conta)**

Com web, mobile e vários consultórios, um banco gerenciado com RLS, backup contínuo e conexões de vários clientes é o caminho que escala sem trocar de arquitetura depois. O custo é reescrever a busca (FTS5 → `tsvector`), as triggers e as migrações, e passar o serviço para async: trabalho de uma vez, feito localmente antes de qualquer gasto com nuvem.

**Em aberto**

- **Mobile:** app nativo (Expo) logo depois da produção, ou primeiro um PWA (o web instalável no celular)?
- **Nome do domínio.**

## Roadmap por fases

Cinco fases de core, cada uma termina num app que você já usa de verdade. A Fase 6 leva o app para a nuvem e a 7 é a venda.

**Fase 1 — Consultório básico**

- [x] Estrutura do projeto, banco, migrações e tela de acesso com PIN *(o PIN saiu em 6 nov 2026; o login volta na Fase 6)*
- [x] CRUD de pacientes e contratos (com arquivar/excluir só para *interrompido*)
- [x] Geração de sessões pela grade fixa e marcação de estado
- [x] Registro de pagamentos e saldo por paciente
- [x] Exportar/importar o `.cofre` (snapshot cifrado)

**Fase 2 — Notas clínicas**

- [x] Notas por sessão e pontos fixos do paciente (editor markdown)
- [x] Tags, busca de texto completo e lista "supervisão"
- [x] Painel do consultório

**Fase 3 — Finanças essenciais** (simplificada em 9 nov 2026)

- [x] v0: pagamentos de pacientes como entradas + lançamentos manuais (entrada/saída, categoria)
- [x] v0: fixos mensais (aluguel, supervisão…) com "Lançar fixos" do mês
- [ ] Divulgação com dados reais: campanhas, gasto ligado aos lançamentos, pacientes captados
- ~~Sincronização com o Drive pela API~~ (substituída pelo banco vivo na nuvem, 16 nov 2026)
- [ ] Talvez: importação de extratos CSV/OFX com regras

**Fase 4 — Investimentos e patrimônio** (fora do escopo por ora)

- ~~Ativos, aportes, resgates e posições~~
- [ ] Talvez: tabela de câmbio e moeda de relatório (totais convertidos)

**Fase 5 — Refinamentos**

- [ ] Orçamento e metas
- [ ] Recibos em PDF e fechamento mensal
- [ ] Visão fiscal mensal (carnê-leão / PJ)
- [ ] Divulgação avançada: retorno por campanha, funil, orçamento de anúncios
- [ ] Cotações automáticas
- ~~Empacotar como app de desktop (Tauri)~~ (o destino agora é web + mobile)

**Melhorias de uso (9 nov 2026)**: review pensando no dia a dia de uma psicóloga

- [x] Nota da sessão direto do Painel e do painel da agenda (sem abrir a ficha)
- [x] "Sem registro": sessões passadas que continuam "agendadas", com ações rápidas
- [x] "Para relembrar" antes da sessão: pontos fixos + nota anterior
- [x] Cobranças: fechamento do mês por paciente, mensagem pronta (WhatsApp/copiar) com chave Pix
- [x] Recibos do Receita Saúde: a emitir / emitidos (pagamentos em real), marcar todos
- [x] Sessão avulsa (menu Novo e ficha)
- [x] Editor de notas com barra de formatação e modelo de registro documental (CFP 001/2009)
- [x] Supervisão: parte "Discutido em supervisão" + data; abas "A levar" / "Discutidas"; texto entra na busca
- [x] Lembrete de sessão (Painel → Amanhã, painel da agenda), no fuso do paciente
- [x] Lista de pacientes: última/próxima sessão e alerta de quem está sem sessão há 21+ dias
- [x] Configurações: cor principal (paletas + personalizada), tamanho do texto, mensagens e modelos
- [x] Painel: real primeiro nos cards; sem selo duplicado na lista "Hoje"

**Agenda no estilo do Google** (pode começar a qualquer momento; precisa estar pronta antes da 6.6)

- [ ] Clicar num horário vazio abre o cartão rápido; arrastar seleciona o intervalo; atalho `c`
- [ ] Compromissos e bloqueios (tabelas `compromissos`, `compromissos_excecoes`), com recorrência RRULE
- [ ] Redimensionar pela borda muda a duração
- [ ] Pergunta "só esta / esta e as seguintes" ao mover, redimensionar, cancelar ou excluir algo recorrente (sessão: nova versão do contrato; compromisso: exceção ou nova série). Testes cobrindo sessões com nota, pagamento e remarcação manual
- [ ] Desfazer; aviso de conflito
- [ ] Visões semana de trabalho e lista; mini calendário; atalhos de teclado
- [ ] Horário de atendimento (`horarios_atendimento`) sombreado na grade
- [ ] Testes visuais das telas novas

**Fase 6 — Nuvem.** A ordem tira o risco primeiro: a 6.1 prepara o app sem mudar nada de infraestrutura, a 6.2 e a 6.3 trocam banco e login localmente, e só a 6.4 começa a gastar com nuvem. A 6.0 corre em paralelo, porque a verificação do Google demora.

**Fase 6.0 — Fundação** (sem gasto, em paralelo)

- [x] `.gitignore` com `*.cofre` e `.env*`
- [ ] Repositório privado no GitHub: secret scanning com push protection, `master` protegida, Dependabot desligado ou respeitando os 14 dias
- [ ] Domínio `.com.br` no Registro.br (+ `.com` se livre), nameservers na Cloudflare (junto com a landing page)
- [ ] Página de política de privacidade no domínio
- [ ] Conta de cobrança no GCP + projetos `consultorio-staging` e `consultorio-prod`, verificação em duas etapas na conta Google
- [ ] Tela de consentimento OAuth no `consultorio-prod` (com o logo da 6.1), domínio verificado e pedido de verificação do escopo da agenda

**Fase 6.1 — Preparar o app** (local, no SQLite de hoje; já dá para começar)

*Dados e API*

- [ ] Contexto da requisição: um middleware define usuário, consultório e papel, e todo serviço recebe esse contexto. Local: `dono` fixo, sem login de verdade
- [ ] Novas tabelas: `consultorios`, `usuarios`, `membros`, `convites`, `configuracoes` (sai do `meta_sistema`), `preferencias` (sai do `localStorage`), `acessos`
- [ ] `consultorio_id` e `atualizado_em` em todas as tabelas; `criado_por`/`atualizado_por` nas clínicas; sai `pagamentos.transacao_id`
- [ ] Conflito de edição (409) com `atualizado_em`, começando por notas e sessões
- [ ] Registro de acesso: abrir ficha, nota e PDF grava em `acessos`
- [ ] API por recurso (pacientes, sessões por intervalo, notas por paciente, com paginação) no lugar do pacote único `GET /consultorio`
- [ ] OpenAPI gerado dos schemas Zod (`@hono/zod-openapi`) e cliente tipado
- [ ] Web com TanStack Query sobre o cliente tipado (recarrega só o que mudou)
- [ ] Configuração por variáveis de ambiente (`HOST`, `PORT`, banco, modo de login), healthcheck, logs estruturados sem dados de pacientes, `Dockerfile`

*Login mockado*

- [ ] Provedor de sessão (`useSessao`) com implementação mock, pronto para trocar pelo Firebase Auth
- [ ] Telas: Entrar (Google + e-mail/senha), Criar senha a partir do convite, Esqueci a senha, Código do MFA, Sem acesso, Sair
- [ ] Configurações → Conta: nome, e-mail, métodos de login (Google ligado, senha, MFA)
- [ ] Local continua abrindo direto, logado como `dono` (regra do `CLAUDE.md`); `?mock=deslogado` mostra o login. Testes visuais das telas novas

*Ícones*

- [ ] Ícone do app na direção "Sálvia": favicon (SVG + ICO), `apple-touch-icon`, ícones maskable 192/512
- [ ] `manifest.webmanifest` com nome, cores e `theme-color` claro/escuro (base para um PWA). Sem service worker que guarde dados clínicos
- [ ] Logo 120×120 para a tela de consentimento do Google; os mesmos arquivos servem depois para o Expo

*Google Agenda mockado*

- [ ] Configurações → Integrações → Google Agenda: estados desconectado, conectando, conectado (e-mail e calendário escolhido), sincronizando e erro
- [ ] Prévia de como a sessão aparece no Google (iniciais/pseudônimo, horário, sem nada clínico)
- [ ] Função pura `eventoDaSessao` em `packages/shared`, com testes: título, início/fim, fuso, evento privado, id da sessão nas propriedades privadas
- [ ] Tabelas `integracoes_google`, `eventos_agenda` e `fila_saida`; criar, remarcar, cancelar ou excluir sessão grava na fila; um worker local só marca como processado

**Fase 6.2 — API em Postgres** (local)

- [ ] Postgres em Docker no desenvolvimento; PGlite nos testes
- [ ] Schema Drizzle em PostgreSQL (com tudo da 6.1) e migrações novas
- [ ] Serviço async
- [ ] Row-Level Security por `consultorio_id`
- [ ] Busca com `tsvector` + `unaccent` (substitui FTS5 e triggers)
- [ ] Importação do SQLite/`.cofre` para o Postgres

**Fase 6.3 — Login de verdade** (local, emulador do Firebase Auth)

- [ ] Trocar o mock pelo Identity Platform: e-mail/senha e Google, uma conta por e-mail
- [ ] API valida o ID token e busca o papel em `membros`; quem não é membro vê "sem acesso"
- [ ] MFA (TOTP) obrigatório para o `dono`; bloqueio por inatividade
- [ ] Convites por e-mail
- [ ] Sai a guarda de loopback + `x-consultorio`; entram token obrigatório e limite de tentativas
- [ ] Atualizar `CLAUDE.md` (regras de loopback e de acesso)

**Fase 6.4 — GCP e homologação**

- [ ] Organização (Cloud Identity Free) com os dois projetos; política que proíbe chaves de conta de serviço
- [ ] Alertas de orçamento, logs de acesso a dados (Cloud SQL, KMS), Security Command Center gratuito
- [ ] Pulumi (TypeScript, estado no Cloud Storage): Cloud SQL, Cloud Run, Artifact Registry, Firebase Hosting com rewrite de `/api/**`, Identity Platform, Secret Manager, Cloud KMS, Cloud Tasks
- [ ] GitHub Actions com Workload Identity Federation, deploy na homologação a cada push
- [ ] Homologação com mocks fictícios recriados a cada deploy; banco desligado fora do horário de uso
- [ ] Convites para refinadores (só homologação)

**Fase 6.5 — Produção**

- [ ] Deploy no `consultorio-prod`; PITR ligado, proteção contra exclusão e um teste de restauração feito
- [ ] Migrar seus dados da versão local (`.cofre`/SQLite → Postgres) por um canal cifrado, e apagar as cópias temporárias
- [ ] Teste final: login, paciente fictício, sessão, pagamento, nota, PDF, restauração

**Fase 6.6 — Google Agenda de verdade**

- [ ] OAuth "Conectar agenda" (escopo de eventos), refresh token cifrado com Cloud KMS
- [ ] Sessões como eventos individuais; compromissos recorrentes como eventos com RRULE
- [ ] Link do Google Meet opcional nas sessões online, enviado ao paciente pela mensagem pronta
- [ ] Cloud Tasks consumindo a `fila_saida`: sessão → evento no Google, com novas tentativas
- [ ] Desconectar apaga o token e, se você quiser, os eventos criados pelo app
- [ ] Depois, opcional: mostrar na agenda do app os horários ocupados do Google (só leitura)

**Fase 6.7 — Mobile**

- [ ] Decidir: Expo nativo ou PWA primeiro
- [ ] App consumindo a API pelo cliente gerado do OpenAPI e as regras de `packages/shared`; login pelo Firebase Auth; push pelo Firebase Cloud Messaging

**Fase 7 — Venda** (a planejar quando e se decidir)

- [ ] Cadastro self-service: cria o consultório (`consultorio_id`) e o usuário `dono`
- [ ] Cobrança por assinatura (Stripe ou Asaas)
- [ ] Escalar: Cloud SQL dedicado com alta disponibilidade, réplicas de leitura e chave própria (CMEK); Cloud Run já escala sozinho
- [ ] Termos de uso, política de privacidade e contrato de tratamento de dados (DPA)
- [ ] Exportação completa e exclusão dos dados do cliente (portabilidade LGPD)

**Fase 8 — App completo** (a priorizar; detalhes em [App completo](#app-completo-fase-8))

- [ ] Documentos e arquivos: anexos ao prontuário, documentos CFP 06/2019, contrato e termo com assinatura eletrônica, comprovantes
- [ ] NFS-e facilitada por um intermediário com API; carnê-leão mensal
- [ ] Pix com QR Code e baixa automática por webhook
- [ ] Lembretes automáticos (WhatsApp/e-mail) e confirmação de presença
- [ ] Área do paciente (a decidir)
- [ ] Lista de espera e primeiros contatos
- [ ] Clínica com vários profissionais: agenda compartilhada, salas, repasses, supervisão de estagiários
- [ ] Formação: registro do tripé (análise, supervisão, estudo)
- [ ] Relatórios e indicadores; ferramentas de LGPD; importação de pacientes
- [ ] Fórum entre profissionais (modelo Reddit): só registrado, a expandir

Os prompts usados nas Fases 1–3 estão em [`docs/historico/prompts-fases-1-3.md`](historico/prompts-fases-1-3.md).
