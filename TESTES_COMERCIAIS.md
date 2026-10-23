# Testes comerciais — 22/10/2026

Resultado registrado: **66 casos da suíte Node aprovados em execuções complementares** (64 na execução padrão e dois PostgreSQL executados separadamente); **74 cenários de navegador** (26 gerais, 27 de compatibilidade, cinco PWA, 12 replays e quatro de continuidade offline/multiabas); **11 verificações agregadas Supabase real local** (uma contém seis subpassos UI/BFF); **quatro fases de carga simulada**. Total de 155 verificações nesse critério de agrupamento. Não somar novamente baseline, reruns, os 18 testes de dados incluídos na suíte Node ou os seis subpassos do agregado Supabase.

Serviços externos nesta missão: nenhuma geração IA, chamada Stripe autenticada, mensagem para destinatário externo ou alteração cloud. A instalação consultou registros públicos de pacotes, documentação oficial e imagens de contêiner. O replay reutilizou as duas respostas OpenRouter já gravadas; não é uma nova homologação real do provedor.

## Baseline e execução final

Antes de editar funcionalidades: build;48 casos Node (47passaram,1PG separado); PostgreSQL isolado1/1; interface (26 casos)/26; replay (12 casos)/12. Logs em `evidencias/comercial/baseline/`. SHA256 do ledger registrado antes e confirmado depois.

| Etapa | Resultado | Evidência |
|---|---|---|
| pnpm install --frozen-lockfile --ignore-scripts | aprovado | instalacao.log |
| pnpm run build / check / test:seguranca | aprovado; 90 arquivos na verificação de sintaxe registrada | build.log, sintaxe.log |
| pnpm test |66 casos; 64 aprovados, dois PG ignorados na execução padrão, nenhuma falha | unitarios.log |
| test:postgres com flag explícita |2/2PostgreSQL15 reais | postgres.log |
| Interface geral |26/26 | interface-geral.log, ../interface/resultado.json |
| Interface comercial |27/27,9por motor | interface/resultado.json |
| Atualização PWA |5/5Chrome real | pwa-atualizacao/resultado.json |
| Continuidade offline/multiabas |4/4 Chrome real, backend simulado | continuidade-interface.json |
| Replay respostas anteriores |12/12,nenhuma nova chamada | replay.log |
| Supabase real local |11/11agregados,6subpassosHTTPS | supabase-local.json, supabase-teste.log |
| Carga isolada |4fases,integridade mantida | carga-comercial.json |
| Auditoria dependências produção |nenhuma vulnerabilidade conhecida na execução | dependencias.log |
| Fonte limpa sem .env/node_modules anterior |installfrozen,build,sintaxe aprovados | fonte-limpa.log, ../fonte-limpa.json |
| Credenciais atuais/antigas em assets |ausentes;chave atual difere da exposta | credenciais.json |

Caminhos da coluna evidência são relativos a `evidencias/comercial/`, salvo indicação. Verificar data de cada arquivo: as evidências históricas e de carga não são sobrescritas por cada teste de documentação.

## Matriz de aceitação

Estados usados literalmente; serviço real executado em loopback recebe **APROVADA EM AMBIENTE LOCAL**. **APROVADA COM SERVIÇO REAL DE HOMOLOGAÇÃO** fica reservado para uma rodada futura autorizada no provedor hospedado; nenhum resultado desta missão recebeu esse estado por conveniência.

