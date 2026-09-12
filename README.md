# NutriFoto

App mobile de análise nutricional por foto. Tira uma foto do prato, envia para a API **OpenRouter** (modelo GPT-4o-mini), e retorna estimativa de calorias, proteína, carboidrato e gordura. Histórico com timeline, gráficos semanais, comparação com metas diárias. Tudo 100% client-side, sem backend.

## Stack técnica

- **Frontend:** HTML5 + CSS3 + JavaScript (ES modules), sem framework
- **Armazenamento:** IndexedDB (histórico de refeições), localStorage (configurações e chave de API)
- **Empacotamento:** Capacitor 6 (gera APK Android)
- **Gráficos:** Chart.js 4 (via CDN) — donuts, barras e linhas
- **Ícones:** Lucide (via CDN)
- **Tipografia:** Plus Jakarta Sans (Google Fonts)
- **Identidade visual:** Definida com a skill `ui-ux-pro-max` (dark mode premium health, paleta emerald/amber/red, CSS variables)

## Estrutura de pastas

```
nutrifoto/
├── capacitor.config.json
├── package.json
├── README.md
├── www/
│   ├── index.html              # SPA com 5 telas
│   ├── css/
│   │   └── style.css           # 1046 linhas, dark/light mode, premium health UI
│   └── js/
│       ├── app.js              # Navegação, dashboard, settings, captura, resultados
│       ├── camera.js           # Capacitor Camera + fallback input[type=file]
│       ├── charts.js           # Hero donut, macro bars, mini bar, bar chart, line chart
│       ├── claudeApi.js        # Legado (Anthropic hardcoded, não importado pelo app)
│       ├── db.js               # Wrapper IndexedDB — CRUD de refeições
│       ├── storage.js          # localStorage — chave da API (OpenRouter) + metas diárias
│       └── visionApi.js        # Chamada fixa à API OpenRouter (chave lida de storage.js)
├── android/                    # Projeto Capacitor Android (gerado por npx cap sync)
└── node_modules/
```

> **Nota:** `claudeApi.js` é um arquivo legado com chamada hardcoded à API da Anthropic. O app atual importa `visionApi.js` (específico para OpenRouter). O arquivo pode ser removido sem impacto.

## Telas do app

### Dashboard (`screen-dashboard`)
Tela principal. No topo, um **hero donut** (anel grande de calorias com valor atual/ meta). Abaixo, **macro bars** horizontais para proteína, carboidrato e gordura com barra de progresso e percentual. Uma **mini chart bar** sempre visível mostra os últimos 7 dias, expansível para gráficos completos (barras de calorias + linha de proteína). Na parte inferior, a lista de refeições do dia com thumbnail, horário e macros. FAB (botão flutuante "+" ) para adicionar refeição.

### Captura/Análise (`screen-capture`)
Tela de captura com área de preview da imagem (aspect-ratio 4/3, borda tracejada). Dois chip buttons: **Câmera** (abre câmera nativa via Capacitor ou `input[capture]`) e **Galeria** (abre seletor de arquivo). Botão "Analisar" (desabilitado até selecionar imagem). Durante a análise, exibe **skeleton loading** animado.

### Resultado (`screen-results`)
Layout **receipt-style**. No topo, thumbnail da foto + resumo ("N alimento(s) detectado(s)"). Cada alimento é um card editável: nome editável, campo de gramas (recalcula macros proporcionalmente), botão de remover, e linha de macros. No final, um **totals summary** com gradiente verde mostrando totais. Botão sticky "Salvar refeição" no fundo.

### Histórico (`screen-history`)
Layout **timeline**. Linha vertical conecta dots coloridos por dia (verde = dentro da meta, amarelo = >85%, vermelho = excedeu). Cada dia é expansível: header com data, total de kcal e quantidade de refeições; conteúdo com lista de refeições (horário, nomes dos alimentos, kcal).

### Configurações (`screen-settings`)
Cards: **Meta calórica diária** (calorias em kcal), **Metas de macronutrientes** (proteína, carboidrato, gordura em g), **Perfil e plano alimentar** (link para a aba Meu Plano), **Notificações** (lembrete de refeição e streak, com horários — ativação em versão futura), **Exportar dados** (JSON / CSV), **Tema visual** (grade de 10 opções), **Chave da API OpenRouter** (campo para colar a chave, botões Salvar e Remover, badge de status), e **Sobre o app** (versão, desenvolvedor, link).

## Configuração da chave da API

O app usa a **OpenRouter** como provedor de IA para análise de fotos e geração de planos alimentares. A chave é **colada pelo próprio usuário** em **Configurações → Chave da API OpenRouter** e fica salva apenas no `localStorage` do navegador/dispositivo — **nunca** é enviada a nenhum servidor do NutriFoto.

### Como obter a chave

