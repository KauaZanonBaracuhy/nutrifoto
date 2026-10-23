# NutriFoto Android — entrega de release

Data: 22/10/2026. **APK assinado gerado e instalado com sucesso em emulador Android 16/API 36. AAB assinado gerado e validado pelo bundletool.** Nenhuma publicação foi realizada. Esta entrega Android não altera os pareceres comerciais anteriores.

## Arquivos entregues

Na raiz `nutrifoto/`:

| Artefato | Caminho | Tamanho |
|---|---|---:|
| APK para instalação direta | `builds/android-release/NutriFoto-0.2.0-2-release.apk` | 7.006.879 bytes |
| AAB preparado para futura Play Store | `builds/android-release/NutriFoto-0.2.0-2-release.aab` | 6.183.715 bytes |
| Checksums | `builds/android-release/SHA256SUMS.txt` | — |

SHA-256 APK: `389406f0850167867e362703c3c432ba4f3f2b02b64222d6221a3177822ec12b`.

SHA-256 AAB: `dc84c24a29913206d0b6f61c85377b482fa3d444468be360dc5993f5ba765c00`.

Identidade: `com.nutrifoto.app`; versão 0.2.0, código 2. Android mínimo API 24, target/compile API 36. APK universal com arm64-v8a, armeabi-v7a, x86 e x86_64. Capacitor 8.5.3 e plugins oficiais 8.x fixados no pnpm; Gradle 8.14.3/AGP 8.13.0/JDK 21. A identidade anterior foi reaproveitada; não foi localizada chave histórica. A chave recém-criada define a assinatura desta distribuição e de suas atualizações.

## Compilação e segurança

