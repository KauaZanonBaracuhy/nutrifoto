# Ativação e homologação — 22/10/2026

O código foi ampliado e homologado com serviços reais locais. **Não há aplicação comercial hospedada configurada por esta missão.** Não executar os passos de alteração cloud sem selecionar um projeto de homologação autorizado. A versão recusa Stripe live; aceitar dinheiro exige tarefa posterior específica, homologação e autorização.

## O que já existe

- Build local de `www/`, BFF Node e handlers Vercel, lockfile pnpm, pipeline preparado.
- Migrações001–004 com RLS, funções restritas ao serviço e bucket privado.
- Auth/SMTP local, dados e imagens reais integrados ao navegador/BFF HTTPS em stack descartável.
- Orçamentos IA, idempotência, assinatura sandbox e tela de benefícios.
- Métricas, retenção, monitor CLI, backup integral do usuário e restore técnico isolado.
- `.env` privado preservado. Nesta máquina, somente OpenRouter estava configurado para o aplicativo; isso não ativa as demais integrações.

## Preparar a máquina e reproduzir

Trabalhe em `nutrifoto`, não em `web/` ou `shared/`. Node24 foi usado; engines exige>=22. pnpm11.25.0 é fixado em packageManager. Se node/git não estiverem no PATH, selecionar a instalação local; não alterar o projeto para depender dos caminhos privados desta máquina.

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm exec playwright install chromium firefox webkit
pnpm run check
pnpm run build
pnpm test
$env:NUTRIFOTO_TESTAR_POSTGRES='true'
pnpm run test:postgres
Remove-Item Env:NUTRIFOTO_TESTAR_POSTGRES
pnpm run test:interface
pnpm run test:comercial
pnpm run test:pwa
pnpm run test:continuidade
pnpm run test:carga:comercial
pnpm run test:fonte-limpa
pnpm audit --prod --audit-level high
```

Fonte limpa usa registro de pacotes com lock congelado; `node scripts/verificar-fonte-limpa.js --offline` é opcional e exige cache completo. Nesta sessão o cache offline não possuía metadados; a instalação online congelada passou. Não desabilitar validação de integridade para contornar cache ausente.

Demonstração fictícia: `node servidor/local.js --simulado --porta 4173`; abrir http://127.0.0.1:4173. Ana/Bruno usam e-mails `ana@exemplo.test` e `bruno@exemplo.test`, senha exclusivamente fictícia `Teste-local-2026!`. Não utilizar dados de saúde reais. Não definir NODE_ENV=production nem VERCEL para simulação. O aviso de simulação é obrigatório e o checkout responde indisponível, sem fingir pagamento aprovado.

## Supabase real local isolado

Docker Desktop precisa estar ativo. Usar CLI oficial Supabase2.121.0, disponível no [release oficial](https://github.com/supabase/cli/releases/tag/v2.121.0), sem binários dentro do repositório. A versão foi baixada e utilizada nesta missão em TEMP. Definir SUPABASE_CLI com o executável disponível. O helper de certificado exige Python com pacote cryptography; a execução usou50.0.2. Instalação desses pré-requisitos não cria projeto cloud.

```powershell
$env:SUPABASE_CLI='<caminho-absoluto-do-executavel-supabase>'
$env:PYTHON_EXECUTABLE='<caminho-absoluto-do-python>'
pnpm run test:supabase:local
```

O harness cria projeto com prefixo `nutrifoto-supabase-` em TEMP, portas loopback isoladas, migrações e Mailpit. Gera CA temporária, inicia subprocesso HTTPS e usa NODE_EXTRA_CA_CERTS somente nele; ignoreHTTPSErrors pertence apenas ao contexto Playwright. Não instala CA no SO nem desabilita TLS globalmente. Não recebe .env do produto e bloqueia IA externa. Não fornecer workdir de projeto existente. Ao final, `supabase-local.json` deve indicar erro:null,11 verificações aprovadas, seis subpassos de integração e limpeza da stack.

O dump contém dados fictícios e é restaurado em outro database na stack temporária. Os bytes Storage são baixados/recarregados separadamente com hash. Essa prova não é um backup de produção nem certifica um destino cloud futuro. [Documentação oficial de backups](https://supabase.com/docs/guides/platform/backups) distingue banco e arquivos Storage.

## Ambiente hospedado de homologação

1. Selecionar projeto Supabase próprio de homologação, separado de produção. Definir região e plano autorizado; esta missão não criou recurso pago.
2. Fazer backup se o destino não for vazio. Aplicar001 uma única vez;002,003,004 nessa ordem.001 tem políticas iniciais que não devem ser reaplicadas cegamente. Registrar versão/checksum aplicado; não executar reset em banco existente.
3. Configurar Auth com confirmação de e-mail, senha mínima12, limite de tokens/OTP adequado à política aprovada e URLs exatas. APP_ORIGIN precisa ser origem HTTPS sem caminho; nada de curingas amplos em redirecionamento.
4. Aplicar templates de `supabase/templates/confirmacao.html` e `recuperacao.html` no painel Auth. Eles usam `/?tela=conta#confirmacao={{ .TokenHash }}` e `#recuperacao={{ .TokenHash }}`; o fragmento é recolhido e removido pelo aplicativo. Verificar nomes reais dos arquivos no diretório. Não usar links com access_token em query nem rastreamento de cliques do SMTP. [Templates oficiais](https://supabase.com/docs/guides/auth/auth-email-templates).
5. Configurar SMTP com domínio/remetente autorizados e SPF/DKIM/DMARC no provedor. Enviar somente para duas caixas controladas autorizadas. Testar confirmação, recuperação, token expirado/reutilizado e genericidade da resposta para e-mail desconhecido. SMTP externo e entrega real não foram homologados.
6. Conferir bucket `nutrifoto-imagens` privado, MIME JPEG/PNG/WebP e1MB. Não tornar público nem dar SELECT direto às tabelas comerciais para resolver erro. O BFF usa service role e valida proprietário; anon/authenticated não devem chamar RPC comercial.
7. Criar configurações privadas no ambiente de Preview/Staging de hospedagem e fazer deploy somente após autorização específica. Repetir matriz A01–A17 com dois usuários de teste. Verificar cookies Secure/HttpOnly/Strict, logout/revogação, isolamento, imagens e restore em destino separado.

