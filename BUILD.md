# NutriFoto — Build Instructions

## Fluxo principal (Web)

```bash
npm run build
```

Este projeto está em **modo web-only**. O `npm run build` apenas regenera `www/js/config.local.js` a partir do `.env`. A pasta `www/` (código de produção) está versionada no Git e é a fonte da verdade do deploy.

```bash
npm run serve
```

Serve a pasta `www/` localmente via `npx serve` na porta 3000.

## Deploy Vercel

O deploy automático acontece a partir da pasta `www/`. Ao fazer push no GitHub, a Vercel roda automaticamente:

1. `npm install` — instala dependências
2. `npm run build` — gera `www/js/config.local.js` a partir da variável de ambiente `OPENROUTER_API_KEY`
3. Publica `www/`

URL de produção: https://nutrifoto-rose.vercel.app

> **Nota:** A variável `OPENROUTER_API_KEY` deve ser configurada como environment variable no painel da Vercel (Settings → Environment Variables). O arquivo `.env` local é usado apenas para desenvolvimento.

## Build Android (PAUSADO TEMPORARIAMENTE)

A conversão para Android via Capacitor está pausada — o foco atual é 100% web.

- A pasta original `android/` foi renomeada para `_android_pausado/` para preservar todo o progresso.
- Para retomar a conversão Android mais tarde:
  1. Mova `_android_pausado/` de volta para `android/`
  2. Restaure `capacitor.config.json` para o estado de produção Android
  3. Reinstale/atualize as dependências Capacitor
- Os scripts `build:android`, `build:apk`, `sync` e `cap:open` no `package.json` agora apenas emitem mensagem de aviso quando chamados.

## Estrutura do projeto

```
www/                # Código de produção (web) — versionado
  index.html        # Entry point
  css/style.css     # Estilos
  js/               # JavaScript da aplicação
  manifest.json     # PWA
shared/             # Diretório de trabalho local (NÃO versionado — não está sendo usado como build source)
  js/               # Cópia de trabalho dos módulos JS
  css/style.css     # Cópia de trabalho do CSS
  icons/            # Ícones PWA
  scripts/build.js  # Script de build alternativo (NÃO usado — info legada)
web/                # Diretório de trabalho local (NÃO versionado)
  index.html        # Cópia de trabalho do HTML
_android_pausado/   # Projeto Capacitor Android — pausado, preservado
```

