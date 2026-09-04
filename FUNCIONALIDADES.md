# NutriFoto — Levantamento Completo de Funcionalidades

Documento gerado a partir de inspeção direta dos arquivos do projeto em **setembro/2026**. Cobre estado atual, todas as telas, módulos JS, fluxo de dados e limitações conhecidas.

---

## 1. Visão geral

App mobile (Android via Capacitor) de **análise nutricional por foto**. O usuário tira foto de um prato → envia para uma API de visão configurável (Anthropic, OpenAI ou compatível) → recebe estimativa de calorias e macros → pode editar e salvar → vê histórico, gráficos e metas.

**Características:**
- 100% client-side: nenhum backend próprio, nenhum servidor intermediário.
- Chave de API do usuário fica no `localStorage` do dispositivo.
- Funciona como SPA HTML5 empacotada no WebView do Capacitor.

**Stack:**
- Frontend: HTML5 + CSS3 + JavaScript ES modules, **sem framework** (vanilla).
- Armazenamento: IndexedDB (histórico) + localStorage (configurações).
- Gráficos: Chart.js 4 via CDN.
- Ícones: Lucide via CDN.
- Tipografia: Space Grotesk (Google Fonts).
- Empacotamento: Capacitor 6 → APK Android.

---

## 2. Telas (5 telas, todas em SPA única — `index.html`)

### 2.1 Dashboard (`#screen-dashboard`)
Tela principal. Sempre visível após abrir o app.
- **Hero donut** (canvas `#donut-hero`): anel grande de calorias atuais vs meta, desenhado por Chart.js (doughnut, cutout 82%). Valor central `#hero-cal-value` / meta `#hero-cal-goal`. Gradiente pulse animado de fundo.
- **Streak badge** decorativo `#streak-badge`: pequeno badge com ícone de chama, mostra "7 dias" — **valor hardcoded, sem lógica de cálculo**. Adicionado na direção visual B, não tem função programática.
- **Macro bars** (`#macro-bars`): três linhas horizontais para Proteína (P, roxo), Carboidrato (C, laranja) e Gordura (G, coral), com track + fill animado via `updateMacroBars()` em `charts.js`. Cor muda para coral quando excede a meta, laranja quando >85%.
- **Mini chart bar** (`#mini-chart-bar`): 7 barras finas verticais (uma por dia), altura proporcional ao total de calorias. Cor verde/laranja/coral conforme status.
- **Botão "Gráficos da semana"** (`#btn-expand-charts`): expande/colapsa os gráficos completos.
- **Gráficos expandidos** (`#charts-expanded`): dois Chart.js canvas — `#chart-bars` (calorias, 7 dias) e `#chart-line` (proteína, 7 dias).
- **Lista de refeições do dia** (`#meals-list`): thumbnails, horário, nome do primeiro alimento + "+N", macros e botão de excluir (`[data-del]`).
- **FAB** (`#btn-add-meal`): botão flutuante "+" canto inferior direito, abre tela de captura. Glow pulsante animado.

### 2.2 Captura (`#screen-capture`)
- **Preview de imagem** (`#image-preview`): área com borda tracejada, mostra ícone + texto inicial; após selecionar imagem, mostra thumbnail.
- **Chip buttons**: `#btn-camera` (abre câmera nativa via Capacitor ou `input[capture]` no navegador) e `#btn-gallery` (galeria).
- **Botão "Analisar"** (`#btn-analyze`): desabilitado até ter imagem. Ao clicar, mostra `#skeleton-loading` (5 linhas skeleton com gradiente shimmer animado).
- **Cancelar** (`#btn-cancel-capture`): volta para dashboard.

### 2.3 Resultado (`#screen-results`)
Layout **receipt-style** (como nota fiscal).
- **Hero do resultado** (`#result-hero`): thumbnail + texto "N alimento(s) detectado(s)".
- **Lista de alimentos** (`#foods-list`): cada `.food-receipt` é um card editável:
  - Nome do alimento (`input[data-field="nome"]`) editável.
  - Gramas (`input[data-field="porcao_estimada_g"]`): alterar recalcula todos os macros proporcionalmente em tempo real via `f.calorias_original` etc.
  - Botão remover (`[data-remove]`).