| ID / função | Estado | Procedimento e entrada | Esperado e obtido | Evidência / reprodução |
|---|---|---|---|---|
| A01 cadastro/confirmação | APROVADA EM AMBIENTE LOCAL | UI cria conta .test; abre TokenHash do Mailpit | sem sessão antes; sessão segura após confirmação; token de uso único | Supabase (11 agregados);test:supabase:local |
| A02 login/logout/invalidade | APROVADA EM AMBIENTE LOCAL | senhas correta/incorreta e encerramento | sessão validada;credenciais inválidas negadas | Supabase e testes backend |
| A03 recuperação | APROVADA EM AMBIENTE LOCAL | UI pede e-mail local, redefine e entra | token não reutilizável;senha antiga inválida | Supabase HTTPS (seis subpassos) |
| A04 refresh/revogação | APROVADA EM AMBIENTE LOCAL | invalida acesso, mantém refresh;encerra sessão | BFF renova;RPC nega sessão revogada | Supabase,testes backend |
| A05 expiração de link | APROVADA COM SIMULAÇÃO | token fictício retorna400 | erro textual;sem token em URL/storage;retry disponível | comercial-interface3motores |
| A06 isolamento RLS/RPC | APROVADA EM AMBIENTE LOCAL | dois usuários reais/anon tentam ler tabela/RPC | acesso direto negado;BFF dono validado | Supabase,Postgres |
| A07 integridade CAS/idempotência | APROVADA EM AMBIENTE LOCAL | revisões simultâneas e mesma chave |409emversão antiga;mesmoresultado sem duplicação | Supabase,Postgres |
| A08 imagem privada | APROVADA EM AMBIENTE LOCAL | uploadPNG,URLpública,outro titular | objeto recuperável pelo dono;demais negados | Supabase Storage |
| A09 limites imagem | APROVADA COM SIMULAÇÃO | MIME, tamanho, quantidade ou bytes inválidos |400/429, sem upload indevido | backend,comercial,PG |
| A10 A→B→A | APROVADA COM SIMULAÇÃO | editaB e retorna ao foco em A | revisão atualizada sem nova edição em A | dados.browser.test.js |
| A11 segundo navegador real | APROVADA EM AMBIENTE LOCAL | B entra na mesma conta após foto/peso emA | dados e foto originais recuperados | Supabase HTTPS |
| A12 offline/conflito/exclusão | APROVADA COM SIMULAÇÃO | desconecta,edita emduasversões,reconecta | outbox retoma;409 exige escolha;sem sobrescrita silenciosa | dados (18 casos),interface (26 casos) |
| A13 uploadinterrompido/fechamento | APROVADA COM SIMULAÇÃO | falha de upload ou resposta e recarrega | foto local preservada;intenção UUID reutilizada | dados (18 casos) |
| A14 conta/legado | APROVADA COM SIMULAÇÃO | mudaA→B,migra comconsentimento | namespace isolado;legado original preservado | dados (18 casos),interface (26 casos) |
| A15 exclusão conta+imagens | APROVADA EM AMBIENTE LOCAL | exclui conta via BFF e Auth | Storage removido,cascata,GETposterior 401 | Supabase HTTPS,base10 |
| A16 export/importintegral | APROVADA COM SIMULAÇÃO | diário comfoto/perfil/metas/água/peso | importação idempotente;backup sem imagem falha | dados (18 casos),interface (26 casos) |
| A17 dump+objetosrestore | APROVADA EM AMBIENTE LOCAL | dumpDBoutro database;bytesreuploadoutro caminho | revisão/usuário restaurados;SHA256 da imagem igual | Supabasebase8/9 |
| A18 planos/benefícios/periodos | APROVADA COM SIMULAÇÃO | configuração grátis/pago,mensal/anual | servidor aplica quota;browser não envia Price ID | comercial.test,interface27 |
| A19 checkoutconcorrente | APROVADA COM SIMULAÇÃO | dois pedidos e mesma intenção do servidor | mesma chave Stripe;sem compra duplicada | backend-contratos.test |
| A20 renovação/recusa/cancelamento | APROVADA COM SIMULAÇÃO | eventos de fixture e estado atual active/past_due/canceled | autorização usa estado atual e expiração | backend/comercial/PG |
| A21 refund/disputa/order/dedup | APROVADA COM SIMULAÇÃO | parcial/integral,disputa vencida/aberta, eventos repetidos | bloqueio por referência;evento de assinatura não relibera indevidamente | comercial6,PG |
| A22 Stripe sandbox externo | BLOQUEADA POR DEPENDÊNCIA EXTERNA | falta chave/PriceID/webhook/portal autorizados | nenhum checkout/pagamento externo executado | configuração e notas custos |
| A23 orçamento/reservaIA | APROVADA EM AMBIENTE LOCAL |oito reservas concorrentes com teto para três |três aceitas, cinco bloqueadas; saldo desconhecido retido | Postgres003 |
| A24 reconciliação+antirepetição | APROVADA EM AMBIENTE LOCAL | custo comprovado,mesma conciliação, custo divergente, resultado expirado | atualização idempotente; divergência negada; tombstone 409 | Postgres003 |
| A25 IAfrontendtimeout/reload/JSON | APROVADA COM SIMULAÇÃO | resposta perdida e JSON 200 truncado | mesma UUID persistida; uma execução simulada | dados (18 casos),nutrição (14 casos) |
| A26 IArealalimentar | APROVADA COM SIMULAÇÃO | replay das respostas reais históricas | correções e backup funcionam; nenhuma chamada nova | replay (12 casos) |
| A27 novos tetos no OpenRouter real | IMPLEMENTADA, MAS NÃO TESTADA | provider.max_price configurável | payload validado com fixture; sem rede externa | comercial.test;exige rodada autorizada |
| A28 saúde/métricas/alertas | APROVADA EM AMBIENTE LOCAL |24 métricas concorrentes, permissões RPC, segredo fraco/forte | histograma, total 25, anon negado, alertas | operacao.test,operacao-postgres |
| A29 retenção/inventárioórfãos | APROVADA EM AMBIENTE LOCAL | registros antigos e referências de imagens | limpeza seletiva; ledger preservado; órfãos agregados | Postgres003/004 |
| A30 PWAupdate/offline | APROVADA EM AMBIENTE LOCAL | worker 2 aguarda, Cancelar/Confirmar, recarga sem servidor | rascunho preservado até confirmar; cache 1 removido; API sem cache | PWA5,compat27 |
| A31 responsividade/teclado | APROVADA COM SIMULAÇÃO |320/390/768/1440 px, temas claro/escuro e movimento reduzido | sem overflow horizontal; formulário e erro acessíveis | comercial (27 casos),geral26,screenshots |
| A32 Chrome/Firefox/WebKit | APROVADA COM SIMULAÇÃO |nove cenários por motor disponível |27 passaram | comercial-interface |
| A33 Android/iOS/câmera física/installSO | BLOQUEADA POR DEPENDÊNCIA EXTERNA | sem aparelhos ou controle real do SO | viewport e galeria automatizada não comprovam aparelho | ensaio físico pendente |
| A34 nutrição/planos/metas | APROVADA COM SIMULAÇÃO | dados inválidos, TACO incompleta e perfis protegidos | rejeição, revisão manual, planos e metas bloqueados | nutrição (14 casos),servidorvalidacao,replay |
| A35 precisão/segurançaclínica | BLOQUEADA POR DEPENDÊNCIA EXTERNA | amostra com referência medida ainda ausente | protocolo entregue; nenhuma aprovação clínica | PROTOCOLO_REVISAO_NUTRICIONAL |
| A36 LGPD/minutas/retencãoexterna | BLOQUEADA POR DEPENDÊNCIA EXTERNA | faltam responsável, base legal, contratos e prazos | minutas privadas, sem declaração de conformidade | docs/minutas |
| A37 revogaçãodaantigachave | BLOQUEADA POR DEPENDÊNCIA EXTERNA | verificar somente o painel do provedor | ausência atual comprovada; revogação não comprovada | credenciais.json |
| A38 CIremoto/deploy/gitlink | BLOQUEADA POR DEPENDÊNCIA EXTERNA | commit/push/deploy não autorizados | pipeline preparado; equivalente local executado | CI,fonte-limpa,Gitatual |
| A39 cloudSMTP/capacidadeprovedores | BLOQUEADA POR DEPENDÊNCIA EXTERNA | sem staging hospedado e quotas acordadas | apenas local e fixtures comprovados | guia deprodução |
| A40 reabrir conta offline | APROVADA COM SIMULAÇÃO | fecha e reabre offline; edita peso; reconecta | cópia local preservada sem sessão fictícia; reconexão revalida e sincroniza; logout remove lembrança | continuidade-interface (três casos) |
| A41 duas abas e cookies comuns | APROVADA COM SIMULAÇÃO | outra aba muda cookies para B enquanto A mantém namespace antigo | X-Conta-Esperada divergente nega antes da operação; dados, quota e sessão B intactos | continuidade-interface e backend-multiabas.test.js |

