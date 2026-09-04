# NutriFoto — 10 Ideias de Novas Implementações

Sugestões ordenadas da **mais simples/rápida de implementar** para a **mais complexa**. Cada item considera o contexto do app: **100% client-side, sem backend, uso pessoal, Capacitor + WebView Android**.

---

## 1. Streak real com lógica de dias consecutivos

**Descrição:** Tornar o badge `#streak-badge` (atualmente hardcoded em "7 dias") funcional. Calcular quantos dias consecutivos o usuário registrou ao menos uma refeição, olhando o `createdAt` de todas as refeições no IndexedDB. Mostrar a contagem real e animar quando o usuário registrar uma refeição que estende o streak (ex: badge pulsa verde). Mostrar também o recorde pessoal (`bestStreak`) salvo em `localStorage`.

**Por que é útil:** Dá propósito diário ao uso. Streak é o mecanismo de retenção mais usado em apps de hábitos (Duolingo, Apple Watch, etc.) — funciona.

**Complexidade:** **Baixa.** Toda a lógica cabe em ~30 linhas de função utilitária em `db.js` (`getCurrentStreak()` + `getBestStreak()`), `app.js` chama no `renderDashboard()`, e um listener novo em `handleSaveMeal()` dispara animação. CSS já tem `pulseGlow` reaproveitável.

**Dependências externas:** Nenhuma. Tudo local.

---

## 2. Exportar histórico em CSV / JSON

**Descrição:** Adicionar botão "Exportar" na tela de Configurações (ou na tela de Histórico) que gera um arquivo `.csv` (ou `.json`) com todas as refeições: data, hora, nome do alimento, gramas, calorias, P/C/G, totais por dia. No navegador, baixa via `Blob` + `URL.createObjectURL`. No Android via Capacitor, usar `@capacitor/filesystem` para gravar em `Downloads/` e abrir com `@capacitor/share`.

**Por que é útil:** O usuário controla os próprios dados. CSV abre em qualquer planilha; compartilhar com nutricionista, fazer backup próprio, importar em outro app.

**Complexidade:** **Baixa-média.** Implementação pura JS é `< 50 linhas`; o pulo do gato é o Capacitor `Filesystem.writeFile` + `Share.share` para o app nativo (precisa instalar 2 plugins e ajustar permissões no `AndroidManifest.xml` se for usar armazenamento externo em Android 10+).

**Dependências externas:** `@capacitor/filesystem` + `@capacitor/share` (ambos oficiais Capacitor). Em Android, `WRITE_EXTERNAL_STORAGE` para API ≤ 29 (Scoped Storage resolve em API 30+).

---

## 3. Atalhos rápidos: registrar refeição sem foto

**Descrição:** Adicionar um modo "rápido" na tela de Captura, abaixo dos botões de câmera/galeria. O usuário digita o nome de um alimento (ex: "banana média"), o app consulta uma **tabela nutricional local embutida** (USDA FoodData Central exportado para JSON estático, ~200-500 alimentos comuns) e cria uma refeição instantânea. Útil quando você come algo trivial (fruta, barra de proteína) e tirar foto é exagero.

**Por que é útil:** Reduz fricção. Foto é ótima para pratos elaborados; para "1 maçã + 1 scoop de whey" não vale o tempo. Aumenta frequência de uso.

**Complexidade:** **Média.** O trabalho pesado é montar a tabela nutricional (~300KB de JSON estático servido do `www/data/foods.json`) e função de busca. UX: input com autocomplete, lista filtrada, toque para confirmar porção padrão. Toda a lógica de save já existe.

**Dependências externas:** Nenhuma (tabela é JSON estático embutido). Fonte de dados: USDA FoodData Central é pública e livre.

---

## 4. Lembretes / notificações para registrar refeições

**Descrição:** O usuário configura horários de "lembrete" em Configurações (ex: café 8h, almoço 12h, jantar 19h). O app dispara uma notificação push nativa do Android no horário, dizendo "Hora de registrar o almoço 🍽️". Quando o usuário toca na notificação, abre direto na tela de Captura. Lógica de streaks potencializa (não esquece de comer → mantém sequência).

**Por que é útil:** Engajamento passivo. Lembra o usuário de usar o app, sem precisar ficar abrindo.

