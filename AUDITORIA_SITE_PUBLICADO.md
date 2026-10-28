# Auditoria funcional do NutriFoto publicado

Data: 24/10/2026, fuso America/Sao_Paulo. Domínio auditado: https://nutrifoto.kauazanonbaracuhy1.workers.dev/. Chrome 155.0.8059.86, controlado por Playwright real, em perfis isolados com dados fictícios. Viewports: 390 × 844 e 1440 × 1000. Ponytail Full aplicado.

## Resultado

**A publicação principal não está apta para comercialização. Ela entrega a interface 0.1.0, com credencial privada acessível, geração clínica sem bloqueio e sem as rotas/fluxos de compra da versão 0.3.2.** Isso não é homologação da prévia nem do APK. Não foram feitos deploy, correções, commit/push, mudanças de configuração, cobranças ou IA paga.

O catálogo tem **87 funcionalidades/estados**: inclui recursos acessíveis, requisitos ausentes e fluxos dependentes que não puderam ser alcançados. Uma linha equivale a um item; executar em dois viewports ou repetir um teste não aumenta a contagem. Não são 87 jornadas completas aprovadas.

| Estado | Quantidade |
|---|---:|
| FUNCIONANDO | 34 |
| FUNCIONANDO PARCIALMENTE | 5 |
| COM DEFEITO | 20 |
| BLOQUEADA CORRETAMENTE | 1 |
| BLOQUEADA INCORRETAMENTE | 1 |
| DEPENDÊNCIA EXTERNA | 3 |
| NÃO TESTADA | 23 |

São 20 itens com defeito e um bloqueio incorreto, além das limitações parciais e dependências. Há um bloqueio correto: análise sem imagem, cuja pré-condição é explicada. As 23 linhas NÃO TESTADA não contam como aprovação nem como defeito comprovado. Os 14 problemas abaixo agrupam causas/impactos; não devem ser somados às 87 linhas. Os dez primeiros são a prioridade de correção.

## Versão, arquitetura e alcance da evidência

- A interface real de Configurações informa **0.1.0**. O código local/branch de prévia é **0.3.2**. Não foi usado o hostname de prévia para aprovar o domínio principal.
- O histórico de deployments lido da Cloudflare manteve **100% do tráfego na versão 77f86072-3ba3-47b6-a821-33dc5c18e4c8**, criada em 05/09/2026. Uma versão de prévia enviada posteriormente não troca esse tráfego automaticamente. Nenhuma promoção foi executada nesta auditoria.
- A arquitetura efetivamente observada é frontend estático HTML/CSS/JS, app.js monolítico público, armazenamento local e chamadas diretas ao OpenRouter. O BFF esperado não está acessível nas rotas examinadas. Não se conclui que Supabase/Asaas estão fora do ar: a publicação não chega a esses serviços pelo backend esperado.
- Scripts externos carregados pelo HTML: unpkg.com/lucide@latest e cdn.jsdelivr.net/npm/chart.js@4; o documento também carrega js/config.example.js e js/app.js. Manifesto existe; SW/precache não.
- O app.js servido difere do origin/main local consultado, ainda identificado como versão 0.1.0 no package.json remoto. **Não foi determinado o SHA Git exato do asset produtivo.** Referências a funções/linhas abaixo são da resposta HTTP pública antiga, não da árvore local modular 0.3.2.
- Foram percorridas as quatro abas e a tela de captura, todos os formulários e controles acessíveis nelas. Resultados e plano gerado não foram fabricados para alcançar botões ocultos. A ausência de uma alternativa local para criar refeição impediu concluir as jornadas alimentares.
- Os dois arquivos exportados foram baixados de verdade e lidos em memória. Estavam vazios de refeições. Isso não valida exportação/importação de um banco preenchido.
- As falhas de transporte foram **induzidas deliberadamente no navegador**: modo offline e bloqueio preventivo dos endpoints pagos. Só comprovam o feedback de erro observado no aplicativo publicado. Não houve respostas simuladas de sucesso, fixtures nutricionais, licença inventada ou Pix fabricado.
- Arquivos de evidência contêm somente capturas de dados fictícios. Não foi salvo HAR, header Authorization, conteúdo de credencial ou payload clínico enviado. Não foram alterados dados de um navegador pessoal ou de outros usuários.

## Matriz individual

