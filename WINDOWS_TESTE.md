# NutriFoto — teste Windows

Executável portátil para conferir o frontend atual sem emulador, atualizado em 22/10/2026. Abra `builds/windows-release/NutriFoto-Teste-0.2.1-Windows-x64.exe` com dois cliques. Não precisa instalar Node, Java ou Android; o Chromium/Electron necessário acompanha o arquivo. A primeira abertura extrai arquivos temporários e pode levar alguns segundos. Correções e validação externa desta versão: [RELATORIO_REFINAMENTO.md](RELATORIO_REFINAMENTO.md).

A janela começa em formato de celular e pode ser redimensionada. Diário, TACO, porções, água, peso, histórico, temas e backup usam a mesma fonte `www/`. Câmera e galeria abrem o seletor de imagens do computador. Este teste não reproduz as permissões ou o comportamento de um aparelho Android.

Os dados persistem em `%APPDATA%\NutriFoto-Teste`, separados do APK e do navegador. Fechar e reabrir conserva os registros. Não apagar essa pasta se quiser mantê-los. Exportação abre o diálogo de salvar do Windows; importação permite mesclar o JSON existente. Use dados fictícios para avaliação.

Contas, IA, sincronização e pagamentos estão indisponíveis nesta versão de teste, pois não há backend publicado. Não há resultados de IA simulados apresentados como reais. O invólucro bloqueia requisições externas e não inclui backend, `.env`, credenciais ou chave de assinatura Android. Não houve chamada paga, publicação ou deploy.

O arquivo é uma distribuição local de teste, sem certificado Authenticode de distribuição comercial. A assinatura privada Android foi preservada e não participa deste build.

## Build e verificação

Ferramentas de desenvolvimento: Node >=22.12, pnpm 11.25.0, Electron 45.0.0 e electron-builder 26.15.3 fixados no lockfile. Runtime do usuário já vem incluído.

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build:windows
pnpm run test:windows
pnpm run test:windows:portatil
```

`desktop/principal.cjs` serve somente os assets empacotados por um protocolo local estável; não abre servidor TCP. Página com sandbox, isolamento de contexto e sem integração Node; permissões e navegação externa bloqueadas. O preload expõe somente uma flag para impedir o service worker web dentro do pacote. `desktop/` contém funções e utiliza as classes fornecidas pelo framework, sem classes próprias.

O build copia a fonte para uma pasta gerada, usa lista explícita de arquivos e exclui `node_modules` do pacote de aplicação. Não lê `.env`. O Electron e as ferramentas NSIS são baixados dos fornecedores oficiais pelo empacotador. Outputs ficam em `builds/windows-release/`, ignorados pelo Git. SHA-256 do executável em `SHA256SUMS.txt` nessa pasta.

`test:windows` executa jornadas sobre o EXE empacotado, em perfil temporário isolado: navegação/TACO/revisão, gravação de refeição, água/peso, reabertura com persistência, seleção de imagem, indisponibilidade de backend, bloqueio de rede, exportação/importação sem duplicar e histórico. `test:windows:portatil` abre também o arquivo portátil único e confere a interface após extração. Os testes usam a opção explícita `--teste-interface`, com janela oculta e inspeção apenas para a automação; a abertura normal exibe a janela sem DevTools.

Evidências: `evidencias/windows-build.log`, `windows-teste.log`, `windows-portatil.log`, `windows-regressao.log` e `evidencias/windows/`. As capturas e o backup de teste contêm somente dados fictícios. Não foi criado instalador, autoatualizador ou publicação comercial.

## Resultado desta entrega

Build real concluído. Seis jornadas no EXE empacotado aprovadas e abertura do arquivo portátil único aprovada, com captura após extração. Zero erros de página. Regressão Node: 70 casos, 68 aprovados, dois PostgreSQL ignorados e zero falhas; sintaxe: 97 arquivos aprovados. O pacote da aplicação contém 71 entradas, sem node_modules, arquivos privados ou padrões de chaves.

EXE: 101.333.845 bytes. SHA-256: `1b88afa64720cbcc7936615a47fd0e4d65550828e50fbdfe74b2b950c44030da`. Não houve novas chamadas de IA; o controle selado anterior conserva o SHA-256 `7017400c73e72f25c6b522e6812b70271f254d3236665e5e6b21a916b85142c6`.
