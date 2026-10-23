# Implementação comercial — 22/10/2026

Versão 0.2.0. Fonte ativa: `www/`, `servidor/`, `api/`, `supabase/`, `scripts/`, `testes/`. Trabalho local, sem commit, push, deploy, Stripe live ou geração paga adicional. A preparação e a baseline foram concluídas antes desta implementação; os seis relatórios anteriores permanecem como histórico. Resultado comercial e pendências em `RELATORIO_DEFINITIVO_PARA_CHATGPT.md`.

## Escopo entregue: 26 capacidades novas ou ampliadas

| ID | Entrega nesta missão | Implementação principal |
|---|---|---|
| F01 | Confirmação de cadastro via TokenHash, sessão segura e fragmento removido | aplicacao.js, conta.js |
| F02 | Templates profissionais de confirmação e recuperação e caixa local real | supabase/templates, harness Supabase |
| F03 | Benefícios e quotas grátis/pago centralizados e verificados no servidor | comercial.js, aplicacao.js, imagens.js |
| F04 | Períodos mensal/anual com Price IDs do servidor e preço final indefinido | assinatura.js |
| F05 | Tela própria de assinatura com estados de consulta, indisponibilidade e erro | telas/assinatura.html, js/assinatura.js |
| F06 | Reembolsos integrais/parciais e disputas reconciliados por referência | assinatura.js, SQL003 |
| F07 | Teto financeiro mensal global antes de chamar IA | custos.js, SQL003 |
| F08 | Teto financeiro mensal por usuário e reserva conservadora | custos.js, SQL003 |
| F09 | Finalização atômica, custo efetivo ou reserva de custo desconhecido | SQL003 |
| F10 | Reconciliação administrativa comprovada e idempotente | scripts/reconciliar-custo-ia.js |
| F11 | Ledger durável impede nova geração após expirar resposta temporária | SQL003 |
| F12 | Intenção IA persistida por conta/hash, reutilizada após falha/reabertura | chavesIa.js, servicoHttp.js |
| F13 | Sincronização ao retornar à janela, sem edição local obrigatória | sincronizacao.js |
| F14 | Endpoint de vivacidade mínima, sem informações privadas | api/saude.js |
| F15 | Métricas HTTP persistentes e resumo protegido | operacao.js, SQL004, api/operacao.js |
| F16 | Alertas locais de falhas, latência, IA e armazenamento | scripts/monitorar.js |
| F17 | Retenção configurável de métricas/resultados/eventos/contadores | manutencao.js, SQL003/004 |
| F18 | Inventário protegido de objetos não referenciados, sem exclusão insegura | SQL003, operacao.js |
| F19 | Ambiente descartável Supabase CLI com Auth/PostgREST/Storage/Mailpit | scripts/homologar-supabase-local.js |
| F20 | Jornada navegador/BFF/Supabase real local em HTTPS com CA temporária | testes/apoio/*supabase* |
| F21 | Ensaio de dump/restore em outro database e cópia/restauração de bytes Storage | harness Supabase |
| F22 | Atualização PWA por hash de conteúdo, aguardando confirmação do usuário | build, sw.js, atualizacao.js |
| F23 | Homologação Chrome/Firefox/WebKit e ampliação do pipeline/reprodução limpa | comercial-interface.cjs, pwa-atualizacao.cjs, CI |
| F24 | Minutas coerentes com o produto, protocolo nutricional e roteiro de ativação | docs/minutas, PROTOCOLO_REVISAO_NUTRICIONAL.md e relatórios |
| F25 | Reabertura offline conserva o namespace verificado e revalida antes de sincronizar | continuidadeConta.js, conta.js, servicoHttp.js |
| F26 | Precondição de conta impede cruzamento de dados em abas que compartilham cookies | aplicacao.js, servicoHttp.js, regressões multiabas |

As 26 entregas incluem funções de produto, operação e ferramentas de homologação; não representam 26 telas nem 26 integrações cloud. Exportação, login, análise alimentar, CRUD e proteções nutricionais existentes foram preservados e retestados, não contados novamente como novos.

## Problemas corrigidos: 12 grupos

Sete grupos de produto: B01 intenção IA era renovada em retry/reload; B02 JSON200 interrompido podia encerrar a intenção; B03 expiração de resultado removia a proteção financeira durável; B04 retorno ao dispositivo não buscava atualização sem ação manual; B05 preenchimento assíncrono de peso podia substituir a digitação; B06 cache PWA mantinha a mesma versão entre builds; B07 reembolso/disputa não participava da autorização paga.

Três grupos de teste/infraestrutura: B08 readiness PostgreSQL podia aceitar o servidor temporário do initdb; B09 restauração Supabase usava papel insuficiente para funções internas; B10 fixture antiga de timeout não fornecia a sessão exigida pelo novo controle. Os testes foram corrigidos com prontidão TCP, papel administrativo restrito à stack descartável e fixture autenticada, respectivamente. Interceptação de SW variou por motor; os testes passaram a isolar mocks e usar queda real do servidor para WebKit offline. Não houve relaxamento do código de produção para fazer os testes passarem.

Dois grupos adicionais de produto encontrados na revisão final: B11 reabrir sem rede abandonava o namespace da conta e mostrava o espaço local vazio; agora um UUID lembrado permite abrir somente a cópia local, sem fabricar sessão, e reconexão exige revalidação. B12 duas abas compartilham cookies e poderiam misturar conta local antiga com sessão nova; o cliente captura a conta antes dos awaits e o BFF rejeita precondição divergente com409 CONTA_ALTERADA antes de ler/gravar/consumir/excluir. O cabeçalho não concede autorização. Nove grupos de produto e três de infraestrutura/testes no total.

## Contas, dados e armazenamento

Supabase Auth verifica credenciais, confirmação, recuperação e renovação; BFF verifica usuário e sessão revogada no banco. Cookies em ambiente HTTPS são HttpOnly, Secure e SameSite Strict. Não há senha implementada pelo aplicativo em produção. O simulador continua claramente identificado e proibido em produção.

Dados usam namespaces IndexedDB por conta, revisão CAS remota e outbox persistida. Escolha explícita resolve conflitos. Fotos ficam em bucket privado por titular, com limite de formato/tamanho/quantidade/bytes e hidratação sob demanda. Migração legada preserva a fonte original. Exclusão de conta bloqueia novas operações, espera uploads em andamento, remove imagens e então apaga o usuário com cascata. Assinatura vigente precisa ser encerrada antes.

Limite de ciclo de vida: excluir uma refeição remove sua referência sincronizada, mas o objeto privado pode permanecer até excluir a conta. O inventário revela quantidade/bytes sem IDs. Não há coleta automática de órfãos: corridas com upload, reutilização e crons tornam uma remoção ingênua insegura. A política e o prazo de retenção desses objetos exigem decisão antes da oferta. A interface de privacidade informa esse comportamento. O backup integral do usuário exige recuperar todas as imagens referenciadas; falha ao recuperá-las interrompe a exportação.

## Pagamentos e custos

Stripe permanece exclusivamente sandbox, com rejeição de sk_live e eventos livemode. Consulta o estado atual, deduplica eventos, lida com ordem diferente e usa intenção persistida de checkout. Nenhum benefício vem da URL de retorno. Price IDs mensal/anual são configuráveis; nenhum valor comercial foi inventado. Reembolso integral e disputa podem bloquear a conta paga; reembolso parcial não bloqueia por si. Essa política precisa de aprovação antes da venda; o código não solicita estornos nem cancela a cobrança automaticamente.

IA paga requer orçamento global e individual, reserva e máximos de preço de entrada/saída explícitos. A reserva cobre conservadoramente o contexto128000 e saída3500, incluindo imagem; os limites de saída efetivos continuam menores quando aplicável. Custo desconhecido não libera saldo. Cancelamento não promete ausência de cobrança. Ledger e tombstones persistem independentemente do cache de resultados. Apagar a conta não devolve ao orçamento global consumo já ocorrido. Preço do provedor ainda precisa ser confirmado pelo operador; novo campo max_price foi validado com fixture, sem nova geração externa.

## Operação, privacidade e publicação

Métricas são agregadas por minuto/rota/status/faixa de duração. Endpoint operacional exige Bearer>=32, janelas1..360min e não expõe identidades. Latência por histograma é aproximada. CLI lê alertas e define exit code; não envia mensagens. Agendamento e destinatário de incidentes ainda dependem da ativação no provedor. Não há rastreamento nutricional em logs; IDs de correlação permitem diagnóstico.

Retenções técnicas configuráveis não equivalem a prazos legais aprovados. Minutas permanecem fora dos assets públicos; tela de privacidade continua rotulada como minuta. Não houve aprovação jurídica ou clínica. `PROTOCOLO_REVISAO_NUTRICIONAL.md` define amostra e avaliação profissional sem executar nova IA.

CI foi ampliado, mas não executado remotamente. Instalação congelada, build, segurança, testes e cópia limpa foram executados localmente. `.env` privado foi preservado; `.env.example` contém somente nomes e padrões bloqueados. O gitlink antigo do repositório pai continua pendente de release autorizado. Nenhum commit foi produzido para corrigi-lo automaticamente.

## Arquivos e evidências

Novos módulos comerciais/operacionais, API saúde/operação, migrações003/004, templates Auth, suporte HTTPS, testes comerciais/PWA/carga, scripts de monitoramento/reconciliação/auditoria e minutas. Alterados os fluxos conta/assinatura/sincronização/IA/imagens/manutenção, app/navegação/peso/SW/build, package/CI/env e documentação. O detalhamento por frente está em `testes/NOTAS_CUSTOS.md`, `NOTAS_DADOS_STAGING.md` e `NOTAS_OPERACAO.md`.

Evidências locais em `evidencias/comercial/` (ignoradas pelo Git). O ledger anterior `evidencias/homologacao-real/controle.json` conserva SHA256 `7017400c73e72f25c6b522e6812b70271f254d3236665e5e6b21a916b85142c6`, quatro requisições externas anteriores, duas gerações e US$0.00145245. Nenhum limite foi reiniciado.
