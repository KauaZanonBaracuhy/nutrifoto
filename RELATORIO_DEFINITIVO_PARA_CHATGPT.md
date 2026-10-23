# NutriFoto: relatório definitivo da engenharia comercial

Data: 22/10/2026. Versão: 0.2.0. Trabalho local concluído nesta rodada; nenhuma publicação ou cobrança real autorizada. Este relatório é autossuficiente para avaliação sem acesso ao repositório. Apto para demonstração privada restrita; **não apto para clientes pagantes ou divulgação em escala**.

## 1. Como funciona

NutriFoto é um diário alimentar web/PWA para adultos: registra refeições, água, peso e metas, oferece busca local TACO e estimativas por texto/foto via IA. Usuário revisa alimento e porção antes de salvar. Funciona localmente para registros permitidos; login, IA, sincronização e pagamentos exigem rede. Uma fotografia não mede massa nem certifica alergênicos.

## 2. Arquitetura final

Frontend modular em HTML/CSS/JavaScript nativo, um HTML por tela em www/telas; www/index.html contém o shell/painel. BFF Node e endpoints Vercel controlam autenticação, dados, IA, assinatura, imagens e manutenção. Supabase fornece Auth, PostgreSQL e bucket privado. Stripe é exclusivamente sandbox; OpenRouter executa modelo fixo. Não há novas classes próprias. web/shared são legados ignorados, não fonte de publicação.

## 3. Funcionalidades disponíveis

Diário e histórico paginado, edição/exclusão, fontes nutricionais, água/peso/gráficos, temas, onboarding, backup/importação, contas, recuperação, confirmação, sincronização e área de privacidade. IA depende de conta, ciência contextual, quotas e orçamento. Assinatura tem tela própria e portal/checkout preparados; sem configuração a indisponibilidade é explícita. Planos personalizados não estão liberados comercialmente e aplicar metas de rascunhos permanece bloqueado.

## 4. Implementações desta missão

26 capacidades foram adicionadas ou ampliadas, incluindo confirmação/templates, benefícios centralizados, períodos mensal/anual, tela de assinatura, reversões, tetos financeiros global/individual, ledger/reconciliação, idempotência persistida no cliente, sincronização ao foco, métricas/alertas/retenção, inventário de imagens, Supabase local real integrado em HTTPS, restore, atualização PWA, CI/compatibilidade, reabertura offline, proteção entre abas e documentação profissional pendente de aprovação. IMPLEMENTACAO_COMERCIAL.md enumera F01–F26. Doze grupos de problemas foram corrigidos: nove de produto e três de testes/infraestrutura; entre eles duplicação em retry, resposta truncada, cache antigo, corrida no preenchimento do peso e possível cruzamento de contas em abas com cookies compartilhados.

## 5. Serviços reais efetivamente testados

Supabase real **local**, CLI 2.121.0 e Docker: Auth, PostgreSQL, PostgREST, Storage e Mailpit. Onze verificações agregadas passaram; uma inclui seis passos navegador→BFF HTTPS→Supabase: cadastro/confirmação por e-mail, cookies seguros, foto/dados sincronizados, outro contexto de navegador, refresh, recuperação e exclusão. Dump foi restaurado em outro database; bytes de imagem foram copiados/restaurados separadamente com hash. CA temporária ficou restrita ao subprocesso; nenhuma proteção TLS de produção foi removida. Não houve homologação Supabase cloud nem SMTP externo.

As duas gerações OpenRouter reais são da rodada anterior, encerrada: texto e foto de banana, 9.056 tokens, US$ 0,00145245 no total. Foram quatro requisições externas incluindo duas consultas de diagnóstico. Nenhuma geração adicional ocorreu nesta missão. O controle original continua selado com o mesmo SHA256.

## 6. Testes simulados e contagem

66 casos da suíte Node aprovados em execuções complementares: 64 passaram na execução padrão e os dois PostgreSQL ignorados nessa execução passaram separadamente. Incluem 18 testes de dados com navegador e 14 de nutrição; não somá-los novamente. Outros 74 cenários de navegador: 26 gerais, 27 comerciais/compatibilidade, cinco de atualização PWA, 12 replays de respostas antigas e quatro de continuidade offline/multiabas. Somam-se 11 verificações agregadas Supabase e quatro fases de carga: **155 verificações pelo critério declarado**. Reruns e subpassos não são contados outra vez.

Stripe, grande volume, falhas de rede/provedor e parte dos conflitos usam fixtures/adaptadores. Chrome, Firefox e WebKit passaram nove cenários comerciais cada. Viewports de 320/390/768/1440 pixels, temas claro/escuro e teclado foram exercitados; não são dispositivos físicos nem Safari certificado. Não há novo teste do campo provider.max_price contra OpenRouter real.

## 7. Supabase