**Complexidade:** **Média.** Plugin oficial `@capacitor/local-notifications` cobre agendamento. Requer permissão `POST_NOTIFICATIONS` em Android 13+ (adicionar ao `AndroidManifest.xml`). UX: switch on/off por horário, picker de horário, persistir em `localStorage` (chave `nutrifoto.reminders`).

**Dependências externas:** `@capacitor/local-notifications`. Permissão Android: `POST_NOTIFICATIONS`.

---

## 5. Insights semanais / mensais automáticos

**Descrição:** Geração automática de insights no Dashboard (card expansível) baseado nos últimos 7 ou 30 dias. Exemplos:
- "Você consumiu em média 1.840 kcal/dia (meta: 2.200). Diferença: -360 kcal."
- "Proteína ficou 18% abaixo da meta 4 dos últimos 7 dias."
- "Maior refeição da semana: almoço de terça (920 kcal)."
- "Você registra melhor às terças e sextas."

Cálculos puros em cima do `listarTotaisPorDia(30)` que já existe.

**Por que é útil:** Transforma dados brutos em informação acionável. Usuário sabe no que focar sem precisar abrir gráficos manualmente.

**Complexidade:** **Média.** Função pura `gerarInsights(meals, goals)` que retorna array de strings `{text, type: 'info'|'warn'|'success'}`. Renderizar como card `.insights-card` com cor por tipo. ~80 linhas JS + ~30 linhas CSS.

**Dependências externas:** Nenhuma.

---

## 6. Templates / favoritos de refeições

**Descrição:** Usuário cria templates a partir de refeições já salvas. Ex: depois de salvar "Arroz + Feijão + Frango" 5 vezes, ele marca como favorito e nomeia "Almoço padrão". Da próxima vez, em vez de tirar foto, abre o template e clica "Salvar como refeição de hoje" — reutiliza os macros já calculados, criando um registro sem precisar de nova análise de IA.

**Por que é útil:** Acelera muito o uso recorrente. A IA custa API call; refeições repetidas não precisam de análise nova.

**Complexidade:** **Média.** Adicionar novo store no IndexedDB (`templates`) ou usar `localStorage` (templates são pequenos). Botão "⭐ Salvar como template" na tela de Resultados; lista de templates em nova tela ou aba lateral; botão "aplicar template" cria refeição com `createdAt = now`. ~120 linhas no total.

**Dependências externas:** Nenhuma.

---

## 7. Water tracker / hidratação

**Descrição:** Card adicional no Dashboard com progresso de hidratação diária (copos de água). Meta configurável em Configurações (padrão: 8 copos = 2L). Botão rápido `+1 copo` e `-1 copo`. Marca cada copo com timestamp no IndexedDB (novo store `water`). Mostra anel de progresso no estilo do hero donut, mas em azul (cor `--blue`). Lista do dia no histórico.

**Por que é útil:** Refeição sem hidratação é análise incompleta. Adiciona nova dimensão sem complicar (1 número por dia). Aumenta número de toques diários no app.

**Complexidade:** **Média.** CRUD simples em IndexedDB (similar a `db.js`), nova seção no Dashboard, nova entrada de meta em Configurações. ~150 linhas no total.

**Dependências externas:** Nenhuma.

---

## 8. Diário de humor / energia pós-refeição

**Descrição:** Após salvar refeição (no overlay de confirmação), mostrar opcionalmente um seletor rápido de humor (😊 neutro, 😴 sonolento, ⚡ energizado, 🤢 pesado). Salva junto com a refeição no IndexedDB. Dashboard ganha pequena timeline visual mostrando como o usuário se sentiu após cada refeição do dia. Insights cruzados: "Refeições com +500 kcal têm correlação com sensação de peso."

**Por que é útil:** Conecta o que você come com como você se sente. Loop emocional + nutricional. Diferencial real vs concorrentes.

**Complexidade:** **Média-alta.** Adiciona campo opcional `mood: number` no registro. UI: 4 botões emoji no overlay de confirmação (só se usuário expandir). Componente de visualização no Dashboard com barra colorida. Lógica de correlação em `gerarInsights()`. ~200 linhas.

**Dependências externas:** Nenhuma.

