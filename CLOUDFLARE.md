# Cloudflare — NutriFoto 0.3.2

Repositório: `KauaZanonBaracuhy/nutrifoto`. A raiz deste repositório é a própria pasta `nutrifoto`, embora o workspace pai a referencie como submódulo. Não configurar a raiz do build como `nutrifoto/` dentro desse repositório. Preservar o histórico; não fazer force push.

## Worker existente e comandos

- Worker: `nutrifoto`; URL de produção: https://nutrifoto.kauazanonbaracuhy1.workers.dev/.
- Entrada: `cloudflare/worker.js`; assets: `www/`; `wrangler.jsonc` habilita compatibilidade Node. O adaptador mantém o backend/RPCs e não introduz outro banco, KV, D1 ou R2.
- Workers Builds: raiz `/`; instalação `pnpm install --frozen-lockfile --ignore-scripts`; build `pnpm run build:web`; deploy de produção `pnpm exec wrangler deploy` **somente após autorização de promoção**.
- Branch de homologação: `codex/cloudflare-preview`. Para branches não produtivas, usar `pnpm run preview:cloudflare`, que executa `wrangler versions upload --preview-alias homologacao`, sem promover tráfego de produção. A URL retornada deve ser verificada, não presumida disponível.
- Prévia esperada pelo alias, quando habilitada/autenticada: `https://homologacao-nutrifoto.kauazanonbaracuhy1.workers.dev`. `PREVIEW_ORIGIN` admite apenas essa origem explícita; demais origens continuam recusadas. URLs de versão aleatórias não recebem autorização de mutação automaticamente.
- Local: `pnpm run dev:cloudflare --port 8787`; validação: `pnpm run build:cloudflare`, `pnpm run test:cloudflare`, `pnpm run test:licencas:interface`, `pnpm run test:pwa`, `pnpm test`.
- `GET /api/versao` permite conferir versão e plataforma publicada; saúde é `/api/saude`. Saúde não comprova integração externa. Rotas desconhecidas retornam 404 JSON, nunca o HTML do aplicativo.
- HTML não redireciona automaticamente; `/` é servido como `/index.html` pelo Worker. Isso preserva o cache/PWA. `config.example.js` não é publicado nem integra o precache.

## Configuração privada necessária

No Worker existente, definir por **secrets**, nunca em `vars`, frontend, Git ou APK:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RATE_LIMIT_SALT`: backend existente e persistência transacional. Diário alimentar continua local. Licenças/compra/intenção/quota/orçamento usam as RPCs existentes (base 001 e licença 005); demais migrações habilitam funcionalidades legadas conforme a infraestrutura existente, sem migrar dados silenciosamente.
- `ASAAS_API_KEY` exclusivamente sandbox; `ASAAS_WEBHOOK_TOKEN` aleatório com pelo menos 32 caracteres. Webhook `https://<origem>/api/asaas-webhook`, cabeçalho `asaas-access-token`. Não publicar credencial financeira real.
- `OPENROUTER_API_KEY` somente nova/validada, e os preços/orçamentos conservadores descritos em `LICENCAS_ANDROID.md` e `.env.example`. Ausência de orçamento bloqueia IA; não testar com chamadas pagas sem nova autorização.
- `ANDROID_ATTESTATION_ROOTS_PEM` e `ANDROID_APP_CERT_SHA256` para validar instalações reais. Emulador não homologa atestado de hardware.
- `OPERACAO_SECRET` e `CRON_SECRET` somente se ativar esses recursos. Cron não foi habilitado automaticamente.

`APP_ORIGIN`/`PREVIEW_ORIGIN`, `LICENCAS_ANDROID=true` e `ASAAS_AMBIENTE=sandbox` são configuração pública do servidor. O Worker impõe sandbox e recusa simulação em hospedagem, mesmo se uma variável estiver incorreta. Prévia de versão compartilha bindings do Worker: não é isolamento de banco; usar somente configuração e dados de homologação antes de testar mutações.

`pnpm exec wrangler secret put NOME` grava um segredo no Worker; essa operação pode alterar sua versão/implantação. Não executar contra produção sem autorização. Inserir valores diretamente no painel/terminal privado, nunca nesta documentação. O wrapper de desenvolvimento desabilita a leitura automática do `.env` legado; `.dev.vars` é privado e ignorado pelo Git.

**Credencial antiga:** o remoto 0.1.0 contém uma chave OpenRouter em `www/js/config.example.js`. A árvore atual não contém essa chave; ela permanece no histórico preservado. O proprietário precisa confirmar sua revogação no painel OpenRouter. Não reutilizar a chave antiga, nem afirmar revogação sem evidência.

## Verificação de publicação

Após autenticar a conta, enviar a versão de prévia, abrir a URL retornada e verificar `/api/versao`, navegação, precache, PWA, endpoints e mensagens de configuração ausente. Conferir a implantação no painel, incluindo commit/versão e logs de build. Sem acesso ao painel/API, não declarar que o status Failed foi resolvido. Main/produção só após validação e autorização explícita de promoção.

Referências: [Static Assets](https://developers.cloudflare.com/workers/static-assets/binding/), [HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/), [versões de prévia](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/), [secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
