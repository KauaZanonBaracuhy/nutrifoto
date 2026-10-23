---
version: alpha
name: NutriFoto
description: Diário alimentar móvel com anel calórico e acompanhamento em cartões.
colors:
  primary: "#38BDF8"
  background: "#0B1E3F"
  surface: "#122C57"
  text: "#E8F1FF"
  muted: "#9AB4D9"
typography:
  sans:
    fontFamily: "Space Grotesk, -apple-system, BlinkMacSystemFont, sans-serif"
rounded:
  DEFAULT: "18px"
spacing:
  page-max: "480px"
  card-gap: "12px"
components:
  button: {}
  card: {}
  dialog: {}
---

# NutriFoto Design System

## Overview

### Creative North Star
Preservar o diário móvel existente: anel calórico como referência do dia, cartões de água e peso e navegação inferior. Não introduzir uma nova marca na correção comercial.

### Product context and register
Adultos acompanhando hábitos, conteúdo pt-BR e registro de números em contexto cotidiano. Superfície de produto, sem alegações clínicas. A missão do proprietário e requisitos TXT são a autoridade. Mercado inicial em português; não há adaptação ao Japão.

### Token ownership/runtime mapping
Modelo B: `www/css/style.css` é a fonte dos tokens. Tema azul: colors.primary→--jade, background→--bg, surface→--surface, text→--text, muted→--text-muted. Demais nove temas preservam papéis e selecionam os valores no CSS. --font-sans é a fonte de tipografia; este documento espelha a decisão, não gera CSS. Revisão de identidade exige alterar documentação e CSS juntos.

## Colors
Azul é padrão. Temas gelo/minimalista cobrem superfícies claras; demais temas mantêm as cores existentes. Foco usa --jade; erro --coral; estados não dependem apenas de cor.

## Typography
Space Grotesk quando disponível com fallback de sistema; números de calorias têm maior ênfase. Campos, ajuda e status usam texto legível e português claro. Não inserir nomes de módulos na jornada do usuário.

## Layout
Coluna móvel com navegação inferior, main rolável, máximo 480 px em desktop conforme .app no CSS, cartões com intervalo 12 px. Cada HTML pertence a uma tela; navegação interna conserva estado. Permitir zoom, teclado e 320 px sem perda de ações. A documentação foi reconciliada com a largura já existente; esta missão não alterou a largura do produto.

## Elevation & Depth
Superfícies delimitadas por borda; modais sobre camada escura. Evitar ornamentação nova; correções funcionais têm precedência.

## Shapes
Cartões e diálogos arredondados; manter família de formas dos componentes existentes. Controles novos usam classes compartilhadas.

## Components
Ativação Android: usa os mesmos cartões `.diet-section`, controles nativos e botões compartilhados. Ofertas vêm da política do backend; valores locais são referência de build e nunca concedem licença. Uma coluna, estado/validade/franquia antes das ofertas, Pix pendente recuperável e código secreto acessível por disclosure. Web se identifica como demonstração; sem imitar vínculo ao Keystore.

Botões: primário para concluir, secundário para navegação, perigo para exclusão. Estado ocupado preserva geometria e impede repetição. Foco visível e texto de erro associado são obrigatórios. Lucide e Chart.js são empacotados localmente. Diálogos usam prepararDialogo, confirmações confirmarAcao. Formulários usam controles nativos e labels vinculados; select/time nativos são decisões explícitas para pt-BR/teclado/plataformas suportadas. Tutorial e menus têm botão semântico. Sem animação essencial; prefers-reduced-motion reduz movimento. Toast compartilha live region. Skeleton de tigela preservado para processamento, sem prometer etapas não realizadas.

### Refinamento de 22/10/2026 — perfil e consistência

Paleta, Space Grotesk, coluna de 480 px e navegação inferior preservadas. `Meu Plano` usa disclosures nativos para agrupar o perfil; apenas Dados pessoais começa aberto. A introdução tem 24 px/600 e os cartões mantêm a família de bordas existente. O rascunho mostra três cartões de nutrientes com valores reais do registro, sem barras artificiais de 100%.

Controles compartilhados: primário com mínimo de 46 px, secundário 44 px e ícones Lucide de 18 px; ações discretas são variações de `.btn-secondary.btn-discreto`. `--espaco-card`→16 px e `--rolagem-trilho`/`--rolagem-polegar`→tokens de superfície/texto muted, com scrollbar global e fallback de alto contraste. Origem dos tokens continua sendo style.css. Toast usa largura limitada de 400 px e borda de 14 px para mensagens legíveis, sem formato de pílula em textos longos.

O anel inicial mantém a assinatura visual, com 198 px e 180 px nas telas menores. Imagens de captura têm altura máxima de 300 px sem recorte; o aviso do resultado ocupa linha própria. Estado de teste/rascunho aparece junto dos dados. Ações indisponíveis explicam o motivo e não se apresentam como operações ativas.

| Regra | Divergência encontrada | Correção |
|---|---|---|
| Controles novos usam o padrão compartilhado | Conta acumulava ações duplicadas e recuperação fora de contexto | Assinatura centralizada na tela existente; senha nova só com link válido |
| Hierarquia móvel sem componentes desproporcionais | Formulário inteiro aberto; aviso comprimia o resultado | Seções recolhíveis e aviso em linha própria |
| Temas seguem papéis semânticos | Destaques verdes fixos nos controles de perfil | Seleção/foco usam os tokens do tema |

## Do's and Don'ts
- Preservar cores/classes e comparar telas irmãs antes de mudar componentes.
- Mostrar estimativa, fonte e revisão necessária junto do resultado.
- Não prometer segurança clínica ou precisão de balança.
- Não preencher progresso fictício ou ocultar erro de sincronização.