| Tela | Funcionalidade | Estado | Resultado observado | Motivo | Prioridade |
|---|---|---|---|---|---|
| Geral | F01 — Acesso HTTPS ao domínio principal | FUNCIONANDO | Página abriu no Chrome real; HTTP 200. | Teste no domínio principal, em contexto limpo. | — |
| Geral | F02 — Correspondência com a versão esperada | COM DEFEITO | Configurações informa 0.1.0; não é a versão 0.3.2 da branch de prévia. | Tráfego produtivo aponta para versão antiga do Worker. | P0 |
| Geral | F03 — Tutorial de primeiro acesso | COM DEFEITO | Primeiro acesso abriu diretamente o painel; tutorial e controle de reabertura não existem. | Ausência na interface antiga publicada. | P2 |
| Geral | F04 — Navegação pelas quatro abas | FUNCIONANDO | Início, Histórico, Meu Plano e Config. abriram; aba e tela ativa conferidas após transições. | Cliques reais, em móvel e desktop. | — |
| Geral | F05 — Navegação das abas por teclado | FUNCIONANDO | Enter na aba Histórico abriu screen-history.active. | Botões nativos respondem ao teclado. | — |
| Geral | F06 — Layout móvel 390 × 844 | FUNCIONANDO | Quatro telas sem overflow horizontal; controles medidos dentro de 390 px. | Capturas inspecionadas; não é aparelho físico. | — |
| Geral | F07 — Layout desktop 1440 × 1000 | FUNCIONANDO | Quatro telas sem overflow horizontal; layout centralizado e navegação alcançável. | Captura desktop inspecionada. | — |
| Geral | F08 — Alternar tema no cabeçalho | FUNCIONANDO | Clique mudou data-theme entre dark e light. | Mudança visual observada. | — |
| Configurações | F09 — Selecionar tema claro/escuro | FUNCIONANDO | Ambos os chips aplicaram o tema. | Interação por clique. | — |
| Configurações | F10 — Persistência do tema | FUNCIONANDO | Tema claro permaneceu após reload e reabertura da aba. | Mesmo armazenamento do contexto de teste. | — |
| Configurações / Plano | F11 — Chips por teclado | COM DEFEITO | Tab após Prazo saltou direto para Alergias; restrições não recebem foco. | Chips são span, tabindex -1 e sem role de controle. | P2 |
| Início | F12 — Expandir/recolher gráficos | FUNCIONANDO | Painel de gráficos apareceu e foi recolhido ao clicar. | Controle existente respondeu. | — |
| Início | F13 — Gráfico de calorias, histórico vazio | FUNCIONANDO | Canvas de 320 × 200 desenhado após expansão no móvel. | Somente conjunto vazio; não valida dados de refeições. | — |
| Início | F14 — Gráfico de proteína, histórico vazio | FUNCIONANDO | Segundo canvas de 320 × 200 desenhado após expansão. | Somente conjunto vazio. | — |
| Início | F15 — Resumo calórico/macros, diário vazio | FUNCIONANDO | Zero kcal/macros e meta manual 2100 kcal apareceram. | Não valida cálculo de uma refeição real. | — |
| Início | F16 — Indicador de sequência de dias | NÃO TESTADA | Exibe 7 dias mesmo em contexto vazio; significado/cálculo não foi demonstrado. | Não foram inventados sete dias de registros para validar a sequência. | P2 |
| Captura | F17 — Abrir Nova refeição | FUNCIONANDO | Botão + abriu foto, galeria, câmera e análise. | Fluxo real acessível. | — |
| Captura | F18 — Cancelar e voltar ao diário | FUNCIONANDO | X fechou captura e permitiu iniciar outra refeição. | Várias aberturas e cancelamentos exercitados. | — |
| Captura | F19 — Entrada de alimento por texto | COM DEFEITO | Não há modo textual na tela Nova refeição. | Recurso não existe nesta versão publicada. | P0 |
| Captura | F20 — Busca local TACO | COM DEFEITO | Sem campo/controle TACO; js/tacoSearch.js e data/taco.json retornam 404. | Assets/recurso da versão atual não foram publicados no principal. | P0 |
| Captura | F21 — Selecionar imagem da galeria | FUNCIONANDO | Seletor abriu; PNG fictício virou imagem de prévia e habilitou Analisar. | Arquivo válido selecionado por Playwright; nenhum envio ao provedor. | — |
| Captura | F22 — Abrir seletor de câmera na Web | FUNCIONANDO | Clique abriu file chooser com capture=environment. | Fallback Web observado; não é captura física. | — |
| Captura | F23 — Fotografia com câmera física | NÃO TESTADA | Não foi capturada foto física. | Navegador de teste usa seletor de arquivos; sem câmera/dispositivo homologado. | — |
| Captura | F24 — Permissão de câmera negada no sistema | NÃO TESTADA | Não houve prompt real de câmera para negar. | Fallback file input não valida permissão de hardware. | — |
| Captura | F25 — Analisar sem selecionar imagem | BLOQUEADA CORRETAMENTE | Botão desabilitado, com instrução Tire uma foto ou escolha da galeria. | Pré-condição válida e indicada na tela. | — |
| Captura | F26 — Arquivo corrompido e explicação do bloqueio | BLOQUEADA INCORRETAMENTE | JPEG inválido não gerou aviso; Analisar permaneceu desabilitado. | downscaleImage aguarda onload e não trata onerror. | P1 |
| Captura | F27 — Análise fotográfica concluída por IA | NÃO TESTADA | Nenhuma análise paga foi executada. | Autorização de gasto ausente; chamadas externas foram impedidas. | P0 |
| Captura | F28 — Análise textual por IA | COM DEFEITO | Não há controle textual acessível. | Ausência na interface publicada; nenhuma geração feita. | P0 |
| Captura / Plano | F29 — Feedback quando a rede da IA falha | FUNCIONANDO | Mostrou Sem internet ou API inacessível e restaurou a ação. | Falha de rede induzida no navegador; não é teste de sucesso do provedor. | — |
| Resultados | F30 — Editar nomes/alimentos reconhecidos | NÃO TESTADA | Tela de resultados não foi alcançada. | Depende de análise concluída; sem mocks ou chamada paga. | P1 |
| Resultados | F31 — Editar porções | NÃO TESTADA | Não houve alimento reconhecido disponível para edição. | Mesmo bloqueio de acesso à tela de resultados. | P1 |
| Resultados | F32 — Recalcular calorias/macronutrientes | NÃO TESTADA | Não houve resultado alimentar real para comparar. | Nenhuma estimativa fictícia foi inserida para aprovar cálculos. | P1 |
| Resultados | F33 — Salvar refeição | NÃO TESTADA | Não foi possível chegar ao botão com resultado válido. | Criação depende de IA; não existe alternativa manual/TACO publicada. | P0 |
| Diário | F34 — Editar refeição salva | NÃO TESTADA | Diário de teste permaneceu vazio. | Nenhuma refeição criada por um fluxo permitido. | P1 |
| Diário | F35 — Excluir refeição salva | NÃO TESTADA | Sem refeição fictícia salva para excluir pela interface. | Não houve inserção direta no banco/localStorage. | P1 |
| Diário | F36 — Persistência de refeições após reload | NÃO TESTADA | Não há refeição criada para verificar. | Não usar persistência de perfil como prova de persistência alimentar. | P1 |
| Histórico | F37 — Abrir histórico vazio | FUNCIONANDO | Tela abriu sem erro e sem registros. | Caso vazio observado; não aprova histórico populado. | — |
| Histórico | F38 — Dias anteriores e resumos com dados | NÃO TESTADA | Sem refeições de outros dias no contexto isolado. | Não foram fabricados dados antigos. | P1 |
| Acompanhamento | F39 — Registro de água | COM DEFEITO | Sem controle de água em qualquer tela publicada. | Recurso ausente na versão 0.1.0 entregue. | P1 |
| Acompanhamento | F40 — Peso atual no perfil | FUNCIONANDO | Peso 70 kg foi salvo e reapareceu após recarregar. | É atributo do perfil, não pesagem histórica. | — |
| Acompanhamento | F41 — Histórico/gráfico de peso | COM DEFEITO | Não há tela ou formulário de pesagens datadas. | Peso do perfil não substitui acompanhamento temporal. | P1 |
| Configurações | F42 — Salvar meta calórica manual | FUNCIONANDO | 2100 kcal persistiu e foi exibido no painel. | Valor positivo fictício. | — |
| Configurações | F43 — Salvar metas de macros manuais | FUNCIONANDO | 120 g de proteína, 250 g de carboidrato e 70 g de gordura foram salvos. | Preferências locais, sem prescrição clínica. | — |
| Configurações | F44 — Validar metas inválidas | COM DEFEITO | -10 kcal e -5 g foram salvos, com mensagem de sucesso, e persistiram; zero também foi aceito. | Conversão Number sem rejeição de negativos; atributos HTML não foram validados pelo handler. | P1 |
| Configurações | F45 — Salvar dados pessoais | FUNCIONANDO | Idade, sexo, peso e altura persistiram e preencheram Meu Plano. | Dados fictícios no armazenamento local do teste. | — |
| Configurações | F46 — Atividade e objetivo | FUNCIONANDO | Moderado e Manter peso foram selecionados, salvos e recuperados. | Controles select funcionaram. | — |
| Configurações | F47 — Restrições alimentares | FUNCIONANDO | Vegetariano, sem lactose e vegano foram selecionados; escolha persistiu. | Interação por clique; teclado reprovado separadamente. | — |
| Configurações | F48 — Remover restrições usando Nenhuma | FUNCIONANDO | Nenhuma limpou as restrições; após reload não havia restrição ativa. | Ausência de restrições confirmada. | — |
| Configurações | F49 — Alergias e alimentos evitados | FUNCIONANDO | Amendoim e berinjela persistiram e preencheram o formulário de plano. | Não valida segurança nutricional de uma geração. | — |
| Configurações | F50 — Lembrete de refeição | FUNCIONANDO PARCIALMENTE | Toggle e horário persistem; aviso diz que lembretes serão ativados em versão futura. | Preferência é salva, entrega de notificação não está implementada/homologada. | P2 |
| Configurações | F51 — Lembrete de sequência | FUNCIONANDO PARCIALMENTE | Toggle e horário persistem; mesma indicação de versão futura. | Nenhum lembrete real foi entregue. | P2 |
| Configurações | F52 — Feedback e cliques repetidos em Salvar | FUNCIONANDO | Três cliques mostraram Configurações salvas, sem exceção JavaScript. | Somente ação local segura; não é ensaio de carga. | — |
| Configurações | F53 — Exportar JSON com diário vazio | FUNCIONANDO | Download real de 61 bytes, JSON válido com exportedAt e meals. | Escopo aprovado é exportação vazia. | — |
| Configurações | F54 — Exportar CSV com diário vazio | FUNCIONANDO | Download real com cabeçalhos de data, alimentos e nutrientes. | Não aprova escaping/conteúdo de refeições preenchidas. | — |
| Configurações | F55 — Exportação com refeições/imagens | NÃO TESTADA | Não houve refeição salva para exportar. | Sem alimentação artificial do banco. | P1 |
| Configurações | F56 — Backup completo do usuário | FUNCIONANDO PARCIALMENTE | Exportação disponível contém apenas histórico de refeições; não inclui perfil ou metas. | Objeto JSON baixado tem apenas exportedAt e meals. | P1 |
| Configurações | F57 — Importar backup e recuperar dados | COM DEFEITO | Não existe controle de importação/restauração. | Baixar arquivo não permite restaurá-lo neste produto publicado. | P1 |
| Configurações | F58 — Link de suporte | FUNCIONANDO PARCIALMENTE | Link abriu nutrifoto.netlify.app, outra cópia do diário, sem canal de atendimento. | Destino não fornece o atendimento anunciado. | P2 |
| Meu Plano | F59 — Abrir formulário e editar perfil | FUNCIONANDO | Tela e botão Editar perfil responderam. | Não é aprovação de geração clínica. | — |
| Meu Plano | F60 — Guardar perfil ao tentar gerar | FUNCIONANDO | Preferências, prazo, peso desejado, rotina e condições reapareceram após falha e reload. | saveUserProfile ocorre antes da chamada; falha foi induzida, não houve análise paga. | — |
| Meu Plano | F61 — Salvar rascunho sem tentar IA | FUNCIONANDO PARCIALMENTE | Alterar favoritos e sair/voltar restaurou o valor anterior; não existe Salvar perfil nesta tela. | Persistência do formulário está acoplada a Gerar meu plano. | P2 |
| Meu Plano | F62 — Rotina, refeições/dia, prazo e preferências | FUNCIONANDO | 4 refeições, prazo 3 meses, peso 68, rotina e horários 06:45/22:45 persistiram após tentativa bloqueada. | Somente formulário; conteúdo não foi enviado ao provedor. | — |
| Meu Plano | F63 — Campos obrigatórios vazios | FUNCIONANDO | Idade vazia mostrou Preencha idade, peso e altura, sem tentativa externa. | Validação mínima existente. | — |
| Meu Plano | F64 — Idade negativa | COM DEFEITO | -1 passou pela validação, provocou tentativa de IA e foi recuperado nas configurações. | Handler testa apenas valores falsy; não verifica min/max. | P1 |
| Meu Plano | F65 — Bloqueio de perfil gestante/clínico | COM DEFEITO | Perfil Gestante provocou POST ao OpenRouter, impedido pelo auditor antes do envio. | Não há barreira clínica no fluxo antigo; apenas texto de advertência. | P0 |
| Meu Plano | F66 — Geração concluída de plano | NÃO TESTADA | Não houve geração nem plano retornado. | IA paga não autorizada; não foram fornecidas respostas simuladas. | P0 |
| Meu Plano | F67 — Consultar plano existente | NÃO TESTADA | Contexto limpo não tem plano salvo; nenhum foi fabricado. | Não acessível sem geração ou restauração válida. | P1 |
| Meu Plano | F68 — Substituir alimentos de plano | NÃO TESTADA | Sem plano elegível na interface. | Não foi executada substituição sobre fixtures. | P1 |
| Meu Plano | F69 — Aplicar metas de plano | NÃO TESTADA | Não houve plano acessível para acionar Aplicar às metas. | Proteção clínica não pode ser declarada aprovada; fonte antiga contém ação sem a homologação atual. | P0 |
| Ativação | F70 — Visualizar planos de R$ 24,90/R$ 34,90 | COM DEFEITO | Não há tela de ativação ou tabela de ofertas; /api/licenca retorna 404. | Publicação antiga, não uma restrição segura de demonstração explicada ao cliente. | P0 |
| Ativação | F71 — Escolher plano e solicitar Pix | COM DEFEITO | Nenhum seletor de plano ou botão Pagar com Pix está publicado. | Ausência do fluxo de compra. | P0 |
| Pagamento | F72 — QR Code e Pix Copia e Cola | DEPENDÊNCIA EXTERNA | Não existe caminho de cobrança no domínio principal para obter um Pix. | Necessita backend publicado e integração Asaas sandbox; credenciais do provedor não foram validadas. | P0 |
| Pagamento | F73 — Confirmação do pagamento no servidor | DEPENDÊNCIA EXTERNA | /api/asaas-webhook retorna 404; nenhuma cobrança criada. | Backend e sandbox operacional necessários; nenhum comprovante/ativação foi simulado. | P0 |
| Ativação | F74 — Atualizar/consultar ativação | COM DEFEITO | Não há botão nem endpoint de licença funcional. | Não é possível consultar estado no produto publicado. | P0 |
| Ativação | F75 — Recuperar compra | COM DEFEITO | Não há controle ou instrução de recuperação. | Fluxo não publicado. | P0 |
| Ativação | F76 — Transferir licença pelo fluxo autorizado | NÃO TESTADA | Sem fluxo de recuperação/transferência publicado nem dispositivo Android nesta missão. | Não foi fingido vínculo criptográfico por navegador. | P0 |
| Ativação | F77 — Mostrar dias restantes | NÃO TESTADA | Nenhuma licença real foi consultada. | Não há estado confiável de licença para conferir. | P0 |
| Ativação | F78 — Vencimento e preservação do diário | NÃO TESTADA | Sem licença ativa/vencida ou refeição criada para comparar. | Nenhum relógio, licença ou resposta foi simulado. | P0 |
| Ativação | F79 — Limite diário e orçamento de IA | NÃO TESTADA | Não foi consumida franquia nem efetuada chamada paga. | Ausência de API no principal e caminho direto ao provedor são riscos comprovados; não equivalem a ensaio de limite. | P0 |
| Operação | F80 — APIs HTTPS do backend esperado | COM DEFEITO | GET /api/versao, saude, conta, dados e ia retornou 404. | A versão produtiva não entrega as rotas do BFF esperado. | P0 |
| Operação | F81 — Sincronização remota de dados | DEPENDÊNCIA EXTERNA | Nenhum caminho de sincronização acessível; /api/dados retorna 404. | Requer backend/persistência hospedados; Supabase cloud não foi homologado nesta missão. | P1 |
| Operação | F82 — Reabertura offline/PWA | COM DEFEITO | Sem registro de service worker ou cache; reload offline falhou com ERR_INTERNET_DISCONNECTED. | /sw.js e /precache.json retornam 404. Manifesto sozinho não oferece funcionamento offline. | P1 |
| Operação | F83 — Instalação PWA em aparelho | NÃO TESTADA | manifest.json existe, mas instalação em aparelho não foi executada. | Sem SW e sem dispositivo; não é homologação de PWA instalada. | P2 |
| Segurança | F84 — Segredos nos assets públicos | COM DEFEITO | GET /js/config.example.js retornou 200 e padrão de chave privada OpenRouter foi confirmado em memória. | Credencial antiga continua distribuída. Valor não foi copiado nem usado. | P0 |
| Segurança | F85 — Caminho público /.env | FUNCIONANDO | GET /.env retornou 404. | Somente este caminho foi verificado; não é aprovação geral de ausência de segredos. | — |
| Segurança | F86 — IA através de backend com autorização | COM DEFEITO | Clique de geração tenta POST direto a openrouter.ai/api/v1/chat/completions. | Código público usa Bearer no cliente; não passa por /api/ia. | P0 |
| Segurança | F87 — Respostas 401/402/429/5xx do provedor | NÃO TESTADA | Não foram provocadas respostas de um serviço pago. | Sem chamada paga e sem fixtures de sucesso/erro HTTP; somente falha de transporte foi induzida. | — |

