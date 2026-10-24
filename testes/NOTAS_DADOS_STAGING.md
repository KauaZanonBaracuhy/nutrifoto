# Dados, Supabase real local e continuidade — 22/10/2026

## Entregue

- `sincronizacao.js` agenda atualização ao voltar à janela ou tornar a página visível. Assim, A envia, B recebe/edita/envia e A recebe sem precisar alterar um dado para iniciar a sincronização. Continua usando CAS e escolhas explícitas quando ambos editaram.
- `continuidadeConta.js` lembra somente o UUID do último titular confirmado pelo servidor para reabrir seu banco **local** quando não há conexão. Essa lembrança não cria usuário autenticado, não guarda e-mail/tokens e não concede IA, pagamento ou sincronização. Ao reconectar, a sessão precisa corresponder ao namespace antes de enviar qualquer dado. Logout, exclusão, redefinição e sessão inválida removem a lembrança.
- O cliente captura o titular esperado do namespace antes de qualquer operação assíncrona e envia `X-Conta-Esperada` nas chamadas protegidas, inclusive logout/exclusão. O BFF compara com o titular real dos cookies e rejeita `409 CONTA_ALTERADA` antes de ler/gravar dados ou produzir efeitos. Isso cobre duas abas compartilhando cookies: a antiga aba A não envia seus registros para B quando B entra em outra aba. A divergência limpa o contexto da interface e exige nova entrada; os bancos anteriores continuam preservados para seu titular.
- `chavesIa.js` guarda somente UUID, data e SHA-256 do pedido, por titular, antes de enviar IA. Falha de rede, cancelamento, timeout, JSON truncado mesmo com HTTP 200 e recarga preservam o UUID. Somente uma resposta HTTP de sucesso com JSON legível confirma e remove a intenção. O corpo e a resposta não são persistidos nesse controle. Web Locks serializa a reserva entre abas quando disponível.
- Após 24 horas sem confirmação, o cliente bloqueia o mesmo pedido e orienta conciliação, preservando a intenção; não cria outra operação por expiração. Limite de 100 pendências também bloqueia em vez de descartá-las. Apagar dados do navegador perde esse controle local; a reserva, o orçamento e a idempotência do servidor continuam obrigatórios. Isso não substitui a conciliação operacional.
- Templates Supabase `supabase/templates/confirmacao.html` e `recuperacao.html` usam fragmento `TokenHash`. Precisam ser configurados também no projeto cloud; o harness os configura somente na sua stack temporária.
- `scripts/homologar-supabase-local.js` sobe Auth, PostgREST, PostgreSQL, Storage e Mailpit reais usando CLI oficial e Docker local. Nunca lê `.env`, acessa OpenRouter, Stripe ou projeto cloud. Verifica Docker local, diretório temporário com marcador próprio e prefixo do projeto; a limpeza não usa `prune` nem altera volumes preexistentes.

## Execução reproduzível

Requer Node >= 22, Docker Desktop em execução, CLI Supabase (validado com 2.121.0), dependências npm do projeto/Chrome disponível e Python com `cryptography` (ambiente testado já possui 50.0.2). As imagens públicas são baixadas na primeira execução. Não há serviço pago. `PYTHON_EXECUTABLE` pode apontar para o Python; o harness também reconhece o Python vizinho do runtime Codex no Windows.

```powershell
$env:SUPABASE_CLI = 'C:\caminho\para\supabase.exe'
node scripts/homologar-supabase-local.js
node --test testes/dados.browser.test.js
node testes/continuidade-interface.cjs
```

O harness cria um projeto `nutrifoto-supabase-*` em TEMP, aplica as migrações SQL numeradas na ordem, executa as verificações e remove exclusivamente essa stack descartável. Usa portas 56320–56329, sujeitas à disponibilidade. A evidência sanitizada é gravada em `evidencias/comercial/supabase-local.json`; nenhuma credencial é impressa pelo script. A opção `--manter` é somente para depuração local e exige limpar depois o mesmo projeto. Não use esse ensaio para executar carga contra serviços cloud.

## Resultados e limites da evidência

`evidencias/comercial/dados-browser.log`: **18/18 testes aprovados no Chrome local**, dos quais cinco novos. Cobrem backup integral com fotos, rollback em falha de preferências, isolamento, migração com consentimento, CAS/outbox/resposta perdida, exclusão, paginação, A→B→A em contextos de navegador independentes, offline e upload interrompido, retomada de IA com UUID após recarga e HTTP 200 com JSON truncado. Os endpoints desses testes de navegador são simulados; não representam transações novas de IA. O teste de timeout em `nutricao.test.js` foi ajustado para fornecer titular autenticado e armazenamento isolado, preservando a exigência de autenticação de produção; 14/14 testes desse arquivo passaram.

`evidencias/comercial/continuidade-interface.json` e `continuidade-interface.log`: **4/4 jornadas aprovadas com simulação de backend e navegador/PWA reais**. Diferentemente de uma rota isolada que retorna erro de rede, estas usam `context.setOffline(true)` e fecham a página antes de abrir outra pelo cache do service worker:

1. Reabertura realmente offline preserva o namespace Ana e seu peso, sem fabricar sessão; permite editar localmente e bloqueia IA/pagamento sem conexão.
2. Reconexão revalida a conta e envia o peso alterado offline à mesma conta remota.
3. Logout confirmado remove a lembrança; reabrir offline apresenta o espaço local, sem reabrir a conta anterior.
4. Duas páginas no **mesmo contexto**, compartilhando cookies, fazem login em titulares diferentes. A antiga aba A tenta sincronizar com cookies B: recebe rejeição, passa ao espaço sem conta e não altera o snapshot de B. O snapshot de A permanece intacto.