- **Totals summary** (`#totals-summary`): 4 colunas (kcal, P, C, G) com gradiente de texto. Atualiza via `updateTotals()`.
- **Botão "Salvar refeição"** (`#btn-save-meal`): sticky no rodapé. Salva no IndexedDB e mostra overlay de confirmação (`#confirm-overlay`) com SVG animado de check.

### 2.4 Histórico (`#screen-history`)
Layout **timeline vertical**.
- Linha vertical com gradiente jade→azul conecta os dias.
- Cada dia (`#timeline-day`) tem:
  - **Dot colorido** (`#timeline-dot`): verde (dentro da meta), laranja (>85%), coral (excedeu), cinza (vazio).
  - **Header** (`#timeline-day-header`): data formatada ("Hoje" para hoje, senão `dd/mm/yyyy`), total kcal + quantidade de refeições, seta expansível.
  - **Conteúdo** (`.timeline-day-content`): lista de refeições do dia com horário, nomes concatenados, kcal.
- Clique no header expande/colapsa (`max-height` animado).

### 2.5 Configurações (`#screen-settings`)
Dois cards principais.
- **Card Provedor de IA**:
  - Botões de preset (`#preset-buttons`): `Anthropic (Claude)`, `OpenAI (GPT-4o)`, `Personalizado`. Aplicação limpa ou preenche campos.
  - Campos sempre visíveis: endpoint, chave (password), modelo.
  - Toggle "Configurações avançadas" (`#btn-toggle-advanced`) expande: nome do provedor, header de auth, formato do valor, headers extras (JSON), template do body (JSON), caminho de extração.
  - Botão "Testar conexão" (`#btn-test-connection`) — envia payload mínimo com imagem 1×1 para validar a config sem consumir tokens da análise real.
- **Card Metas diárias**: grid 2×2 com calorias, proteína, carboidrato, gordura.
- **Botão "Salvar tudo"** (`#btn-save-settings`): sticky no rodapé.

### 2.6 Header global
- Botão de alternar tema (`#btn-toggle-theme`): toggle dark ↔ light via atributo `data-theme` no `<html>`. Salvo em `localStorage`.

---

## 3. Módulos JavaScript

### 3.1 `app.js` — Núcleo da aplicação (558 linhas)
**Responsabilidades:** navegação entre telas, renderização do dashboard, fluxo de captura/análise/save, settings.

| Função | O que faz |
|---|---|
| `getTheme()` / `setTheme()` / `toggleTheme()` | Tema dark/light, persiste em `localStorage` (`nutrifoto.theme`) |
| `showScreen(name)` | Troca `.screen.active` e ajusta visibilidade da nav inferior e do FAB |
| `toast(msg, isError)` | Toast feedback rápido (2.8s) |
| `showConfirmation()` | Overlay de "salvo!" com SVG animado |
| `formatTime()` / `formatDate()` / `escapeHtml()` | Helpers de formatação |
| `renderDashboard()` | Calcula totais do dia, atualiza hero donut, macro bars, mini/gráficos e lista de refeições |
| `toggleCharts()` | Expande/colapsa `#charts-expanded` |
| `setCaptureImage(img)` | Atualiza preview e habilita/desabilita botão analisar |
| `handleImage(captureFn)` | Pipeline comum câmera/galeria: captura → downscale 1024px → preview |
| `handleAnalyze()` | Mostra skeleton, chama `analyzeImage()`, vai para tela de resultado |
| `renderResults()` | Renderiza hero + cards de alimentos editáveis + totals |
| `ensureOriginals(f)` | Guarda valores originais para recalcular proporcionalmente |
| `updateTotals()` | Recalcula e atualiza `#totals-summary` |
| `handleSaveMeal()` | Persiste refeição no IndexedDB, mostra confirmação, volta pro dashboard |
| `renderHistory()` | Lê `listarHistorico()`, monta timeline agrupada por dia com classificação de status |
| `getStatusClass(dayTotal, goals)` | `status-empty` / `status-ok` / `status-warn` / `status-over` |
| `renderPresetButtons()` / `applyPreset(id)` | Botões de provedor e aplicação de templates |
| `renderSettings()` | Lê `getProviderConfig()` + `getGoals()`, popula inputs |
| `collectProviderConfig()` / `handleSaveSettings()` | Coleta form e salva |
| `handleTestConnection()` | Envia payload mínimo, mostra sucesso/erro em `#test-result` |
| `toggleAdvanced()` | Expande `#advanced-fields` |
| `bind()` | Liga eventos de todos os botões |
| `DOMContentLoaded` | Init |