## Problemas encontrados e recomendações

### P0-01 — Credencial privada OpenRouter publicada

**Como reproduzir:** Abrir anonimamente /js/config.example.js no domínio principal.

**Esperado:** Nenhuma credencial privada deve chegar ao navegador.

**Real:** HTTP 200; foi confirmado em memória um padrão de chave privada OpenRouter. O valor não foi registrado, validado no provedor nem usado.

**Causa e módulo:** Comprovada: asset legado de configuração distribuído publicamente. Módulo: www/js/config.example.js da versão publicada.

**Evidência:** GET público 200 e verificação booleana de padrão; não há captura do valor. A validade/revogação da chave é desconhecida.

**Solução recomendada:** O proprietário deve revogar a credencial exposta e confirmar a revogação. Em missão autorizada, remover a credencial dos assets e manter uma chave nova somente em segredo do backend; preservar a investigação do histórico sem republicar o valor.

### P0-02 — Domínio principal entrega release antigo e APIs ausentes

**Como reproduzir:** Abrir Config. → Sobre o app; consultar /api/versao, /api/saude, /api/licenca, /api/conta, /api/dados e /api/ia.

**Esperado:** Domínio principal correspondente à versão comercial pretendida, com rotas de backend operacionais e mensagens de configuração ausente quando aplicável.