1. Acesse [https://openrouter.ai/keys](https://openrouter.ai/keys)
2. Crie uma conta (ou faça login) na OpenRouter
3. Clique em **"Create API Key"** e dê um nome à chave
4. Copie a chave (começa com `sk-or-v1-...`)
5. Cole na tela de **Configurações → Chave da API OpenRouter** e clique em **Salvar chave**

### Fluxo de uso

1. Cole sua chave na Configurações e salve
2. Na tela inicial, toque no **"+"** (novo planejamento) ou **"Escanear Alimentos"**, tire ou escolha uma foto do prato
3. O app envia a imagem para a OpenRouter e recebe a análise nutricional em JSON
4. Revise/alimente os alimentos na tela de Resultado, ajuste gramas se preciso e salve a refeição
5. Os dados ficam no IndexedDB do seu dispositivo — nada é enviado à nuvem

## Como rodar localmente

Não precisa de build. Basta servir os arquivos estáticos:

```bash
cd nutrifoto
npx serve .
# ou
python -m http.server 8000
```

Acesse `http://localhost:8000`. A câmera vai usar o fallback `<input type="file">` (funciona em qualquer navegador desktop/mobile).

**Dica:** Para testar no celular no mesmo WiFi, use o IP local (ex: `http://192.168.1.5:8000`).

## Como gerar o APK

### Pré-requisitos

- **Node.js 18+**
- **JDK 17** — instale via `choco install microsoft-openjdk17`
- **Android SDK** — mínimo `platforms;android-34`, `build-tools;34.0.0`, `platform-tools`
- **Android Studio** (recomendado, mas `gradlew` funciona sozinho)
- Defina `ANDROID_HOME` ou crie `android/local.properties` com:
  ```
  sdk.dir=C\:\\Users\\<seu-usuario>\\Android\\Sdk
  ```

### Build

```bash
cd nutrifoto
npm install
npm run sync          # equivalente a: npx cap sync android
cd android
set JAVA_HOME=C:\Program Files (x86)\Android\openjdk\jdk-17.0.14
.\gradlew.bat assembleDebug
```

O APK será gerado em:
```
android\app\build\outputs\apk\debug\app-debug.apk
```

### Scripts disponíveis no package.json

| Script | Comando | Descrição |
|--------|---------|-----------|
| `serve` | `npx serve .` | Serve os arquivos estáticos para dev |
| `sync` | `npx cap sync android` | Sincroniza www/ com o projeto Android |
| `cap:open` | `npx cap open android` | Abre o projeto no Android Studio |
| `android:build` | `cd android && ./gradlew.bat assembleDebug` | Build do APK debug |

## Limitações conhecidas

- **Chave de API exposta:** como o app é 100% client-side (HTML/JS empacotado no WebView), a chave de API fica salva apenas no localStorage do dispositivo. Não há backend intermediário. Tecnicamente é possível extrair a chave do APK via engenharia reversa. **Isso é aceitável para uso pessoal** — o próprio usuário usa a própria chave. Para distribuição pública, seria necessário um backend proxy.

- **Estimativas imprecisas:** a IA estima o peso visualmente e erra porções com frequência. A tela de Resultado permite editar gramas, remover alimentos e ajustar macros manualmente antes de salvar. Os valores são recalculados proporcionalmente quando os gramas são alterados.

- **Imagem como base64:** a foto inteira é enviada na requisição HTTP como base64. Imagens são redimensionadas para max 1024px (maior lado) antes do envio, com qualidade 85% JPEG. Mesmo assim, payloads grandes são esperados.

- **`claudeApi.js` legado:** existe um arquivo `www/js/claudeApi.js` com chamada hardcoded à Anthropic. Ele não é importado por nenhum módulo atual — o app usa `visionApi.js` (OpenRouter). Pode ser removido.

## Roadmap / evoluções futuras

A arquitetura atual (100% client-side, chave no localStorage) foi uma **decisão intencional** para uso pessoal e testes rápidos. Evoluções possíveis:

- **Backend proxy:** mover a chamada de API para um servidor próprio, escondendo a chave do cliente. Necessário para qualquer modelo de assinatura/mensalidade.
- **Autenticação de usuários:** login/cadastro para sincronizar dados entre dispositivos.
- **Exportar dados:** CSV ou PDF do histórico.
- **Mais provedores:** Google Gemini, modelos locais (Ollama). Atualmente o app usa apenas OpenRouter.
- **Modo offline:** cache de modelos nutricionais para estimativas sem internet.
- **iOS:** `npx cap sync ios` + Xcode (mesmo código, novo target).

## Validação com dados nutricionais reais (TACO)

Para alimentos caseiros/in natura (sem marca identificada), o app busca valores nutricionais **REAIS** na Tabela Brasileira de Composição de Alimentos (**TACO, 4ª edição, NEPA/UNICAMP**), 100% offline, sem chamada de API externa.

**Fonte dos dados:** [`github.com/brolesi/taco`](https://github.com/brolesi/taco) (licença MIT) — deriva diretamente da planilha oficial da TACO, cobrindo 597 alimentos com composição centesimal completa.

**Como funciona:**
1. A IA identifica o alimento e estima o peso em gramas.
2. Se o alimento não tem marca identificada (comida caseira), o app busca no JSON local `www/data/taco.json`.
3. Se encontrar: usa os valores REAIS por 100g da TACO, multiplicados pelo peso estimado pela IA.
4. Se não encontrar: mantém a estimativa da própria IA (fallback).

**Arquivo:** `www/data/taco.json` (~122 KB, carregado lazy no primeiro uso).
**Módulo de busca:** `www/js/tacoSearch.js` — normalização de nomes, busca por tokens, regra de desempate documentada.
"# nutrifoto"  
