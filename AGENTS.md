# NutriFoto — Contexto do Projeto

App web (pasta `www/`) que analisa fotos de alimentos via IA (OpenRouter, gpt-4o-mini) para calcular macros. 100% client-side, sem backend.

## Stack

- **Frontend:** HTML5 + CSS3 + JavaScript (ES modules), sem framework
- **Armazenamento:** IndexedDB (histórico), localStorage (configurações)
- **Gráficos:** Chart.js 4 (CDN) — donuts, barras e linhas
- **Ícones:** Lucide (CDN)
- **Tipografia:** Plus Jakarta Sans (Google Fonts)
- **Empacotamento:** Capacitor 6 (gera APK Android)

## Estrutura

```
nutrifoto/
├── www/
│   ├── index.html              # SPA com 5 telas
│   ├── data/taco.json          # Base TACO offline (597 alimentos, 122KB)
│   ├── css/style.css           # 10 temas via CSS variables + [data-theme]
│   └── js/
│       ├── app.js              # Navegação, dashboard, settings, captura, resultados
│       ├── camera.js           # Capacitor Camera + fallback file input
│       ├── charts.js           # Hero donut, macro bars, mini bar, bar/line charts
│       ├── config.local.js     # Chave OpenRouter (não commitado)
│       ├── db.js               # Wrapper IndexedDB — CRUD de refeições
│       ├── dietPlan.js         # Gerador de plano alimentar
│       ├── foodAlternatives.js # Alternativas alimentares
│       ├── storage.js          # localStorage — chave API + metas diárias
│       ├── tacoSearch.js       # Busca local na TACO (normalização + tokens)
│       └── visionApi.js        # Chamada à OpenRouter (visão nutricional)
└── shared/                     # Código compartilhado (css, js, icons)
```

## Deploy — REGRA PERMANENTE

Este projeto está conectado à Vercel via integração automática com o GitHub. Isso significa:

- Qualquer commit + push feito na branch main dispara o deploy AUTOMATICAMENTE na Vercel. Não é necessário rodar `vercel login`, `vercel deploy`, nem qualquer comando da Vercel CLI.
- Você NUNCA precisa se preocupar com autenticação da Vercel, verificar credenciais, ou tentar rodar deploy manualmente.
- Sua única responsabilidade após qualquer alteração aprovada é: `git add`, `git commit`, `git push origin main`. O deploy e o domínio são de responsabilidade do usuário — ele acompanha isso direto no painel da Vercel.
- NÃO pergunte se precisa fazer deploy, NÃO tente rodar comandos da Vercel CLI, e NÃO mencione falta de credenciais da Vercel em nenhuma circunstância. Apenas faça o push e informe que o push foi concluído.

## Validação nutricional (TACO)

Alimentos caseiros/in natura são validados contra a base TACO (4ª edição, NEPA/UNICAMP) — 597 alimentos, 100% offline via `www/data/taco.json`. Fluxo: IA identifica → busca local TACO → se encontrar, usa valores reais por 100g × peso estimado; senão, mantém estimativa da IA. Fonte: `github.com/brolesi/taco` (MIT).