**Real:** Interface 0.1.0; todas essas rotas retornam 404. /js/licenca.js, /telas/ativacao.html e assets TACO também retornam 404.

**Causa e módulo:** Comprovada para o destino de tráfego: wrangler deployments list continua apontando 100% para 77f86072-3ba3-47b6-a821-33dc5c18e4c8, de 05/09/2026. A branch de prévia 0.3.2 não equivale à publicação do principal. Não é evidência de um service worker antigo: contexto limpo e nenhum SW registrado.

**Evidência:** Interface real; [início móvel](evidencias/auditoria-site-publicado/01-inicio-mobile.png); respostas HTTP descritas na seção de evidências. O app.js público não coincide com origin/main local consultado; o SHA Git exato do asset não foi determinado.

**Solução recomendada:** Revisar e autorizar uma promoção explícita da versão correta; após a publicação, repetir esta matriz no domínio principal. Não basta renomear versão ou apontar o usuário à prévia.

### P0-03 — IA chamada diretamente do navegador, sem autorização pelo BFF

**Como reproduzir:** Preencher o perfil obrigatório e clicar Gerar meu plano; acompanhar a intenção de requisição, mantendo o bloqueio de saída do auditor.

**Esperado:** Operação paga autorizada por backend: licença, dispositivo, prazo, quota, orçamento e idempotência antes do provedor.