## Carga: resultados e limites

Adaptador JSON simulado com10.000 registros, escrita serializada e servidor com heapmáximo384MB. Não é benchmark de PostgreSQL nem de Supabase hospedado. Requests incluem200e429legítimos; o throughput não equivale a usuários ativos aprovados por segundo.

| Concorrência | Pedidos | p50ms | p95ms | p99ms | req/s | HTTP200 /429 | CPU1núcleo | picoRSSMB |
|---|---:|---:|---:|---:|---:|---|---:|---:|
|10|200|676.56|1052.10|1061.18|17.22|90/110|50.74%|160.74|
|50|200|1737.50|4165.94|4265.28|21.44|90/110|53.27%|168.96|
|100|200|1975.62|6247.46|6338.66|27.40|90/110|52.88%|173.19|
|500|1000|2583.30|9073.96|9885.91|99.20|90/910|73.16%|281.61|

Sem5xx e sem alteração dos10.000 registros fictícios em cada fase. Limites90/minporcontae120/minporrede explicam os429. PostgreSQL foi medido separadamente com concorrência8reservas e24métricas, em transações reais. Não há medição equivalente de500conexões PostgreSQL, fila cloud, coldstart, rede móvel ou disponibilidade. Latência observada de9.07sp95nafase500 desaconselha qualquer afirmação de escala pronta. Definir SLO e ensaio gradual em staging autorizado.

