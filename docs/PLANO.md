# Plano — Sistema de Consultório + Finanças

Nov 3, 2026 · @Pedro

## Visão geral

Um único app local, com dois módulos que conversam entre si: **Consultório** (pacientes, sessões, cobranças, notas) e **Finanças** (contas, gastos, investimentos, patrimônio). Todo pagamento de paciente vira automaticamente uma receita no módulo financeiro, então o influxo da clínica aparece no seu fluxo de caixa sem digitar nada duas vezes.

Princípios que guiam as decisões:

- **Local primeiro:** o banco roda na sua máquina; a nuvem é só um backup/sincronização sob seu controle.
- **Um arquivo só:** todo o estado cabe num arquivo SQLite, fácil de copiar, versionar e mandar para o Drive.
- **Registrar em segundos:** marcar uma sessão como realizada e paga deve levar 2 cliques; uma nota, um campo de texto.
- **Multimoeda desde o dia 1:** BRL e AED convivem (e USD/EUR quando precisar), com uma moeda de relatório à escolha.
- **Sigilo por padrão:** dados clínicos cifrados fora da máquina e protegidos por senha dentro dela.

Fora do escopo inicial: agenda online para pacientes, emissão fiscal automática, app mobile nativo e integração direta com bancos.

> **Atualização 12 nov 2026:** "Local primeiro" e "Um arquivo só" descrevem a versão local de hoje. A direção agora é a nuvem (Postgres na AWS, login, Google Agenda e, depois, mobile): ver [Nuvem e venda](#nuvem-e-venda-direção-decidida-em-12-nov-2026).

## Módulo Consultório

O centro do módulo é a ficha do paciente: dali você vê sessões, pagamentos e notas sem trocar de tela.

**Pacientes**

- Cadastro: nome (ou iniciais/pseudônimo), contato, data de início, origem (clínica-escola, particular, indicação, anúncio), modalidade (online/presencial), status (ativo, pausa, alta, interrompido).
- Contrato: frequência (1x, 2x semana…), dia e horário fixos, valor por sessão, moeda, forma de cobrança (por sessão ou fechamento mensal) e política de faltas.
- Histórico de reajustes de valor, com data, para os relatórios não distorcerem o passado.
- **Excluir paciente:** permitido só para quem está com status *interrompido*, sempre com confirmação. Por padrão é um **arquivamento** (some das listas, mas o prontuário fica guardado, por causa da guarda mínima de 5 anos do CFP). A exclusão definitiva fica disponível com aviso explícito. *(Entra na Fase 1, junto com o CRUD.)*

**Sessões e agenda**

- A grade fixa gera as sessões futuras automaticamente.
- Cada sessão recebe um estado: realizada, falta cobrada, falta não cobrada, cancelada, remarcada.
- Visão semanal da agenda e lista "hoje" para marcar tudo rápido ao fim do dia.

**Cobranças e pagamentos**

- Saldo por paciente: sessões devidas × pagamentos recebidos.
- Registro de pagamento (valor, data, meio: Pix, transferência, dinheiro) e em qual conta entrou — isso cria a receita no módulo Finanças.
- Fechamento mensal com lista de quem deve e quanto.
- Recibo em PDF; se você emite recibos pela Receita Saúde, o sistema guarda só o número/comprovante.

**Notas clínicas**

- Nota por sessão (texto livre em markdown).
- Pontos fixos do paciente: o que é importante lembrar sempre — história, significantes recorrentes, sonhos, hipóteses.
- Tags e busca em todas as notas (busca de texto completo do SQLite).
- Marcador "levar para supervisão" e uma lista que junta essas notas.
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

O objetivo original era responder em uma tela: quanto entrou, quanto saiu, onde está guardado e quanto vale o patrimônio hoje.

**Contas — onde está cada coisa**

- Cada lugar onde há dinheiro é uma conta: banco no Brasil, banco em Dubai, cartão de crédito, corretora, cripto, dinheiro vivo.
- Cada conta tem instituição, país, moeda e tipo (corrente, poupança, cartão, investimento).
- Saldo calculado pelas transações, com ajuste manual de conferência ("o extrato diz X").

**Transações e gastos**

- Receita, despesa e transferência entre contas (inclusive entre moedas, com a taxa usada).
- Categorias em dois níveis (ex.: Moradia → Aluguel; Transporte → Parcela do carro) editáveis por você.
- Recorrências: aluguel, parcelas, assinaturas são lançadas sozinhas todo mês para confirmar.
- Importação de extratos CSV/OFX com regras de categorização automática ("contém UBER → Transporte").

**Receita da clínica**

- Pagamentos de pacientes entram como receita na categoria Clínica, ligados ao paciente e à sessão.
- Relatórios: receita por mês, por paciente, por origem (clínica-escola × particular), ticket médio e taxa de faltas.
- Visão fiscal mensal: total recebido de pessoas físicas, útil para o carnê-leão (ou para a PJ, se a receita passar por ela).

**Investimentos** (fora do escopo, decisão de 9 nov 2026)

- Ativos por tipo: renda fixa, ações, FIIs, ETFs, cripto, previdência.
- Aportes, resgates e posição atual por ativo; no início o valor atual é atualizado à mão, depois por cotação automática.
- Alocação por classe, moeda e país.

**Orçamento, metas e painéis**

- Orçamento mensal por categoria com alerta de estouro.
- Metas com valor-alvo e prazo (reserva de emergência, viagem, mudança) e quanto falta por mês.
- Painéis: patrimônio líquido ao longo do tempo, fluxo de caixa mensal, gastos por categoria, taxa de poupança.
- Câmbio: tabela de cotações diárias; todo valor é guardado na moeda original e convertido só na exibição.

## Módulo Divulgação (anúncios)

Ajuda a controlar quanto se gasta com anúncios (Instagram, Google, outros) e se isso traz pacientes. Começa simples e será refinado depois.

**Básico (já na Etapa 0, com dados fictícios)**

- Campanhas: nome, plataforma (Instagram, Google, Facebook, outro), período, orçamento, valor gasto, alcance/impressões, cliques e contatos recebidos.
- Pacientes captados: pacientes com origem "anúncio" ligados à campanha.
- Indicadores do mês: gasto total, contatos, custo por contato, pacientes captados e custo por paciente captado.
- O gasto com anúncios entra em Finanças como despesa na categoria *Divulgação*.

**Depois (a definir)**

- Gasto lançado automaticamente a partir da fatura do cartão ou da importação de extrato.
- Retorno por campanha: receita gerada pelos pacientes captados × gasto.
- Funil simples (contato → primeira sessão → paciente ativo) e orçamento mensal de divulgação com alerta.
- Talvez importar relatórios CSV do Meta/Google Ads.

## Arquitetura e stack

Uma aplicação web que roda só no seu computador: o navegador mostra a interface, uma API local fala com um arquivo SQLite, e o sync manda cópias cifradas para o Drive.

> Esta é a stack da versão local. A stack da nuvem (Lambda, RDS PostgreSQL, Cognito, CDK) está em [Nuvem e venda](#nuvem-e-venda-direção-decidida-em-12-nov-2026).

&#91;embedded content: arquitetura · 5 partes, sync com o Drive\]

Tudo acima da linha de baixo funciona offline; o Drive só entra quando você faz push ou pull.

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Linguagem | TypeScript em tudo | Sua stack de sempre; tipos compartilhados entre front e API |
| Interface | React + Vite + Tailwind + shadcn/ui | Rápido de montar telas bonitas e consistentes |
| Gráficos | Recharts | Simples para fluxo de caixa, patrimônio e categorias |
| API | Hono (Node) + Zod | Leve, tipada, roda local com um comando |
| Banco | SQLite (better-sqlite3 ou SQLCipher) + Drizzle ORM | Arquivo único, migrações tipadas, fácil de copiar para o Drive |
| Busca | SQLite FTS5 | Busca nas notas sem serviço extra |
| Testes | Vitest | Regras de dinheiro e de sessões precisam de teste |
| Desktop (opcional) | Tauri | Vira um app de verdade no fim, sem reescrever |

## Modelo de dados

São 14 tabelas; a ponte entre os módulos é `pagamentos.transacao_id`, que liga cada pagamento de paciente a uma transação de receita. Valores sempre em centavos (inteiro) + código da moeda, nunca em ponto flutuante.

| Tabela | Campos principais | Liga com |
| --- | --- | --- |
| pacientes | nome, apelido, contato, origem, modalidade, status, inicio\_em, notas\_fixas | contratos, sessoes, notas |
| contratos | frequencia, dia\_semana, horario, valor\_centavos, moeda, cobranca (sessao/mensal), vigente\_de, vigente\_ate | pacientes |
| sessoes | data\_hora, duracao\_min, estado, valor\_centavos, cobravel | pacientes, notas, pagamentos |
| notas | texto, tipo (sessao/fixa/supervisao), tags, criado\_em | pacientes, sessoes |
| pagamentos | valor\_centavos, moeda, data, meio, conta\_id, transacao\_id | pacientes, sessoes, transacoes |
| contas | nome, instituicao, pais, moeda, tipo, ativa | transacoes, posicoes |
| categorias | nome, pai\_id, tipo (receita/despesa) | transacoes, orcamentos |
| transacoes | data, valor\_centavos, moeda, tipo, descricao, conta\_id, categoria\_id, transferencia\_par\_id | contas, categorias |
| recorrencias | regra (mensal, dia X), valor, conta, categoria, proxima\_data | transacoes |
| regras\_importacao | padrao\_texto, categoria\_id | categorias |
| ativos | nome, ticker, classe, moeda | posicoes, movimentos\_investimento |
| movimentos\_investimento | data, tipo (aporte/resgate/dividendo), quantidade, valor\_centavos | ativos, contas |
| cotacoes | data, de\_moeda, para\_moeda (ou ativo), valor | ativos |
| orcamentos\_metas | categoria ou meta, valor\_alvo, periodo/prazo | categorias, contas |
| campanhas | nome, plataforma, inicio, fim, orcamento\_centavos, gasto\_centavos, moeda, impressoes, cliques, contatos | pacientes (captados), transacoes |

Uma tabela extra `meta_sistema` guarda versão do esquema, id do dispositivo e data do último sync — é o que torna a importação/exportação com o Drive segura.

## Sincronização com o Google Drive

O banco ativo fica sempre no disco local; o Drive guarda **snapshots cifrados** que você envia e baixa. Nunca rode o SQLite direto de uma pasta sincronizada: o Drive pode copiar o arquivo no meio de uma escrita e corromper o banco.

**Enviar (push)**

1. O app gera uma cópia consistente do banco com `VACUUM INTO` (ou a API de backup do SQLite).
2. Compacta e cifra o arquivo com uma senha sua (AES-256-GCM, chave derivada por Argon2/scrypt).
3. Envia para uma pasta do app no Drive pela API oficial, com escopo `drive.file` (o app só enxerga os arquivos que ele mesmo criou).
4. Grava nos metadados do arquivo: versão do esquema, id do dispositivo, data e um hash do conteúdo.
5. Mantém os últimos N snapshots (ex.: 30) para poder voltar no tempo.

**Baixar (pull)**

1. Lista os snapshots e compara com o `meta_sistema` local.
2. Se o remoto é mais novo e o local não mudou desde o último sync, substitui direto.
3. Se os dois mudaram, avisa o conflito e deixa você escolher qual manter; o perdedor vira backup, nada se apaga.
4. Antes de substituir, faz sempre um backup local do banco atual.
5. Roda as migrações se o snapshot tiver esquema mais antigo.

**Modo de uso recomendado:** um computador por vez ("escritor único"). Ao abrir o app ele oferece *pull*; ao fechar, ou a cada X minutos, faz *push*.

Alternativa mais simples para a fase 1: o botão de exportar salva o snapshot cifrado numa pasta do Google Drive para Desktop, sem OAuth. A API entra na fase 3.

## Privacidade e segurança

Notas clínicas são dado pessoal sensível pela LGPD, então o sistema trata sigilo como requisito, não como extra.

- **Senha ao abrir o app** e bloqueio automático após inatividade.
- **Banco cifrado em disco** com SQLCipher (ou, no mínimo, disco do computador cifrado com FileVault/BitLocker).
- **Nada sai da máquina sem cifra:** snapshots no Drive são cifrados antes do upload; o Google só vê bytes ilegíveis.
- **Servidor só em `127.0.0.1`**, nunca exposto à rede.
- **Minimização:** opção de identificar pacientes por iniciais ou pseudônimo na interface.
- **Guarda e exclusão:** exportar o prontuário de um paciente em PDF e arquivar quem teve alta. Se você atua como psicólogo registrado no CFP, a Resolução CFP 001/2009 pede guarda dos registros por no mínimo 5 anos.
- **Clínica-escola:** pacientes atendidos por ela provavelmente já têm prontuário no sistema da instituição; vale confirmar a política dela antes de duplicar notas aqui.
- **Senha de recuperação** guardada fora do app: sem ela, os snapshots cifrados não abrem.

## Nuvem e venda (direção decidida em 12 nov 2026)

> **Substitui a direção de 9 nov 2026** (SQLite por conta + libSQL/Turso + Lightsail). O objetivo mudou: escalar com facilidade, com **um backend que atenda web e mobile**, tudo na **AWS**, com domínio próprio, login (inclusive com Google) e integração com o **Google Agenda**.

Enquanto a Fase 6.2 (login) não termina, o app continua local e as regras de sigilo do `CLAUDE.md` (só `127.0.0.1`, sem tela de acesso) valem como estão.

**Objetivo:** publicar numa URL com login, primeiro para você e para as pessoas que refinam o app, e depois poder vender para outros consultórios sem reescrever nada.

**Dois ambientes, mesmo código, contas AWS separadas:**

| Ambiente | Conta AWS | Quem usa | Dados |
|---|---|---|---|
| Produção (`app.<domínio>`) | `prod` | Só você (depois, clientes) | Reais |
| Homologação (`teste.<domínio>`) | `staging` | Você + refinadores | Mocks fictícios, recriados a cada deploy |

Quem refina o app **nunca** acessa a produção: notas clínicas reais não são vistas por quem desenvolve. Uma terceira conta, `management`, só cuida de cobrança e da organização e não roda nada.

**Arquitetura**

| Camada | Escolha | Por quê |
|---|---|---|
| Domínio | `.com.br` no Registro.br (+ `.com` se estiver livre), DNS na Cloudflare (o mesmo da landing page): `app.`, `api.`, `teste.` como CNAMEs para a AWS | `.com.br` passa mais confiança para psicólogas no Brasil. A landing page já fica no Cloudflare Pages, então o DNS fica num lugar só; o Route 53 não é necessário. O Google exige domínio verificado para liberar a agenda |
| Web | S3 + CloudFront + certificado ACM (validado por CNAME na Cloudflare) | Estático, barato e escala sozinho. O certificado do CloudFront precisa ficar em `us-east-1` |
| API | Hono no Lambda + API Gateway HTTP API | O Hono roda no Lambda com o mesmo código. Custa quase zero em uso baixo. Fargate continua como opção se um dia fizer sentido |
| Banco | RDS PostgreSQL em `sa-east-1`, rede privada, cifrado com KMS, TLS obrigatório | Escala, tem backup contínuo (PITR), serve web e mobile e mantém os dados no Brasil |
| Multi-consultório | `consultorio_id` em toda tabela + Row-Level Security (RLS) no Postgres | Um consultório nunca vê o outro, mesmo se a API tiver bug. Construído desde já, porque custa pouco agora e evita refazer para vender |
| Busca | `tsvector` + `unaccent` no Postgres | Substitui o FTS5 e as triggers do SQLite |
| Login | Cognito com Google + e-mail/senha, MFA para o `dono` | Funciona igual no web e no mobile (OAuth + PKCE). Grátis até 10 mil usuários ativos por mês |
| Papéis | `dono`, `profissional`, `suporte` | Mesmos papéis da direção anterior |
| Google Agenda | "Conectar agenda" em Configurações, OAuth separado do login. Refresh token cifrado com KMS | O token do login não serve para chamar a agenda |
| Contrato da API | OpenAPI gerado dos schemas Zod (`@hono/zod-openapi`) | Web e mobile usam um cliente tipado, sem duplicar regras. `packages/shared` continua sendo a fonte das regras |
| Mobile | React Native + Expo, reaproveitando `packages/shared` | Regras e tipos vão para o mobile. Os componentes shadcn não vão |
| Infra | AWS CDK em TypeScript | Tudo na AWS, na mesma linguagem do resto. SST e Terraform foram considerados e descartados |
| CI/CD | GitHub Actions com OIDC (sem chaves AWS guardadas) | Deploy automático na homologação a cada push |

**Rede e custo**

- O Lambda que fala com o RDS privado fica dentro da VPC. Para chamar a internet (Google Agenda, chaves do Cognito) ele precisa de NAT. **O NAT Gateway custa ~US$ 32/mês cada**, então começamos com **fck-nat** (instância pequena, ~US$ 3/mês).
- Se o NAT pesar, as chamadas ao Google saem da VPC: um segundo Lambda fora dela, alimentado por uma fila (SQS).
- Estimativa: produção ~US$ 35–65/mês (quase tudo RDS), homologação ~US$ 10–25/mês.

**Segurança e sigilo**

- **Contas AWS:** AWS Organizations com `management`, `staging` e `prod`. Control Tower é exagero para este tamanho. Nada de usuários IAM nem chaves de longa duração: IAM Identity Center (SSO) para pessoas e OIDC para o GitHub Actions. MFA em todo usuário root.
- **Desde o primeiro dia:** orçamento com alertas (ex.: US$ 20 e US$ 50), CloudTrail da organização e GuardDuty.
- **Banco:** cifra em disco (KMS), TLS, RLS e um registro de acesso (quem abriu qual paciente e quando), visível para o `dono`.
- **Cifra campo a campo das notas fica para depois.** Ela impediria a busca no servidor. Se vier, começa só pelas anotações pessoais.
- **Google Agenda:** o título do evento usa iniciais ou pseudônimo, como no modo discreto. Nunca o nome do paciente nem nada clínico.
- **Proteção da API:** o filtro de Host loopback + `x-consultorio` dá lugar a CORS restrito ao domínio, HTTPS e limite de tentativas.
- **Logs:** a regra continua: nada de conteúdo de notas nem dados de pacientes no CloudWatch.
- **Backup:** PITR do RDS com teste de restauração. O `.cofre` (AES-256-GCM) continua como exportação/download.
- **Repositório:** privado no GitHub, com secret scanning e push protection, `master` protegida. O Dependabot fica desligado ou configurado para respeitar o `minimumReleaseAge` de 14 dias.

**Google (começar cedo)**

O login com Google e, principalmente, o escopo da agenda exigem domínio verificado, uma página de política de privacidade nele e uma verificação do app pelo Google. O escopo da agenda é "sensível" e a verificação pode levar semanas. Por isso o projeto no Google Cloud e o pedido de verificação entram na Fase 6.0, em paralelo com o resto.

**Por que Postgres agora (e não SQLite por conta)**

Com web, mobile e vários consultórios, um banco gerenciado com RLS, backup contínuo e conexões de vários clientes é o caminho que escala sem trocar de arquitetura depois. O custo é reescrever a busca (FTS5 → `tsvector`), as triggers e as migrações, e passar o serviço para async: trabalho de uma vez, feito localmente antes de qualquer gasto com AWS.

**Em aberto**

- **Mobile:** app nativo (Expo) logo depois da produção, ou primeiro um PWA (o web instalável no celular)?
- **Nome do domínio.**

## Roadmap por fases

Cinco fases de core, cada uma termina num app que você já usa de verdade; a fase 1 sozinha já substitui uma planilha. As fases 6 (nuvem: AWS, login, Google Agenda e mobile) e 7 (venda) vêm depois.

**Fase 1 — Consultório básico**

- [x] Estrutura do projeto, banco, migrações e tela de login com senha
- [x] CRUD de pacientes e contratos (com arquivar/excluir só para *interrompido*)
- [x] Geração de sessões pela grade fixa e marcação de estado
- [x] Registro de pagamentos e saldo por paciente
- [x] Exportar/importar snapshot cifrado para uma pasta do Drive

**Fase 2 — Notas clínicas**

- [x] Notas por sessão e pontos fixos do paciente (editor markdown)
- [x] Tags, busca de texto completo e lista "supervisão"
- [x] Painel do consultório

**Fase 3 — Finanças essenciais** (simplificada em 9 nov 2026)

- [x] v0: pagamentos de pacientes como entradas + lançamentos manuais (entrada/saída, categoria)
- [x] v0: fixos mensais (aluguel, supervisão…) com "Lançar fixos" do mês
- [ ] Divulgação com dados reais: campanhas, gasto ligado aos lançamentos, pacientes captados
- [ ] Sincronização com o Drive pela API (push/pull com detecção de conflito)
- [ ] Talvez: importação de extratos CSV/OFX com regras

**Fase 4 — Investimentos e patrimônio** (fora do escopo por ora)

- ~~Ativos, aportes, resgates e posições~~
- [ ] Talvez: tabela de câmbio e moeda de relatório (totais convertidos)

**Fase 5 — Refinamentos**

- [ ] Orçamento e metas
- [ ] Recibos em PDF e fechamento mensal
- [ ] Visão fiscal mensal (carnê-leão / PJ)
- [ ] Divulgação avançada: retorno por campanha, funil, orçamento de anúncios
- [ ] Cotações automáticas e, se quiser, empacotar como app de desktop (Tauri)

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

A Fase 6 leva o app para a nuvem; a 7 é a venda. Detalhes e decisões em [Nuvem e venda](#nuvem-e-venda-direção-decidida-em-12-nov-2026). A ordem tira o risco primeiro: a parte difícil (Postgres e login) é feita localmente, sem gastar com AWS até a 6.3, e a verificação do Google corre em paralelo desde a 6.0.

**Fase 6.0 — Fundação** (sem AWS)

- [x] `.gitignore` com `*.cofre` e `.env*`
- [ ] Repositório privado no GitHub: secret scanning com push protection, `master` protegida, Dependabot desligado ou respeitando os 14 dias
- [ ] Domínio `.com.br` no Registro.br (+ `.com` se livre), nameservers na Cloudflare (junto com a landing page)
- [ ] Página de política de privacidade no domínio
- [ ] Projeto no Google Cloud: tela de consentimento OAuth e pedido de verificação do escopo da agenda

**Fase 6.1 — API em Postgres** (local)

- [ ] Postgres em Docker no desenvolvimento; PGlite nos testes
- [ ] Schema Drizzle em PostgreSQL, `consultorio_id` em toda tabela, migrações novas
- [ ] Serviço async
- [ ] Row-Level Security por `consultorio_id`
- [ ] Busca com `tsvector` + `unaccent` (substitui FTS5 e triggers)
- [ ] Contrato OpenAPI gerado dos schemas Zod (`@hono/zod-openapi`)
- [ ] Script de exportação do SQLite e importação no Postgres

**Fase 6.2 — Login** (local)

- [ ] Cognito com Google + e-mail/senha, MFA para o `dono` (stub local para desenvolvimento)
- [ ] API valida o JWT; papéis `dono`, `profissional`, `suporte`
- [ ] Web com login OAuth + PKCE
- [ ] Sai a guarda de loopback + `x-consultorio`; entram CORS restrito e limite de tentativas
- [ ] Registro de acesso a dados de pacientes, visível para o `dono`
- [ ] Atualizar `CLAUDE.md` (regras de loopback e de acesso)

**Fase 6.3 — AWS e homologação**

- [ ] AWS Organizations com `management`, `staging` e `prod`; IAM Identity Center; MFA nos roots
- [ ] Orçamento com alertas, CloudTrail da organização e GuardDuty
- [ ] CDK: VPC, RDS, Lambda (Hono) + API Gateway, S3 + CloudFront, Cognito, fck-nat
- [ ] GitHub Actions com OIDC, deploy na homologação a cada push
- [ ] Homologação com mocks fictícios recriados a cada deploy
- [ ] Convites por e-mail para refinadores (só homologação)

**Fase 6.4 — Produção**

- [ ] Deploy na conta `prod`; PITR ligado e um teste de restauração feito
- [ ] Migrar seus dados do SQLite local

**Fase 6.5 — Google Agenda**

- [ ] "Conectar agenda" em Configurações (OAuth separado), refresh token cifrado com KMS
- [ ] Sincronização app → Google, com títulos em iniciais/pseudônimo
- [ ] Se o NAT pesar: chamadas ao Google num Lambda fora da VPC, via SQS

**Fase 6.6 — Mobile**

- [ ] Decidir: Expo nativo ou PWA primeiro
- [ ] App consumindo a API pelo cliente gerado do OpenAPI e as regras de `packages/shared`

**Fase 7 — Venda** (a planejar quando e se decidir)

- [ ] Cadastro self-service: cria o consultório (`consultorio_id`) e o usuário `dono`
- [ ] Cobrança por assinatura (Stripe ou Asaas)
- [ ] Escalar: RDS maior ou Aurora, réplicas de leitura; Lambda já escala sozinho
- [ ] Termos de uso, política de privacidade e contrato de tratamento de dados (DPA)
- [ ] Exportação completa e exclusão dos dados do cliente (portabilidade LGPD)

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