**Real:** Cliente tenta POST direto a openrouter.ai/api/v1/chat/completions; /api/ia não participa. Nenhuma dessas tentativas foi enviada ao provedor.

**Causa e módulo:** Comprovada: dietPlan.js público usa fetch(OPENROUTER_ENDPOINT) e Authorization Bearer no cliente. visionApi.js publicado usa a mesma arquitetura. Isso não demonstra qualquer franquia diária da aplicação; eventuais limites do próprio provedor não foram testados.

**Evidência:** Request interceptado antes da rede; dietPlan.js público, linha 146; visionApi.js público, linhas 106/190. Headers e conteúdo dos pedidos não foram registrados.

**Solução recomendada:** Publicar o backend seguro existente e retirar o caminho direto do cliente. Homologar controles no servidor sem testar gasto real nesta missão.

### P0-04 — Ausência de bloqueio para perfil gestante/clínico

**Como reproduzir:** Meu Plano: idade 30, peso 70, altura 170, sexo feminino; informar Gestante em Condições de saúde e clicar Gerar meu plano.

**Esperado:** Explicação de não homologação e nenhuma chamada de geração.

**Real:** Formulário entra no fluxo de geração e tenta chamar o provedor. A mensagem final foi apenas Sem internet ou API inacessível, porque o auditor abortou a saída.