## Falhas encontradas e correções

Os 12 grupos B01–B12 estão descritos em IMPLEMENTACAO_COMERCIAL.md. Reruns substituíram resultados falhos após correção; logs históricos de uma tentativa podem permanecer com data anterior. O erro offline do Firefox foi da interceptação global do teste e desapareceu removendo routes antes do SW. No WebKit Windows, emulação offline bloqueou navegação no protocolo; foi usado encerramento do servidor para testar falha real de fetch e recuperação do cache. Isso não certifica Safari/iOS. A revisão final acrescentou testes de reabertura offline e duas abas compartilhando cookies, com correções verificadas antes de encerrar.

Auditor premium em modo strict terminou com58ocorrências de `affordance.actionless-button`, todas por detectar apenas handlers inline/submit. O produto usa eventlisteners externos exigidos pela CSP; handlers foram revisados por módulo e jornadas testadas. Resultado estático **não foi chamado de aprovado** nem contornado com onclick inseguro. Triagem: plano.js4,assinatura2,captura6,conta16,diet5,onboarding5,privacidade4,resultados2,settings14. Owners: app.js/plano.js/conta.js/assinatura.js/configuracoes.js/tutorial.js; navegação por data-ir-tela em app.js. Não equivale a certificação WCAG integral; faltam leitor de tela e aparelhos físicos.

## Reprodução segura

Na raiz nutrifoto: Node24,pnpm11.25.0, Docker disponível para PG/Supabase. Instale com lock congelado, faça build, rode scripts package. `pnpm test`; `$env:NUTRIFOTO_TESTAR_POSTGRES='true'; pnpm run test:postgres` em PowerShell; `pnpm run test:interface`; `pnpm run test:comercial`; `pnpm run test:pwa`; `pnpm run test:carga:comercial`. Instalar motores com `pnpm exec playwright install chromium firefox webkit`; Linux pode exigir `--with-deps`.

Para stack real local, configurar executável oficial SUPABASE_CLI e Python com cryptography conforme CONFIGURACAO_PARA_PRODUCAO.md; executar test:supabase:local. Usa apenasTEMP,loopback,contas.test eMailpit. Não executar contra um projeto existente. Não repetir o harness de IA real como forma de obter novas gerações: o ledger está encerrado. Replay anterior disponível só com respostas já gravadas.