## Variáveis privadas

Copiar somente o modelo `.env.example` para arquivo privado ou secret manager; não preencher arquivos públicos e não anexar valores aos relatórios.

| Grupo | Variáveis | Validação / padrão seguro |
|---|---|---|
| Origem e Auth | APP_ORIGIN, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RATE_LIMIT_SALT | origens HTTPS, chaves do staging, salt forte e exclusivo |
| IA | OPENROUTER_API_KEY, IA_MAX_TOKENS_ANALISE | chave somente servidor;128..1500tokens, padrão1500 |
| Quotas | IA_QUOTA_GRATIS, IA_QUOTA_PAGO | zero bloqueia; limites mensais em UTC |
| Orçamento | IA_ORCAMENTO_MENSAL_USD, IA_ORCAMENTO_USUARIO_MENSAL_USD, IA_RESERVA_OPERACAO_USD | zero desabilita; reserva<=tetos e>=custo conservador |
| Preço máximo IA | IA_PRECO_MAX_ENTRADA_USD_MILHAO, IA_PRECO_MAX_SAIDA_USD_MILHAO | operador verifica preço atual e aprova teto; zero desabilita |
| Fotos | FOTOS_LIMITE_GRATIS/PAGO, IMAGENS_LIMITE_GRATIS_BYTES/PAGO_BYTES | ambos zero no modelo; quantidade<=10000, bytes<=1GB |
| Benefícios | IA_FOTO_GRATIS/PAGO, SINCRONIZACAO_GRATIS/PAGO | foto false no modelo; sync true, sempre com sessão válida |
| Nutrição | PLANOS_HOMOLOGADOS | manter false; não substitui revisão profissional |
| Stripe sandbox | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MENSAL_ID, STRIPE_PRICE_ANUAL_ID | somente sk_test;anual opcional;STRIPE_PRICE_ID é alias mensal legado |
| Operação | OPERACAO_SECRET, CRON_SECRET, METRICAS_HABILITADAS | segredos independentes>=32caracteres; flag false até configurar |
| Retenção | METRICAS_RETENCAO_DIAS |1..365, padrão30 |
| Retenção operacional | RETENCAO_RESULTADOS_DIAS, RETENCAO_EVENTOS_DIAS, RETENCAO_LIMITES_DIAS |1..3650; padrões7/90/1; não apagam ledger/tombstones |
| Alertas | ALERTA_P95_MS, ALERTA_STORAGE_BYTES | padrão2500ms;bytes0desabilita aviso por teto |

A reserva mínima IA considera `(128000 * preçoEntrada + 3500 * preçoSaída) / 1000000`. Não copiar valores fictícios de testes como preço comercial. Tetos protegem esta integração; quotas da conta do provedor devem complementar a proteção. Não realizar nova chamada paga para verificar configuração sem nova autorização e orçamento. O ledger anterior segue encerrado.

## Stripe sandbox e decisões comerciais

Criar produto e preços de teste mensal/anual somente na conta de homologação autorizada; preços finais continuam indefinidos. Definir quotas, fotos, bytes e benefícios compatíveis com custos. Configurar Customer Portal com cancelamento e alterações aprovadas e return URL exata. Endpoint `/api/webhook`, versão API `2025-02-24.acacia`, segredo do endpoint test. Subscrever eventos de subscription created/updated/deleted, checkout.session.completed, invoice.payment_succeeded/payment_failed, charge.refunded, refund.created/updated e charge.dispute.created/updated/closed.