**Causa e módulo:** Comprovada: handleGeneratePlan do app.js público, linha 937, verifica somente presença de idade/peso/altura; advertência textual não impede geração clínica.

**Evidência:** [Perfil gestante e falha de transporte](evidencias/auditoria-site-publicado/03-gestante-sem-bloqueio-clinico.png); intenção POST interceptada. Não houve plano retornado.

**Solução recomendada:** Reaplicar os bloqueios clínicos no cliente e obrigatoriamente no backend, com mensagem específica. Não liberar planos clínicos por conveniência de teste.

### P0-05 — Compra e ativação não existem no produto publicado

**Como reproduzir:** Percorrer as quatro abas e Nova refeição; procurar ofertas, Pagar com Pix, Atualizar ativação e recuperação; consultar /api/licenca e /api/asaas-webhook.

**Esperado:** Ofertas definidas, compra sandbox quando configurada, estado da licença e caminho de recuperação; Web deve explicar sua limitação de vínculo seguro.

**Real:** Sem ofertas de R$ 24,90/R$ 34,90, botão de compra ou estados de ativação. Ambos os endpoints retornam 404. Não foi criado QR Code nem cobrança.

**Causa e módulo:** Comprovada: fluxo de licenças/pagamento não está presente nos assets e rotas da publicação antiga. Não há evidência para atribuir isso exclusivamente a uma chave Asaas ausente.

**Evidência:** Inventário real das quatro telas e GETs 404. Nenhuma chamada autenticada Asaas foi realizada.

**Solução recomendada:** Disponibilizar a implementação atual no destino autorizado e configurar/homologar Asaas sandbox no servidor. Recuperação, confirmação, reversões e transferência exigem ensaio real próprio.

### P0-06 — Diário não oferece alternativa manual/textual ou TACO

**Como reproduzir:** Início → +; examinar todos os controles de Nova refeição.

**Esperado:** Registrar/consultar alimentos pelos caminhos locais previstos, sem obrigar consumo pago de IA.

**Real:** Somente Câmera, Galeria e Analisar. Não há entrada textual, busca TACO ou criação manual acessível. Sem IA concluída não se alcança o salvamento de uma refeição.

**Causa e módulo:** Comprovada para a interface: versão antiga da captura. /js/tacoSearch.js e /data/taco.json retornam 404.

**Evidência:** [Tela de captura real](evidencias/auditoria-site-publicado/06-imagem-invalida.png), sem os controles; não foi injetada refeição para contornar o fluxo.

**Solução recomendada:** Publicar os recursos locais já existentes na versão correta e repetir criação, edição, cálculo, salvamento, histórico e exclusão sem IA paga.

### P1-07 — Valores inválidos são salvos e utilizados

**Como reproduzir:** Config.: salvar -10 kcal e -5 g de proteína, recarregar; Meu Plano: informar idade -1 com peso/altura preenchidos e tentar gerar.

**Esperado:** Recusa com explicação; não persistir perfil inválido nem iniciar geração.

**Real:** Metas negativas geram Configurações salvas e persistem. Idade -1 passa, é salva no perfil e chega à intenção de chamada IA, abortada pelo auditor. Zero também foi aceito nas metas; sua política deve ser definida separadamente.

**Causa e módulo:** Comprovada: handler de configurações converte Number sem validação de domínio; handleGeneratePlan testa falsy, não min/max. Atributos min/max não substituem validação no handler.

**Evidência:** [Metas negativas](evidencias/auditoria-site-publicado/04-metas-negativas-salvas.png); [idade inválida persistida](evidencias/auditoria-site-publicado/11-idade-invalida-persistida.png); valores recuperados após reload.

**Solução recomendada:** Validar limites e consistência nas entradas e no servidor, preservar o valor anterior quando inválido e exibir mensagem específica.

### P1-08 — Exportação não oferece recuperação completa

**Como reproduzir:** Config. → Exportar JSON; inspecionar o arquivo baixado e procurar Importar/Restaurar.

**Esperado:** Backup recuperável do escopo prometido, com caminho de importação e validação.

**Real:** Download vazio válido de 61 bytes contém exportedAt e meals; não inclui perfil/metas. Não há controle de importação/restauração. CSV vazio contém apenas cabeçalho.

**Causa e módulo:** Comprovada: exportMealsJSON no app.js público, linha 585, exporta histórico; interface não implementa importação. Refeições/imagens em backup não foram testadas porque nenhum registro foi criado.

**Evidência:** Downloads reais via evento download do Playwright, leitura do conteúdo em memória; inventário de controles de Configurações.

**Solução recomendada:** Definir claramente exportação de histórico versus backup completo e publicar/restaurar o fluxo seguro existente. Testar round-trip com dados fictícios criados pela interface.

### P1-09 — Imagem corrompida deixa ação bloqueada sem motivo

**Como reproduzir:** Nova refeição → Galeria → selecionar arquivo com extensão JPG e conteúdo inválido.

**Esperado:** Mensagem de imagem inválida e orientação para escolher outro arquivo.

**Real:** Sem prévia e sem aviso; Analisar continua cinza/desabilitado. Cancelar permite sair da tela, mas o motivo da falha não é comunicado.

**Causa e módulo:** Comprovada: downscaleImage do camera.js público, linha 75, cria Promise que resolve em img.onload e não trata img.onerror; handleImage aguarda indefinidamente.