### 3.2 `camera.js` — Captura de imagem (99 linhas)
**Responsabilidades:** pegar foto da câmera nativa ou galeria, com fallback para `<input type="file">` no navegador.

| Função | O que faz |
|---|---|
| `getCapacitorCamera()` | Detecta plugin `Capacitor.Plugins.Camera` uma vez, cacheia |
| `fromCapacitor(source)` | Usa plugin nativo: `getPhoto({ resultType:'base64', source, quality:85, allowEditing:false })`. Retorna `{dataUrl, base64, mediaType}` |
| `fromInput(capture)` | Fallback: cria `<input type=file>` invisível, lê como FileReader → dataUrl |
| `captureFromCamera()` | Tenta Capacitor primeiro, senão `fromInput(true)` |
| `pickFromGallery()` | Tenta Capacitor primeiro, senão `fromInput(false)` |
| `downscaleImage(dataUrl, maxDim=1024)` | Redimensiona a imagem antes de enviar (canvas + toDataURL jpeg 85%) |

### 3.3 `charts.js` — Visualizações Chart.js (307 linhas)
**Responsabilidades:** renderizar todos os gráficos e reagir a mudanças de tema.

| Função | O que faz |
|---|---|
| `isDark()` / `getColors()` | Paleta baseada em `data-theme` (emojis, vermelho, âmbar, roxo, superfície, etc.) |
| `getStatusColor(pct)` | Cor por faixa: verde / âmbar / vermelho |
| `updateHeroDonut(value, goal)` | Donut grande de calorias no dashboard (doughnut, cutout 82%, animateRotate 1s) |
| `updateMacroBars(totals, goals)` | 3 barras horizontais (P, C, G) com cor por status |
| `renderMiniBar(dailyData, goal)` | Strip de 7 barras finas (calorias dos últimos 7 dias) |
| `renderBarChart(dailyData, goal)` | Bar chart completo de calorias, expandido |
| `renderLineChart(dailyData, goal)` | Line chart de proteína + linha de meta tracejada, expandido |

**Observação:** `charts.js` ainda referencia `'Plus Jakarta Sans'` em três lugares (linhas 189, 194, 208, 278, 283, 297) — fonte que **não é mais importada**. Cosmético (Chart.js cai no fallback de sistema), mas vale atualizar para `'Space Grotesk'` em algum momento.

### 3.4 `db.js` — IndexedDB (104 linhas)
**Responsabilidades:** CRUD de refeições.

| Função | O que faz |
|---|---|
| `openDB()` | Abre/cria banco `nutrifoto` v1, cria store `meals` com índice em `createdAt` |
| `tx(mode)` | Atalho para transação no store |
| `reqToPromise(req)` | Wrap de IDBRequest em Promise |
| `salvarRefeicao(meal)` | Adiciona registro (autoIncrement id), preenche `createdAt` se ausente |
| `listarRefeicoesDoDia(dateISO?)` | Filtra por dia (YYYY-MM-DD), ordena por `createdAt` |
| `listarHistorico()` | Agrupa todas as refeições por dia, ordena dias DESC, retorna `[{day, meals:[…]}]` |
| `deletarRefeicao(id)` | Remove por id |
| `listarTotaisPorDia(dias=7)` | Agrega calorias/proteína/carboidrato/gordura por dia nos últimos N dias, preenche dias vazios com zeros |

### 3.5 `storage.js` — localStorage (120 linhas)
**Responsabilidades:** persistir config do provedor + metas; expor presets.