O build deve preceder essa suíte para incluir os novos módulos no precache. O teste usa BFF/simulador locais em porta 4494 e arquivo de fixtures próprio em TEMP; não toca contas reais nem o ledger IA. Não equivale a autenticação offline: dados já presentes no dispositivo permanecem acessíveis no último namespace conhecido enquanto não houver revalidação, e devem ser protegidos pelo controle de acesso do próprio aparelho.

`evidencias/comercial/supabase-local.json` e `supabase-teste.log`: **11 verificações agregadas com serviços Supabase reais locais**, sendo dez contratos de infraestrutura e uma suíte integrada com seis passos reais:

1. Migrações 001, 002, 003 e 004 aplicadas ao PostgreSQL real da stack.
2. Cadastro Ana não libera sessão antes de confirmação; mensagem entregue no Mailpit, token de uso único verificado pelo Auth.
3. Mesmo fluxo independente para Bruno.
4. Refresh token real e validação da sessão pelo RPC, incluindo titular incorreto bloqueado.
5. Recuperação com token do e-mail local, redefinição, token não reutilizável, senha antiga inválida e nova senha aceita.
6. Gravação CAS/idempotência no PostgREST, isolamento por titular e acesso direto anon/authenticated às tabelas/RPC bloqueado.
7. Upload/download reais de PNG de 68 bytes; bucket privado, URL pública e outro titular bloqueados.
8. `pg_dump -Fc` completo; `pg_restore` em **outro database no PostgreSQL temporário** e confirmação do usuário Auth e revisão dos dados. O restore utiliza `supabase_admin`, necessário para funções internas da distribuição. Não altera o database original nem banco externo.
9. Download do objeto para arquivo separado do dump, reupload em caminho diferente e igualdade SHA-256. É uma cópia de teste local, não backup cloud completo do cliente.
10. Remoção explícita dos objetos, exclusão Auth e cascata dos dados comerciais.
11. Interface HTTPS → BFF real HTTPS → proxy Supabase HTTPS → serviços Supabase reais locais, com seis passos descritos abaixo.

A suíte integrada (`testes/apoio/integracao-supabase-https.js`) valida:

- Cadastro pelos controles da interface, recebimento do TokenHash no Mailpit, link de confirmação, sessão iniciada e cookies `Secure`, `HttpOnly`, `SameSite=Strict`, inacessíveis a `document.cookie`.
- Sincronização pelo botão da interface: peso e metadados reais no Postgres, foto real privada no Storage e somente referência no snapshot.
- Login pela interface em outro contexto de navegador, recebendo peso e os bytes da foto privada pelo BFF.
- Cookie de acesso substituído por valor inválido no teste, com recuperação automática da sessão pelo refresh token real do Auth.
- Recuperação iniciada pela interface, link entregue no Mailpit, nova senha salva e login com a nova senha pelo BFF.
- Exclusão pelo endpoint BFF real, com acesso posterior aos dados respondendo 401.

O certificado CA e o certificado servidor são gerados em TEMP por `certificado-local.py`. Não há instalação de CA no Windows nem mudança em `NODE_TLS_REJECT_UNAUTHORIZED`. Somente o subprocesso `servidor-supabase-https.js` recebe `NODE_EXTRA_CA_CERTS` apontando para a CA efêmera. Apenas os contextos Playwright do teste usam `ignoreHTTPSErrors`. O aplicativo/BFF e o proxy vinculam-se a `127.0.0.1`. O proxy só aceita a origem Supabase local configurada; a IA externa é bloqueada no processo de teste. A configuração real exige HTTPS durante todo o ensaio, sem mudar `seguranca.js`.

O primeiro ensaio de restore com papel `postgres` expôs falta de privilégio em função interna `realtime.list_changes`; foi corrigido no harness para o superusuário **apenas da stack descartável**. Não mudar grants de produção para reproduzir este teste.

O backup do PostgreSQL contém metadados de Storage; **não contém os bytes dos arquivos**. Backup comercial precisa exportar todos os objetos privados separadamente, manter manifesto de caminho/tamanho/hash e verificar restauração em destino isolado, além do dump, credenciais/configuração e política de retenção. Não salvar chaves e dumps contendo tokens reais em repositório ou pasta pública.

Estado correto para esses resultados: **APROVADA EM AMBIENTE LOCAL**. Os 18 testes de dados usam endpoints simulados; a suíte HTTPS separada usa navegador, BFF, Auth, PostgREST, Storage e SMTP reais locais. Na stack local, o trecho interno entre proxy HTTPS e serviços Supabase usa HTTP de loopback; isso não relaxa a exigência HTTPS do BFF. Ainda não há integração com Supabase cloud, entrega SMTP externa, propagação DNS, testes em aparelhos físicos ou restauração de um backup de produção. A stack descartável e os processos HTTPS foram encerrados ao final.

Referências oficiais consultadas: [ambiente local](https://supabase.com/docs/guides/local-development), [CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [restore local](https://supabase.com/docs/guides/local-development/restoring-downloaded-backup). A distribuição CLI foi obtida do [repositório oficial](https://github.com/supabase/cli/releases/tag/v2.121.0) em TEMP; nenhum binário foi adicionado ao projeto.
