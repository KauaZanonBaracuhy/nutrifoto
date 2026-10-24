# Build e validação — 0.3.2

Cloudflare Workers + Static Assets: veja [CLOUDFLARE.md](CLOUDFLARE.md). `pnpm run build:cloudflare` valida o bundle sem publicar; `pnpm run test:cloudflare` executa APIs, interface e PWA no workerd real local. Prévia usa `pnpm run preview:cloudflare`; promoção de produção exige autorização. As instruções históricas abaixo não substituem o fluxo atual de ativação por instalação.

Artefatos e testes da atualização de interface: [RELATORIO_REFINAMENTO.md](RELATORIO_REFINAMENTO.md). Comandos adicionais: `pnpm run test:refinamento` e `pnpm run test:windows:limpo` (este cria uma cópia externa com perfil de teste separado).

Fonte ativa: `www/` + APIs/servidor. Use Node >=22 e pnpm 11.25.0. Android reativado: build real de APK/AAB assinado, conforme `ANDROID_RELEASE.md` e `RELATORIO_ANDROID.md`.

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm run check
pnpm run build
pnpm run test:seguranca
pnpm test
pnpm run test:interface
pnpm run test:carga
```

O build copia Chart.js, Lucide e Space Grotesk de versões fixadas para `www/vendor`, agrega licenças, gera precache e verifica padrões de segredos/scripts externos. Remove eventual `www/js/config.local.js`; não lê nem injeta `.env`. `scripts/generate-config.js` é apenas um alias seguro do build. `package-lock.json` foi substituído por `pnpm-lock.yaml`. Os wrappers Python antigos chamam a suíte local de interface.

Playwright usa Chromium instalado ou Chrome local. Em CI: `pnpm exec playwright install --with-deps chromium`. Não é necessário fornecer credenciais para os testes locais.

PostgreSQL real isolado, exigindo Docker e a imagem `postgres:15-alpine` disponível:

```powershell
$env:NUTRIFOTO_TESTAR_POSTGRES='true'
pnpm run test:postgres
Remove-Item Env:NUTRIFOTO_TESTAR_POSTGRES
```

O teste cria e remove seu próprio contêiner temporário, sem rede, sem tocar banco do usuário. Sem a variável, esse teste é explicitamente marcado como ignorado.

Validação de fonte limpa: `node scripts/verificar-fonte-limpa.js`. Se pnpm não estiver no PATH, defina `PNPM_EXECUTAVEL` com seu caminho. O script copia fontes permitidas para diretório temporário, exclui segredos/assets gerados, instala com lockfile e cache offline e executa build/sintaxe. Isso não equivale a clone de release publicado. Evidências são salvas em `evidencias/`, ignorado pelo Git.

Para homologação real, siga `ARQUITETURA_ATUAL.md`; apenas `pnpm run serve` não configura serviços. O processo local não carrega `.env` automaticamente: use `node --env-file=.env.local servidor/local.js` com variáveis preenchidas pelo proprietário. Nunca use chaves reais em arquivos públicos.

O repositório interno é a unidade de fonte do aplicativo. A raiz contém gitlink antigo e alterações anteriores preservadas; sua referência só deve ser atualizada após revisão/commit autorizado. Não houve commit, push ou deploy nesta missão. As cópias `shared/`/`web/` e scripts de APK são históricos e não entram no build, testes ou pacote de publicação.

## Testes reais não fazem parte da suíte automática

`testes/homologacao-real.js` e `scripts/diagnosticar-ia-real.js` são auxiliares explícitos da rodada autorizada, fora dos comandos automáticos e do CI. Exigem a opção --confirmar-chamadas-reais, usam controle persistido em evidencias/homologacao-real/controle.json e recusam novas chamadas quando a rodada está encerrada. A rodada atual está encerrada com quatro chamadas; revalidação usa respostas gravadas quando disponíveis. Não apagar evidências para reiniciar orçamento nem usar isso como servidor comercial. A cópia limpa de fonte não transporta o controle ignorado: não executar testes reais nessa cópia sem nova autorização específica.

## Homologação comercial atual

Consultar CONFIGURACAO_PARA_PRODUCAO.md para o equivalente completo do pipeline. Novos comandos: test:comercial (três motores), test:pwa (troca de worker), test:continuidade (offline e multiabas), test:carga:comercial, test:supabase:local e test:fonte-limpa. test:postgres inclui os dois testes PG, habilitados explicitamente por NUTRIFOTO_TESTAR_POSTGRES=true. Não remover o ledger selado da homologação anterior nem executar outra geração paga. Replays devem continuar usando as respostas já gravadas.

## Android reativado

`pnpm run build:android` gera APK e AAB de release usando a chave privada existente. `ANDROID_RELEASE.md` descreve ferramentas, configuração pública do backend e continuidade da assinatura para Google Play. Os scripts antigos de APK permanecem históricos; a plataforma ativa é `android/`.

## Executável de teste Windows

`pnpm run build:windows` produz um EXE portátil; `test:windows` e `test:windows:portatil` validam a aplicação empacotada. Consulte `WINDOWS_TESTE.md`. O teste Windows não substitui homologação Android.