Validar com cartões e test clocks oficiais somente em sandbox: checkout aprovado/recusado, duas tentativas simultâneas, renovação, troca, cancelamento imediato/final de período, expiração, eventos duplicados/fora de ordem, reembolso integral/parcial e disputa. Confirmar banco e API de assinatura, não a URL. Documentar valor efetivamente mostrado no checkout. [Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [cancelamento](https://docs.stripe.com/billing/subscriptions/cancel).

Bloqueios por reembolso/disputa independem do estado da assinatura e não cancelam automaticamente cobrança. Aprovar a política e atendimento antes da oferta. Nunca substituir sk_test por sk_live esperando ativação: o código recusa. Produção financeira permanece **tecnicamente desabilitada por escopo e autorização**, não por chave faltante apenas.

## Operação, incidentes e backup

Ativar METRICAS_HABILITADAS após aplicar003/004. `/api/saude` indica vivacidade; `/api/operacao` exige Bearer e consulta banco/métricas/inventário agregado. `node --env-file=.env.local scripts/monitorar.js` só lê e retorna código2 quando há alerta,1 em falha. Programar execução e encaminhamento ao responsável no sistema operacional/monitor autorizado; nenhum e-mail/Slack é enviado pelo código. Vercel cron preparado para manutenção diária06:00UTC com CRON_SECRET; confirmar autorização e execução no plano contratado. Falha deve gerar incidente, não ser ignorada.

Custos por usuário podem ser consultados por operador autorizado na tabela privada nf_ia_custos usando UUID e campos de reserva/custo/estado; nunca expor a tabela a clientes. Em custo desconhecido, consultar extrato por canal autorizado, registrar referência e usar `scripts/reconciliar-custo-ia.js` com flag explícita. Não colocar conteúdo de saúde na referência. Zero só com prova de não cobrança. Não apagar ledger nem criar nova chave para esconder tentativa incerta.

Antes do piloto hospedado: responsável e periodicidade de backup, RPO/RTO e retenção aprovados. Exportar banco consistente e **todos os objetos privados separadamente** com manifesto caminho/tamanho/hash, armazenados fora do deploy com acesso mínimo e proteção apropriada. Configurações/segredos têm recuperação separada. Ensaiar em projeto vazio isolado, reconstituir objetos e verificar fotos/perfil/água/peso/metas e permissões. Só promover recuperação depois de validar; não restaurar sobre produção como teste. Backups do fornecedor sem bytes Storage não são backup integral. Mais detalhes em OPERACAO.md.

Excluir refeição deixa o objeto privado até excluir a conta; há inventário, sem GC automático. Definir prazo/política e atendimento ao titular antes de piloto com dados pessoais. Logs do host, Auth, Stripe, IA e backups precisam de prazos contratuais; o cron do aplicativo não os limpa. Definir canal de direitos e contato do controlador.

## Segurança e revogação indispensável

Auditoria local confirma: chave antiga presente no HEAD/histórico, chave atual diferente, nenhuma delas nos assets locais www/web verificados. **O site público existente não foi atualizado ou certificado nesta missão.** No painel OpenRouter, abrir Settings/Keys, identificar a credencial exposta pelo registro local, revogar/excluir somente essa chave e registrar evidência sem valor secreto. Confirmar a revogação na conta e avaliar consumo indevido. Não testar a chave antiga por requisição. Não reescrever histórico sem tarefa autorizada. Conferir separadamente os assets efetivamente publicados no deploy que será aprovado.

## Release e rollback

1. Preencher decisões comerciais/privacidade, revisar minutas e protocolo nutricional. Manter planos e metas automáticas bloqueados.
2. Homologar staging hospedado, Stripe test e SMTP, restore e dispositivos reais. Aceitar SLO e limites somente com evidência.
3. Revisar diff e segredos, validar CI remoto, confirmar que arquivos novos/lockfile/migrações foram incluídos. Evidências locais são ignoradas pelo Git: arquivar cópias sanitizadas no local autorizado.
4. O repositório pai possui gitlink antigo e estado staged/unstaged anterior. Preservar os dois estados; revisar `git -C nutrifoto status`, HEAD e `git diff --submodule` antes de criar qualquer commit. O release requer primeiro commit revisado do repo interno e depois atualização autorizada do gitlink do pai. Nenhum desses commits foi feito nesta missão.
5. Preparar artefato/commit anterior, backup e janela. Migrações003/004 são aditivas; rollback de frontend/BFF não deve dropar tabelas nem liberar reservas financeiras. Desativar chamadas IA/novos checkouts via configuração, voltar artefato aprovado, preservar dados e reconciliar eventos pendentes. Evitar cliente antigo com esquema/contrato incompatível; testar combinação antes.
6. Publicação e cobrança real precisam de autorização específica. Não usar este guia como autorização para deploy.

## Parecer de ativação

Demonstração privada fictícia: APTO COM RESTRIÇÕES. Piloto com dados reais, clientes pagantes e divulgação em escala: NÃO APTO agora. Faltam homologação hospedada/financeira/SMTP, revogação comprovada, contratos/privacidade, políticas de retenção e suporte, validação profissional, operação de backup e dispositivos reais. O código preparado reduz o trabalho futuro, mas não substitui essas evidências.