- Compilação real de `assembleRelease` e `bundleRelease`, concluída com `BUILD SUCCESSFUL`; repetida após os últimos ajustes. Evidência: `evidencias/android/release-final.log`.
- APK validado pelo apksigner: assinatura v2 válida, RSA 3072, certificado SHA-256 `d6dbfb941247b78893238887d5ec6d60d4608a45f4df57659165e2e9adb913ed`.
- AAB validado pelo bundletool 1.18.3 e assinatura verificada por jarsigner. O certificado é autoassinado, como esperado para assinatura Android. Jarsigner também emitiu avisos de ausência de timestamp e de ordem de entradas ao comparar JarFile/JarInputStream; não houve rejeição pelo bundletool. Publicação/validação na Play Console ainda não ocorreu.
- `aapt` e pacote instalado confirmam versão/SDK. Release sem flag DEBUGGABLE e sem backup Android automático. WebView debugging e tráfego HTTP desativados.
- Permissão funcional: INTERNET. AndroidX também declara permissão interna normal `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. Nenhum acesso amplo à galeria, microfone, localização ou permissão CAMERA é solicitado pelo NutriFoto; a captura usa o aplicativo de câmera do sistema.
- ZIP passou em `zipalign -c -P 16 -v 4`; os segmentos LOAD das oito bibliotecas `.so` têm alinhamento de 16.384 bytes. AAB declara `PAGE_ALIGNMENT_16K`. Não foi executado em kernel com páginas de 16 KB.
- Inspeção dos dois arquivos: sem `.env`, keystore, properties de assinatura ou padrões de chaves OpenRouter/Stripe privadas. Somente a origem pública do backend pode entrar no build. Evidência: `artefatos.json`.
- `pnpm audit --prod`: zero vulnerabilidades conhecidas informadas nesta execução.
- A chave de release e as senhas ficam fora do Git, em `%USERPROFILE%\.nutrifoto\assinatura\`, protegidas por ACL. Nunca foram incluídas nos artefatos/evidências. Consulte `ANDROID_RELEASE.md` para backup e uso da mesma identidade no Play App Signing.

## Testes reais no emulador

AVD isolado `NutriFoto_API36`, Google APIs x86_64, Android 16, WHPX, tela lógica 720×1600/densidade 280. O primeiro boot com SwiftShader ficou sem responder; reiniciar com GPU host e Vulkan desativado permitiu concluir. Não foi necessário mudar proteções do aplicativo. Todos os dados são fictícios. As ações foram executadas no APK de **release**, por ADB/UIAutomator; não foi habilitado DevTools no pacote.

| Jornada | Resultado observado |
|---|---|
| Instalação, abertura e tutorial | Instalação retornou Success; interface e tutorial abriram |
| TACO local e revisão | Banana nanica, 100 g, revisada para 150 g; 137,25 kcal |
| Salvar e consultar histórico | Uma refeição gravada; histórico mostra 137,25 kcal e uma refeição |
| Água e peso | 200 ml e 72,5 kg gravados |
| Atualizar por `adb install -r` | Atualização assinada instalada sem desinstalar; refeição, água e peso preservados |
| Encerrar processo e reabrir sem rede | Wi-Fi/dados desativados no AVD; os três registros permaneceram disponíveis |
| Câmera | Aplicativo Android de câmera abriu, capturou cena virtual e devolveu imagem ao formulário |
| Galeria | Photo Picker mostrou acesso apenas às imagens escolhidas; uma imagem local selecionada voltou ao formulário |
| Cancelar câmera/galeria | Retorno ao formulário sem erro; imagem anterior preservada |
| Exportação JSON | Filesystem criou arquivo no cache privado; Share abriu seletor Android com o JSON |
| Conteúdo do backup | JSON exportado contém uma refeição, 200 ml, 72,5 kg e preferências locais |
| Importação JSON | Seletor Android abriu Downloads; confirmação exibiu “Backup restaurado”; histórico permaneceu com uma refeição |
| Voltar | Voltou entre telas, fechou a confirmação de importação e minimizou a partir do início |
| Backend ausente | Login fictício exibe “A conexão da conta ainda não está configurada nesta versão”; nenhuma chamada externa |
| Barras/teclado | Barras com contraste corrigido; teclado redimensiona a tela durante entrada de peso |

Capturas `01`–`16`, dumps e registros estão em `evidencias/android/`. O buffer de crashes coletado ao final não registrou falha. Fotos testadas são da cena virtual do emulador e arquivos de teste, não alimentos reais analisados. O retorno após câmera foi exercitado; morte do processo pelo sistema durante a câmera não foi comprovada, embora o listener de restauração esteja implementado.

Nenhum aparelho físico apareceu em `adb devices -l`; portanto não houve teste físico. Não foram testados todos os fabricantes, versões Android mínimas, leitor de tela ou bateria/rotação prolongadas.

## Regressão do frontend

- Sintaxe: 94 arquivos aprovados.
- Suíte Node anterior: 66 casos, 64 aprovados e dois PostgreSQL explicitamente ignorados; zero falhas.
- Ponte Android: quatro testes adicionais aprovados, cobrindo backend ausente/assets locais, cabeçalhos de CSRF/conta/idempotência, resposta de erro e cancelamento. São testes com adaptador, sem backend hospedado.
- Interface web: 26 cenários aprovados, incluindo edição, backup/importação, armazenamento e proteção de contas.
- Total Node nesta rodada: 68 aprovações, dois ignorados, sem somar novamente testes de interface. PostgreSQL/Stripe/cloud não foram rehomologados nesta missão Android.
- Controle de IA anterior preservado: SHA-256 `7017400c73e72f25c6b522e6812b70271f254d3236665e5e6b21a916b85142c6`. Zero novas chamadas pagas.

## Dependências externas que permanecem

1. Para contas/IA/sincronização: publicar e homologar o **BFF existente** em HTTPS, com sua configuração privada e limites já documentados; depois gerar nova versão com `NUTRIFOTO_BACKEND_ORIGIN`. A chave OpenRouter fica somente no servidor. O proprietário confirmou que esse backend ainda não está publicado. Integração Android com sessão hospedada e confirmação/recuperação externas não foi homologada; não foram adicionados novos serviços.
2. Para futuras versões: preservar backup privado da chave de assinatura e incrementar `versionCode`. Builds usam as ferramentas locais instaladas e repositórios oficiais de dependências.
3. Para futura Google Play: conta do desenvolvedor, importar a mesma chave no App Signing e preparar ficha/Data safety/privacidade e demais requisitos da loja. O AAB técnico não é autorização comercial nem aprovação da Play.

Não houve commit, push, deploy, compra, cobrança ou publicação. O APK está entregue para instalação e uso dos recursos locais; IA e conta permanecem indisponíveis até configuração e homologação do backend.