| Função | O que faz |
|---|---|
| `getProviderConfig()` / `setProviderConfig(cfg)` | Lê/grava `nutrifoto.provider` |
| `getDefaultProvider()` | Retorna preset Anthropic como padrão |
| `getPreset(name)` / `getPresetNames()` | Lista/busca preset por id |
| `getApiKey()` / `setApiKey()` | Legacy, mantido para compatibilidade |
| `isConfigured()` | Bool: tem `apiKey` e `endpoint`? |
| `getGoals()` / `setGoals(goals)` | Metas padrão 2200/150/250/70 kcal/P/C/G — lido/gravado em `nutrifoto.goals` |

**Presets definidos:**
- `anthropic`: endpoint `https://api.anthropic.com/v1/messages`, modelo `claude-sonnet-4-20250514`, header `x-api-key`, formato `{chave}`, extras `{"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"}`, responsePath `content[0].text`
- `openai`: endpoint `https://api.openai.com/v1/chat/completions`, modelo `gpt-4o`, header `Authorization`, formato `Bearer {chave}`, responsePath `choices[0].message.content`
- `custom`: usuário preenche tudo manualmente (campos limpos quando selecionado)

### 3.6 `visionApi.js` — Chamada à API de visão (245 linhas)
**Responsabilidades:** montar requisição genérica para qualquer provedor configurado e parsear o JSON retornado.

| Função | O que faz |
|---|---|
| `resolveTemplate(template, vars)` | Substitui placeholders `{modelo}`, `{imagem_base64}`, `{mime_type}`, `{prompt_texto}` |
| `navigatePath(obj, path)` | Navega `content[0].text` ou `choices[0].message.content` etc. |
| `extractJson(text)` | Tenta `JSON.parse` direto; se falhar, regex `\{[\s\S]*\}` |
| `recalculateTotal(alimentos)` | Soma macros considerando ajuste proporcional de porção |
| `recalcularTotal(alimentos)` | Re-export |
| `analyzeImage({base64, mediaType})` | Monta headers (auth + extras), monta body via template, valida JSON, faz `fetch POST`, navega responsePath, parseia JSON, normaliza alimentos (garante `porcao_original_g`) e total |
| `testConnection()` | Mesma pipeline mas com imagem 1×1 PNG e prompt trivial para validar config sem gastar tokens |

**Constante:** `ANALYSIS_PROMPT` — prompt fixo em PT-BR pedindo JSON com nome/gramas/calorias/P/C/G por alimento, mais objeto `total`.

---

## 4. Fluxo de dados

### 4.1 O que vai pro **IndexedDB** (banco `nutrifoto`, store `meals`)
Estrutura do registro:
```
{
  id: number (autoIncrement),
  imageDataUrl: string | null,    // base64 da foto (thumb 1024px)
  alimentos: [{ nome, porcao_estimada_g, porcao_original_g,
                calorias, calorias_original, proteina_g, proteina_original,
                carboidrato_g, carbo_original, gordura_g, gordura_original }],
  total: { calorias, proteina_g, carboidrato_g, gordura_g },
  createdAt: ISO string (ex: "2026-09-03T18:42:11.000Z")
}
```
Os sufixos `_original` só existem se o usuário editou os gramas (usados para recalcular proporcionalmente).

### 4.2 O que vai pro **localStorage**
| Chave | Conteúdo |
|---|---|
| `nutrifoto.theme` | `'dark'` ou `'light'` |
| `nutrifoto.provider` | JSON do provedor completo (preset + name + endpoint + apiKey + model + authHeaderName + authFormat + extraHeaders + bodyTemplate + responsePath) |
| `nutrifoto.goals` | JSON com `{calories, protein, carb, fat}` |

### 4.3 O que é **temporário em memória** (objeto `state` em `app.js`)
- `currentImage`: `{dataUrl, base64, mediaType}` da foto atual.
- `currentAnalysis`: resultado da última análise.
- `activePreset`: id do preset selecionado em settings.
- `chartsExpanded`: bool, mini chart expandido ou não.
- `advancedOpen`: bool, campos avançados abertos em settings.

---