---

## 9. Modo offline com estimativa heurística local

**Descrição:** Tabela nutricional embutida (mesma do item 3) vira a base de um modo offline. Quando o app detecta sem internet, troca o botão "Analisar" por "Estimar localmente". Usa correspondência de nome (fuzzy) ou seleção manual da tabela nutricional local para gerar estimativa sem chamar IA. UI indica claramente que é estimativa local (badge "Offline"). Funciona com 200-500 alimentos comuns.

**Por que é útil:** Garante que o app é utilizável em qualquer situação — viagem, restaurante sem WiFi, áreas rurais. Reduz dependência de API paga.

**Complexidade:** **Alta.** Requer a tabela nutricional embutida (mesmo trabalho do item 3), lógica de fuzzy matching (Levenshtein ou similar — pequena lib ou ~50 linhas manuais), pipeline alternativo de análise em `visionApi.js` ou módulo novo `localEstimation.js`. ~300-400 linhas.

**Dependências externas:** Nenhuma (dados são públicos — USDA FoodData Central). Opcional: uma lib leve de fuzzy match como `fuse.js` (~12KB).

---

## 10. Reconhecimento offline no dispositivo (TFLite / on-device vision)

**Descrição:** Subir o nível real — rodar **classificação de imagem no próprio dispositivo** com um modelo leve (TFLite ou ONNX, ex: EfficientNet-Lite ou YOLO-Nano treinado em food-101 dataset). O app tira foto, classifica localmente os top-K alimentos visíveis, busca as calorias na tabela nutricional embutida (item 3), e entrega o resultado **sem nenhuma chamada de API, sem internet, sem custo por análise**.

**Por que é útil:** Elimina custo recorrente de API. Funciona offline. Privacidade total. É o sonho do app 100% local.

**Complexidade:** **Alta.** Modelo TFLite (~5-15MB) precisa ser empacotado no APK. Para rodar no WebView, precisa de `@capacitor-mlkit/barcode-scanner` ou um plugin TFLite custom (não existe oficial). Alternativa: usar `tfjs` (TensorFlow.js) com modelo convertido — funciona no WebView mas é pesado. UX: manter chamada de IA como fallback "se não tiver certeza, peça à IA". Estimativa: 1-2 semanas de trabalho dedicado, mais empacotamento/teste no Android. Pode degradar performance em devices antigos.

**Dependências externas:** Modelo treinado (pode-se converter `food-101` existente do TensorFlow Hub). Plugin TFLite custom OU `@tensorflow/tfjs` (~1MB runtime). Permissão extra Android: nenhuma nova além das já existentes.

---

## Resumo visual

| # | Funcionalidade | Categoria | Complexidade | Plugins/Permissões novas |
|---|---|---|---|---|
| 1 | Streak real | Engajamento | Baixa | Nenhuma |
| 2 | Exportar CSV/JSON | Praticidade | Baixa-média | `@capacitor/filesystem`, `@capacitor/share` |
| 3 | Atalhos rápidos (sem foto) | Praticidade | Média | Nenhuma |
| 4 | Lembretes/notificações | Engajamento | Média | `@capacitor/local-notifications`, `POST_NOTIFICATIONS` |
| 5 | Insights automáticos | Insights | Média | Nenhuma |
| 6 | Templates de refeição | Praticidade | Média | Nenhuma |
| 7 | Water tracker | Engajamento | Média | Nenhuma |
| 8 | Humor pós-refeição | Personalização | Média-alta | Nenhuma |
| 9 | Modo offline (heurístico) | Praticidade | Alta | Nenhuma |
| 10 | Classificação on-device (TFLite) | Precisão | Alta | TFLite custom ou tfjs |

**Sugestão de roadmap incremental (se for fazer só algumas):** 1 → 5 → 3 → 4 → 6 → 2 → 7 → 8 → 9 → 10. Começa pelas que trazem retorno rápido com baixo risco (1, 5), depois amplia o leque (3, 4, 6, 7), e por último os investimentos pesados em precisão/offline (9, 10).

---

*Documento gerado por análise do projeto em 03/09/2026. Considerou o estado atual (Direção B visual implementada, fluxo 100% client-side com IndexedDB + localStorage, Capacitor 6).*