Migrações 001–004 criam contratos transacionais, RLS e funções restritas ao serviço. O navegador não recebe service role. BFF verifica usuário, titular da sessão e revogação; acesso direto indevido por anon/authenticated foi negado em serviços locais reais. Confirmação e recuperação usam TokenHash em fragmento removido imediatamente da URL. Auth do provedor gerencia senhas. Cookies HTTPS são Secure, HttpOnly e SameSite Strict. Produção exige origens HTTPS e configuração privada própria.

## 8. Stripe

Preço vem do servidor, por Price ID. Checkout tem intenção persistida por conta e idempotência; uma URL de sucesso nunca concede acesso. Webhook valida HMAC/tempo, rejeita livemode e consulta assinatura atual. Eventos duplicados/fora de ordem, renovação, recusa, expiração e bloqueios por reembolso/disputa têm testes locais. Reembolso integral bloqueia benefícios pagos da conta; parcial não bloqueia por si. Disputa aberta/perdida bloqueia; vitória elegível remove apenas aquele bloqueio. O código não inicia estorno nem cancela automaticamente cobrança. A política precisa de aprovação e testes sandbox externos. Nenhuma chamada Stripe autenticada ocorreu nesta missão. sk_live continua recusada.

## 9. Planos e quotas

Configuração central define análises mensais, fotos, bytes, análise de foto e sincronização por plano; servidor aplica os limites. Mensal/anual são referências configuráveis, sem preço final inventado. O arquivo exemplo mantém quotas e orçamento pagos em zero. Decisões de valores, benefícios, renovação, cancelamento e reembolso pertencem ao proprietário, com revisão pertinente antes da oferta.

## 10. IA e custos

Modelo fixo openai/gpt-4o-mini via OpenRouter, chave somente no servidor, estrutura/valores nutricionais revalidados. Há rate limiting, quota, teto de tokens, máximo de preço e reserva monetária transacional antes da chamada, global e por usuário/mês UTC. Reserva conservadora considera contexto de 128.000 tokens e saída de 3.500, com preços aprovados pelo operador. Falta de configuração bloqueia a chamada.

Resultado e custo são finalizados atomicamente; custo desconhecido mantém reserva. Cancelar a tela não garante cancelar cobrança. Ledger durável impede reexecutar operação após expirar o resultado temporário. Cliente persiste somente hash/UUID/data por conta e reutiliza a chave após timeout, reload ou JSON interrompido. Após 24 horas de incerteza, exige atendimento/reconciliação, sem gerar chave nova automaticamente. O operador concilia custo comprovado por CLI; não libera reservas pelo tempo. Limpar dados do navegador remove esse controle local; a mesma chave continua protegida no servidor, mas uma nova intenção diferente não é deduplicada globalmente por conteúdo.

## 11. Armazenamento

IndexedDB e preferências têm namespace por conta, separado do legado. Snapshot remoto usa revisão e validação; fotos privadas têm limite de 1 MB, hash e propriedade por titular, carregadas sob demanda. Exclusão de conta remove objetos antes de Auth/cascata e pode ser retomada em falha parcial. Assinatura vigente deve encerrar antes da exclusão. Excluir uma refeição pode deixar seu objeto privado até excluir a conta: há inventário agregado, sem GC automático inseguro. O prazo/política de retenção desses objetos ainda precisa ser aprovado. Logout conserva a cópia local e a interface explica como apagá-la.

## 12. Sincronização

Outbox persistida repete intenção após resposta perdida; CAS impede sobrescrita silenciosa. Alterações locais simultâneas exigem escolha entre local/remoto/mescla. Login, reconexão e retorno à janela agendam sincronização; não há promessa de atualização contínua em tempo real com a página permanentemente aberta. Trocar conta cancela trabalho anterior e muda o banco local. Reabrir offline lembra somente o UUID do banco local, sem conceder sessão; reconexão revalida antes de sincronizar e logout remove a lembrança. Cabeçalho X-Conta-Esperada é uma precondição de recusa: cookies de outra conta em uma segunda aba causam uma resposta409 antes de qualquer operação protegida, evitando gravar dados de A em B. Migração legada exige escolha explícita e preserva o original. Offline/multiabas foram testados com simulação; dois contextos de navegador recuperaram foto/peso com o Supabase real local.

## 13. Recuperação e backup