## 5. Permissões Android
Declaradas em `AndroidManifest.xml`:
- `INTERNET` (chamadas de API)
- `CAMERA` + `<uses-feature camera>` (não obrigatória via hardware)
- `READ_EXTERNAL_STORAGE` (maxSdk 32 — legado)
- `READ_MEDIA_IMAGES` (Android 13+)

Não há ainda permissão de **WRITE_EXTERNAL_STORAGE** nem **POST_NOTIFICATIONS** (relevante se notificações forem adicionadas no futuro).

---

## 6. Funcionalidades parciais / bugs / código morto

| Item | Detalhe |
|---|---|
| **`streak-badge` hardcoded** | `#streak-num` está fixo em `7 dias`, sem cálculo real de sequência de dias. Adicionado como elemento visual na Direção B; precisa ser ligado à lógica de dias consecutivos com refeição registrada. |
| **`claudeApi.js` citado no README** | README menciona um `www/js/claudeApi.js` legado. **Não existe mais** no projeto — somente `visionApi.js`. README desatualizado nessa seção. |
| **`'Plus Jakarta Sans'` em `charts.js`** | Linhas 189, 194, 208, 278, 283, 297 referenciam uma fonte que não é mais importada (foi trocada por Space Grotesk). Cosmético — Chart.js cai no fallback de sistema — mas é inconsistência a corrigir. |
| **README menciona `npm run sync`** | Funciona (definido em `package.json`), mas o nome do diretório de trabalho usado nos exemplos é `nutrifoto/` (OK) e o usuário local roda com `npx cap sync android` direto. |
| **`test_automated.py`** | Script Playwright apontando para `localhost:3000` (não 5173). Útil como base para testes futuros, mas precisa atualizar a porta. |
| **`@capacitor/cli` instalado localmente** | Presente em `node_modules`, mas o projeto usa `npx cap` em vez de `npm run cap`. Funcional, mas não ideal para reprodutibilidade. |
| **Sem testes automatizados rodando em CI** | Nenhum CI configurado (`.github/` não existe). |
| **Sem ícone customizado para notificações** | Irrelevante hoje (não há notificações), mas a constar se forem adicionadas. |
| **`Porção original` pode ficar zerada** | Se o primeiro valor que a IA retorna já vem 0 (improvável), o recálculo proporcional divide por 0 silenciosamente. Edge case, não tratado. |
| **Botão de testar conexão não tem loading state visual próprio** | Apenas desabilita o botão e troca o texto. Pode passar despercebido em conexões lentas. |
| **Imagem cresce indefinidamente no IndexedDB** | Cada foto é salva como base64 (max ~200KB após downscale). Sem rotação/limpeza automática — pode chegar a 50MB+ com uso pesado. Não há política de retenção. |
| **Sem migração de schema do IndexedDB** | `DB_VERSION = 1` fixo. Se o schema mudar no futuro, precisa implementar `onupgradeneeded` para v2. |
| **Idioma hardcoded em PT-BR** | Datas e labels todos em pt-BR, sem `lang` dinâmico. Não crítico para uso pessoal. |
| **Sem modo escuro automático por horário** | Toggle é manual. |

---

## 7. Resumo de capacidades por categoria

**Captura e análise** ✅ totalmente funcional  
**Persistência local** ✅ robusta  
**Configuração flexível de provedor** ✅ supera a maioria dos apps do nicho  
**Visualização de histórico e tendências** ✅ completa  
**Edição pós-análise** ✅ proporcional e granular  
**Tema dark/light** ✅ funcional  
**Gamificação** ⚠️ streak é visual-only  
**Notificações** ❌ não existe  
**Sincronização entre dispositivos** ❌ não existe  
**Exportação de dados** ❌ não existe  
**Modo offline (análise sem internet)** ❌ não existe  
**Múltiplos usuários / perfis** ❌ não existe  
**Backend próprio / proxy de chave** ❌ não existe (decisão arquitetural intencional)  

---

*Documento gerado por inspeção direta do código em 03/09/2026. Nenhuma funcionalidade listada foi inferida — todas foram confirmadas em `app.js`, `camera.js`, `charts.js`, `db.js`, `storage.js` e `visionApi.js`.*