**Evidência:** [Tela sem explicação após JPG inválido](evidencias/auditoria-site-publicado/06-imagem-invalida.png). Ausência de aviso aguardada por 2 s, coerente com ausência de rejeição no decodificador.

**Solução recomendada:** Rejeitar falhas de decodificação/leitura, validar arquivo e restaurar controles com explicação específica; testar novamente pelo seletor real.

### P1-10 — Reabrir o aplicativo offline falha

**Como reproduzir:** Carregar o principal online em contexto novo, conferir registros SW/cache, colocar o contexto offline e recarregar.

**Esperado:** Shell/diário local acessíveis offline, com serviços remotos explicados como indisponíveis.

**Real:** Zero service workers, Cache Storage vazio e reload falha com net::ERR_INTERNET_DISCONNECTED. /sw.js e /precache.json retornam 404.

**Causa e módulo:** Comprovada: publicação não inclui a infraestrutura offline. manifest.json 200 sozinho não a fornece. Este teste usou contexto sem interceptação de requests para não desativar artificialmente o cache HTTP.

**Evidência:** [Reabertura offline](evidencias/auditoria-site-publicado/10-offline.png); introspecção da API serviceWorker/caches e erro real do navegador após offline deliberado.

**Solução recomendada:** Publicar o SW/precache corretos e validar atualização, reabertura e preservação de registros no próprio domínio principal.

### P2-11 — Edição do formulário de plano se perde sem geração

**Como reproduzir:** Meu Plano: alterar favoritos, mudar para Config. e voltar sem clicar Gerar.

**Esperado:** Caminho claro de salvar perfil/rascunho ou aviso antes de abandonar alterações.

**Real:** O valor anterior reaparece. Não há botão independente de salvar o perfil nessa tela. As Configurações, por outro lado, salvam corretamente.

**Causa e módulo:** Comprovada: getUserProfile é usado ao remontar formulário e saveUserProfile só é chamado em handleGeneratePlan. É limitação do formulário, não perda do perfil já salvo.

**Evidência:** Arroz e feijão → PREFERENCIA_FICTICIA_SEM_GERAR → sair/voltar → Arroz e feijão.

**Solução recomendada:** Desacoplar o salvamento local da tentativa de IA, preservando os controles e mensagens existentes na versão atual.

### P2-12 — Restrições e temas não são acionáveis pelo teclado

**Como reproduzir:** Meu Plano: focar Prazo e pressionar Tab; tentar alcançar as restrições.

**Esperado:** Foco visível e seleção por teclado em todos os controles.

**Real:** Foco salta para Alergias; chips são span sem role e com tabIndex -1. Cliques funcionam e a navegação principal por Enter funciona.

**Causa e módulo:** Comprovada no DOM de restrições; chips de tema usam a mesma marcação span/diet-chip.

**Evidência:** document.activeElement.id após Tab = dp-alergias; inspeção DOM dos chips, sem evento/foco de controle nativo.

**Solução recomendada:** Usar controles nativos ou semântica/foco/teclas equivalentes, sem alterar a identidade visual.

### P2-13 — Suporte aponta para outra cópia do aplicativo

**Como reproduzir:** Config. → Suporte → nutrifoto.netlify.app.

**Esperado:** Canal de suporte/contato identificável.

**Real:** Abre outra página NutriFoto com painel vazio, em outro domínio; não é uma central de atendimento.

**Causa e módulo:** Comprovada: href do link e destino aberto em popup real. Nenhum dado do contexto Cloudflare foi exportado para esse domínio pelo auditor.

**Evidência:** Popup abriu https://nutrifoto.netlify.app/, título NutriFoto, painel com 0 / 2200 kcal.

**Solução recomendada:** Configurar um contato/canal real e informar que os dados são locais por origem; evitar direcionar o cliente para uma cópia que parece perder seus registros.

### P2-14 — Primeiro acesso sem o tutorial esperado

**Como reproduzir:** Abrir o domínio principal em contexto de navegador novo.

**Esperado:** Tutorial/onboarding previsto e forma de reabri-lo.

**Real:** Abre diretamente no painel; não há tela ou ação de tutorial em Configurações.

**Causa e módulo:** Comprovada pela interface antiga publicada; não indica falha de evento do tutorial da versão 0.3.2, que não foi entregue neste domínio.

**Evidência:** Captura do primeiro acesso e inventário de todas as abas.

**Solução recomendada:** Verificar onboarding no release correto e repetir primeiro acesso sem apagar dados reais de clientes.

## Evidência HTTP e navegador

GETs feitos anonimamente no domínio principal, sem autenticação ou tentativas de exploração:

| Caminho | Status observado | Interpretação limitada |
|---|---:|---|
| / | 200 | HTML do aplicativo antigo abriu. |
| /js/config.example.js | 200 | Padrão de credencial privada confirmado; valor omitido. |
| /api/versao | 404 | Não existe confirmação de versão por API no principal. |
| /api/saude | 404 | Rota de saúde esperada ausente. |
| /api/licenca | 404 | Rota de licença esperada ausente. |
| /api/conta | 404 | Rota de conta esperada ausente. |
| /api/ia | 404 | Rota de IA do BFF esperada ausente. |
| /api/dados | 404 | Rota de dados esperada ausente. |
| /api/asaas-webhook | 404 | Rota esperada ausente; não comprova o estado de uma conta Asaas. |
| /telas/ativacao.html | 404 | Fragmento de ativação da versão atual ausente. |
| /js/licenca.js | 404 | Módulo de licença ausente. |
| /js/tacoSearch.js | 404 | Módulo TACO ausente. |
| /data/taco.json | 404 | Base TACO ausente. |
| /sw.js | 404 | Service worker ausente. |
| /precache.json | 404 | Precache ausente. |
| /manifest.json | 200 | Metadados existem; não certificam instalação/offline. |
| /.env | 404 | Este caminho específico não expõe um arquivo .env. |