Backup do usuário inclui imagens recuperáveis, refeições, perfil, metas, água/peso, plano e preferências; não inclui senhas/chaves. A exportação falha se não conseguir obter imagem necessária. Importação valida e evita duplicações. Restore local comprovou banco e bytes separados. Backups do banco Supabase não incluem os arquivos Storage, conforme a [documentação oficial](https://supabase.com/docs/guides/platform/backups). Faltam periodicidade, retenção, proteção, RPO/RTO, responsável e ensaio no destino hospedado real.

## 14. Proteções e operação

Origem exata, CSRF, cookies seguros, CSP, validação/XSS, autorização, bucket privado, limites e webhook assinado. Logs têm ID de correlação, status e duração, sem conteúdo alimentar ou segredos. Métricas persistentes agregam minuto/rota/status/faixa; endpoint protegido e CLI mostram falhas, latência, IA, Storage e inventário de imagens. Saúde pública é somente vivacidade. Alertas são calculados; envio ao responsável e execução do cron precisam ser ativados na infraestrutura. Retenção é configurável, sem apagar ledger financeiro necessário à antirrepetição.

## 15. Limitações remanescentes

Sem evidência de escala cloud, entrega SMTP externa, Stripe sandbox real ou aparelhos físicos. Carga simulada com concorrência de 10/50/100/500 preservou 10.000 registros e não produziu erros 5xx, mas p95 subiu de 1,05 s para 9,07 s e houve respostas 429 esperadas; isso não certifica 500 usuários em produção. Auditor premium strict marcou 58 botões por reconhecer apenas handlers inline/submit; ações externas foram revisadas e jornadas passaram, mas a ferramenta estática não foi declarada aprovada. Não houve auditoria integral por leitor de tela. O CLI Graphify ficou indisponível na retomada; consulta inicial e leitura direta fundamentaram a arquitetura, e o grafo anterior não foi apresentado como atualizado. Gitlink antigo ainda requer release autorizado.

## 16. Aprovações externas

Confirmar revogação da antiga chave OpenRouter no painel, sem usá-la; ela não aparece nos assets locais atuais, mas permanece no histórico Git. Não foi removida por reescrita nem o site público existente foi atualizado. Supabase cloud, SMTP, Stripe test, DNS/hospedagem, contratos, privacidade/transferências, atendimento, retenção e revisão nutricional precisam de responsáveis e evidências. Cinco minutas e um protocolo profissional foram preparados, sem aprovação jurídica ou clínica. Planos/metas automáticas continuam bloqueados.

## 17. Decisões comerciais

Definir fornecedor/contatos, preço mensal/anual, quotas e armazenamento, orçamento IA, política de cancelamento/reembolso/disputa, prazo de imagens órfãs/backups/logs, suporte e SLO. Produção financeira exige autorização específica posterior: não basta trocar a chave. O código desta missão aceita exclusivamente sandbox.

## 18. Como executar e homologar

Na raiz nutrifoto: `pnpm install --frozen-lockfile --ignore-scripts`; executar os scripts build, check, test, test:postgres com NUTRIFOTO_TESTAR_POSTGRES=true, test:interface, test:comercial, test:pwa, test:continuidade, test:carga:comercial e test:fonte-limpa. Dependências de produção não apresentaram vulnerabilidades conhecidas na auditoria executada. Supabase local exige Docker, CLI oficial e Python/cryptography; test:supabase:local cria e remove stack isolada, sem .env do produto nem IA externa. Demonstração fictícia: `node servidor/local.js --simulado --porta 4173`. CONFIGURACAO_PARA_PRODUCAO.md contém comandos, variáveis, staging, release e rollback. Nenhum commit/push/deploy foi feito; CI remoto segue pendente.

## 19. Demonstração privada à influenciadora

**APTO COM RESTRIÇÕES**: demonstrar versão local, dados fictícios e simulação/replay explicitamente identificados, sem apresentar precisão clínica, pagamento ou cloud como homologados. Evidência favorável: jornadas, motores e stack real local aprovados. Riscos: resultados estimados, configuração externa ausente e credencial antiga ainda sem revogação comprovada. Divulgação pública ou dados reais não estão cobertos por esse parecer.

## 20. Piloto e clientes pagantes

Piloto com usuários e dados pessoais reais: **NÃO APTO agora**. Clientes pagantes: **NÃO APTO agora**. Há engenharia e integração local comprovadas, mas faltam staging hospedado/SMTP/Stripe real de teste, revogação, decisões legais/comerciais, retenção de imagens, suporte/backup operacionais e dispositivos reais. Para aprovação, concluir essas configurações e repetir a matriz de aceitação no destino; pagamentos reais exigem autorização e trabalho específico. Não foram identificadas falhas corrigíveis reprovadas nas suítes finais, mas as limitações e dependências não permitem declarar o produto comercialmente pronto.

## 21. Divulgação em larga escala

**NÃO APTO**: carga local com adaptador simulado não mede capacidade dos provedores, rede móvel, coldstarts ou disponibilidade. Definir SLO, observar métricas e custos no piloto, executar carga gradual no staging autorizado e validar recuperação/atendimento antes de divulgação. Sem essas evidências, prometer escala seria indevido.

Relatórios complementares: IMPLEMENTACAO_COMERCIAL.md, TESTES_COMERCIAIS.md, CONFIGURACAO_PARA_PRODUCAO.md e OPERACAO.md. Evidências locais sanitizadas: evidencias/comercial/. Controle IA preservado: SHA256 `7017400c73e72f25c6b522e6812b70271f254d3236665e5e6b21a916b85142c6`. Os 155 resultados contabilizados são verificações de software/infraestrutura local, não testes clínicos ou pagamentos reais.
