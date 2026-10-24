# Android — release 0.2.0 (2)

Registro da reativação original. Atualização disponível: **0.2.1 (3)**, mantendo identificador e chave; APK/AAB e resultados em [RELATORIO_REFINAMENTO.md](RELATORIO_REFINAMENTO.md).

Missão de 22/10/2026: plataforma Android reativada por solicitação do proprietário, mantendo `www/` como fonte. A plataforma histórica `_android_pausado/` continua sem uso. Não houve publicação, deploy, compra nem chamada paga de IA.

## Identidade e artefatos

- Identificador definitivo preservado: `com.nutrifoto.app`; nome NutriFoto.
- `versionName` 0.2.0, `versionCode` 2; incrementar o código a cada atualização distribuída.
- Capacitor core/Android/CLI 8.5.3; App 8.1.2, Camera 8.2.6, Filesystem 8.1.5 e Share 8.0.3, fixados no lockfile.
- Android mínimo API 24 (7.0); compile/target API 36; AGP 8.13.0, Gradle 8.14.3 e JDK 21.
- APK instalável: `builds/android-release/NutriFoto-0.2.0-2-release.apk`.
- AAB para futura distribuição: `builds/android-release/NutriFoto-0.2.0-2-release.aab`.
- Resultados e hashes: `RELATORIO_ANDROID.md` e `evidencias/android/`.

## Assinatura e futuras atualizações

A chave RSA 3072/PKCS12 foi criada fora do repositório em `C:\Users\kauaz\.nutrifoto\assinatura\nutrifoto-release.p12`. As senhas estão somente no arquivo privado `release.properties`, na mesma pasta, protegida por ACL do usuário, administradores e SYSTEM. O build não imprime as senhas. Não copiar esses arquivos para a fonte, APK, AAB ou evidências. Faça backup privado e protegido dessa pasta; perder a chave impede atualizar instalações diretas assinadas por ela.

Certificado SHA-256: `d6dbfb941247b78893238887d5ec6d60d4608a45f4df57659165e2e9adb913ed`.

Para manter a mesma identidade no Google Play App Signing, selecionar a opção de fornecer/importar a **chave de assinatura existente**, usando a ferramenta PEPK e as instruções da própria Play Console. Não selecionar uma nova chave de assinatura gerada pelo Google se a intenção é compatibilidade com este APK. Pode-se criar uma chave de upload separada depois da inscrição; ela não substitui a identidade de assinatura do aplicativo. Nenhuma inscrição ou transferência da chave foi realizada. Consulte a [documentação de assinatura](https://developer.android.com/studio/publish/app-signing) e o [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756).

Não foi encontrada uma chave histórica de release nesta fonte. Um APK antigo assinado por outra chave não poderá receber esta atualização diretamente: a identidade de assinatura precisa corresponder. Não desinstalar uma versão com dados sem exportar o backup antes.

## Compilar novamente

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm rebuild esbuild
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/preparar-ambiente-android.ps1
# Reutiliza a chave existente; recusa arquivos parciais em vez de substituí-los.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/preparar-assinatura-android.ps1
pnpm run build:android
```

`build:android` e `build:aab` produzem ambos os formatos, sincronizam os assets e verificam a assinatura do APK. O script aceita `JAVA_HOME`, `ANDROID_HOME` e `NUTRIFOTO_SIGNING_PROPERTIES` para instalações próprias. Sem essas variáveis, usa ferramentas privadas em `%USERPROFILE%\.nutrifoto\android`. As ferramentas oficiais são verificadas por checksum no preparo. A primeira instalação baixa JDK/SDK e a imagem de emulador e aceita as licenças Android necessárias ao build solicitado. O pnpm autoriza somente o postinstall necessário do esbuild.

## Backend e IA

O proprietário confirmou que ainda não há backend publicado. O APK entregue opera com diário, TACO, água, peso, histórico, imagens locais e backup. Contas, IA e sincronização dependem do BFF HTTPS existente; tentativas de acesso informam que a conexão não está configurada. Nenhuma chave OpenRouter é embutida.

Quando o backend existente estiver homologado e publicado com autorização própria, configurar somente a origem pública no **build**:

```powershell
$env:NUTRIFOTO_BACKEND_ORIGIN='https://seu-backend.exemplo'
pnpm run build:android
Remove-Item Env:NUTRIFOTO_BACKEND_ORIGIN
```

É uma origem HTTPS sem caminho, query ou credenciais. O build Android não lê `.env`. As requisições `/api/` usam CapacitorHttp e a sessão nativa; preservam CSRF, conta esperada e idempotência do BFF. A chave OpenRouter, autenticação e limites financeiros permanecem exclusivamente no servidor existente, conforme `CONFIGURACAO_PARA_PRODUCAO.md`. Não foi criado novo serviço. A integração hospedada de contas/IA ainda exige homologação com a origem final. Confirmação e recuperação por e-mail continuam pelas URLs web do backend; não foram implementados App Links automáticos nesta missão.

## Adaptação Android

A câmera é delegada ao aplicativo de câmera do sistema; a galeria usa o seletor do Android e não exige acesso amplo às fotos. Não salvar automaticamente na galeria evita permissões desnecessárias. O retorno restaurado da câmera é encaminhado ao fluxo existente quando fornecido pelo plugin. Back fecha os diálogos existentes, percorre a navegação e minimiza na página inicial. Backups JSON/CSV usam arquivo temporário privado e o seletor de compartilhamento do sistema; importação mantém o seletor de arquivos existente.

IndexedDB, namespaces e a origem `https://localhost` foram preservados. Atualizações com a mesma chave e identificador conservam o armazenamento; desinstalar/apagar dados do Android remove os dados locais. Backup automático Android está desativado para evitar cópias do diário em serviços externos sem escolha explícita. O backup do usuário permanece disponível. APK usa assets próprios, sem atualização por service worker; futuras correções exigem nova versão instalada.

Release sem depuração WebView, tráfego HTTP ou segredos. As barras do Android usam a cor da marca e ícones claros. As bibliotecas nativas e ZIP foram verificados para alinhamento de 16 KB, e o AAB declara `PAGE_ALIGNMENT_16K`, conforme a [documentação Android](https://developer.android.com/guide/practices/page-sizes). Essa verificação estrutural não equivale a teste em aparelho de 16 KB nem à aprovação da loja.

Para uma futura Play Store ainda serão necessários conta do desenvolvedor, inscrição em App Signing, ficha/política de privacidade/Data safety e atendimento às políticas vigentes. O AAB foi preparado tecnicamente; não houve publicação nem aprovação comercial, jurídica ou clínica.