O erro de console observado ao clicar IA foi **net::ERR_BLOCKED_BY_CLIENT.Inspector**, decorrente da proteção de saída instalada pelo auditor, acompanhado do aviso Sem internet ou API inacessível. Não foi tratado como falha real do OpenRouter. Nenhuma exceção pageerror foi capturada nos fluxos exercitados; isso não exclui defeitos de lógica ou Promises que não terminam, como a imagem corrompida.

A tentativa clínica teve host openrouter.ai, caminho /api/v1/chat/completions e método POST; foi abortada antes da rede. Validade da credencial, saldo, resposta do modelo, quotas do provedor, respostas HTTP 401/402/429/5xx e custo efetivo não foram testados.

Em contexto offline separado, sem interceptação de requests, havia 0 registros serviceWorker e nenhuma chave Cache Storage; reload gerou net::ERR_INTERNET_DISCONNECTED. Essa falha não foi inferida apenas da ausência de arquivos.

As capturas de layout foram inspecionadas. As telas assentadas não apresentaram descompasso persistente entre aba e conteúdo; quadros transitórios durante animações não foram classificados como defeito. Os gráficos ganharam dimensões após a expansão; a leitura instantânea durante a animação não foi tratada como falha de gráfico. Os timeouts curtos iniciais de automação foram reavaliados após carregar a página e não viraram defeitos do aplicativo.

### Capturas

- [Primeiro acesso móvel](evidencias/auditoria-site-publicado/01-inicio-mobile.png).
- [Falha de transporte em análise](evidencias/auditoria-site-publicado/02-analise-sem-rede.png).
- [Perfil gestante sem barreira clínica](evidencias/auditoria-site-publicado/03-gestante-sem-bloqueio-clinico.png).
- [Metas negativas salvas](evidencias/auditoria-site-publicado/04-metas-negativas-salvas.png).
- [Gráficos expandidos](evidencias/auditoria-site-publicado/05-graficos-mobile.png).
- [Arquivo inválido sem explicação](evidencias/auditoria-site-publicado/06-imagem-invalida.png).
- [Layout desktop](evidencias/auditoria-site-publicado/07-desktop.png).
- [Layout móvel claro](evidencias/auditoria-site-publicado/08-mobile-claro.png).
- [Navegação conferida](evidencias/auditoria-site-publicado/09-navegacao-conferida.png).
- [Reabertura offline](evidencias/auditoria-site-publicado/10-offline.png).
- [Idade inválida persistida](evidencias/auditoria-site-publicado/11-idade-invalida-persistida.png).

## Dependências para funcionamento comercial

1. **Publicação autorizada do release correto e backend seguro no principal.** O tráfego atual não usa a implementação mais recente. Primeiro remover a exposição de credencial e verificar rotas/versão nesse mesmo domínio. Não declarar o principal corrigido porque o build de uma branch está Ready.
2. **Persistência de servidor para licença, idempotência, quota e orçamento**, usando a infraestrutura existente. Supabase cloud, migrações, credenciais do servidor, autorização e isolamento não foram comprovados no principal. Não foi acrescentado outro serviço.
3. **Asaas sandbox operacional**, com segredo somente no servidor, webhook validado e consulta confiável. A existência/validade das credenciais Asaas não foi inspecionada; nenhum pagamento foi criado. Não atribuir o 404 exclusivamente a uma credencial ausente.
4. **OpenRouter privado e orçamento financeiro conservador no backend.** Confirmar revogação da chave pública; eventual chave nova e preços/tetos ficam no servidor. Não validar a chave exposta fazendo uma geração. Novas chamadas pagas exigem autorização.
5. **Android/Keystore/atestado e recuperação autorizada** para comprovar a regra de um dispositivo por licença. Um navegador não substitui esse vínculo. Nenhum APK/dispositivo foi testado nesta missão.
6. **Bloqueios clínicos e canal de suporte efetivos.** Nenhum plano clínico foi homologado por esta auditoria. O link atual de suporte não é atendimento. Lembretes são anunciados como futuros, não como notificações aprovadas.
7. **Entrega dos recursos locais esperados e recuperação de dados:** TACO/texto, acompanhamento, backup/importação e PWA precisam chegar ao domínio real e ser reavaliados com registros fictícios criados pela interface.

## Limites e preservação

Não se concluiu pagamento sandbox, licença ativa/vencida, transferência, consumo diário, resposta real de IA, cálculo sobre alimentos reconhecidos, criação/edição/exclusão de refeições, restauração de banco preenchido ou captura física. Não foi possível transformar essas dependências em jornadas completas sem ultrapassar as autorizações recebidas. Nenhuma delas foi aprovada por código, teste local, fixture ou resultado antigo.

Somente este relatório Markdown e as capturas necessárias foram criados nesta missão. Código do aplicativo, configurações, produção, histórico Git, banco de usuários e controle financeiro anterior foram preservados. Não há correções incluídas. A prioridade imediata é a exposição de credencial, seguida da publicação controlada e repetição dos fluxos centrais no principal.
