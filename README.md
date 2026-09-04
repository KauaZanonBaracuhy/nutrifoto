# NutriFoto

App mobile de análise nutricional por foto. Tira uma foto do prato, envia para uma API de visão configurável (Anthropic, OpenAI ou qualquer API compatível), e retorna estimativa de calorias, proteína, carboidrato e gordura. Histórico com timeline, gráficos semanais, comparação com metas diárias. Tudo 100% client-side, sem backend.

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
│       ├── storage.js          # localStorage — config do provedor + presets + metas
│       └── visionApi.js        # Chamada genérica à API de visão (roda para qualquer provedor)
├── android/                    # Projeto Capacitor Android (gerado por npx cap sync)
└── node_modules/
```

> **Nota:** `claudeApi.js` é um arquivo legado com chamada hardcoded à API da Anthropic. O app atual importa `visionApi.js` (genérico). O arquivo pode ser removido sem impacto.

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
Dois **settings cards**. O primeiro é o **Provedor de IA**: botões de preset (Anthropic, OpenAI, Personalizado), campos endpoint/chave/modelo sempre visíveis, toggle "Configurações avançadas" que expande campos de header de auth, formato de auth, headers extras (JSON), template do body (JSON com placeholders), e caminho de extração da resposta. Botão "Testar conexão". O segundo card são as **Metas diárias**: grid 2x2 com campos de calorias, proteína, carboidrato e gordura.

## Configuração do provedor de IA

O app **não está preso a nenhuma API fixa**. O usuário escolhe entre presets ou configura manualmente um provedor personalizado.

### Presets implementados

#### Anthropic (Claude)
| Campo | Valor |
|-------|-------|
| Endpoint | `https://api.anthropic.com/v1/messages` |
| Modelo | `claude-sonnet-4-20250514` |
| Header de auth | `x-api-key` |
| Formato do valor | `{chave}` |
| Headers extras | `{"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"}` |
| Response path | `content[0].text` |

**Template do body:**
```json
{
  "model": "{modelo}",
  "max_tokens": 1024,
  "messages": [{
    "role": "user",
    "content": [
      { "type": "image", "source": { "type": "base64", "media_type": "{mime_type}", "data": "{imagem_base64}" } },
      { "type": "text", "text": "{prompt_texto}" }
    ]
  }]
}
```

#### OpenAI (GPT-4o)
| Campo | Valor |
|-------|-------|
| Endpoint | `https://api.openai.com/v1/chat/completions` |
| Modelo | `gpt-4o` |
| Header de auth | `Authorization` |
| Formato do valor | `Bearer {chave}` |
| Headers extras | `{}` |
| Response path | `choices[0].message.content` |

**Template do body:**
```json
{
  "model": "{modelo}",
  "messages": [{
    "role": "user",
    "content": [
      { "type": "image_url", "image_url": { "url": "data:{mime_type};base64,{imagem_base64}" } },
      { "type": "text", "text": "{prompt_texto}" }
    ]
  }],
  "max_tokens": 1024
}
```

#### Personalizado
Quando o usuário seleciona "Personalizado", todos os campos são limpos. O usuário preenche manualmente:

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| **Endpoint** | URL da API | `https://api.example.com/v1/chat` |
| **Chave de API** | Token de autenticação | `sk-abc123...` |
| **Modelo** | Identificador do modelo | `gpt-4o-mini` |
| **Nome do provedor** | Label descritivo | `Minha API Local` |
| **Header de auth** | Nome do header HTTP | `Authorization` |
| **Formato do valor** | Template com `{chave}` | `Bearer {chave}` |
| **Headers extras** | JSON com headers adicionais | `{"X-Custom":"value"}` |
| **Template do body** | JSON com placeholders | (ver abaixo) |
| **Cam. extração resposta** | Notação pontual no JSON de resposta | `data.choices[0].text` |

**Placeholders disponíveis no template do body:**
- `{modelo}` — substituído pelo campo "Modelo"
- `{imagem_base64}` — base64 da foto redimensionada (max 1024px)
- `{mime_type}` — tipo MIME da imagem (ex: `image/jpeg`)
- `{prompt_texto}` — prompt fixo de análise nutricional (em português)

**Campos de extração da resposta** suportam notação pontual com arrays:
- `content[0].text` — Anthropic
- `choices[0].message.content` — OpenAI
- `data.result.text` — genérico

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

- **`claudeApi.js` legado:** existe um arquivo `www/js/claudeApi.js` com chamada hardcoded à Anthropic. Ele não é importado por nenhum módulo atual — o app usa `visionApi.js` (genérico). Pode ser removido.

## Roadmap / evoluções futuras

A arquitetura atual (100% client-side, chave no localStorage) foi uma **decisão intencional** para uso pessoal e testes rápidos. Evoluções possíveis:

- **Backend proxy:** mover a chamada de API para um servidor próprio, escondendo a chave do cliente. Necessário para qualquer modelo de assinatura/mensalidade.
- **Autenticação de usuários:** login/cadastro para sincronizar dados entre dispositivos.
- **Exportar dados:** CSV ou PDF do histórico.
- **Mais presets:** OpenRouter, Google Gemini, modelos locais (Ollama).
- **Modo offline:** cache de modelos nutricionais para estimativas sem internet.
- **iOS:** `npx cap sync ios` + Xcode (mesmo código, novo target).
"# nutrifoto"  
