# Entrega da frente de operação — 22/10/2026

Arquivos: servidor/operacao.js, api/saude.js, api/operacao.js, scripts/monitorar.js, supabase/004_operacao.sql, testes/operacao.test.js, testes/operacao-postgres.test.js, testes/carga-comercial.cjs, OPERACAO.md.

Implementação: saúde pública mínima; resumo protegido Bearer>=32; métricas persistentes por minuto/rota/status/faixa sem identidade; histograma e alertas HTTP/latência/pagamentos/sync/Storage/custos IA; ledger003 mostra custos desconhecidos e reservas; limpeza configurável via RPC; CLI somente leitura sem envio externo; procedimentos de incidente, backup completo e rollback. Integração do finally em aplicacao.js foi coordenada com custos_conclusao. Integração de rotas local.js/cron/env fica com agente raiz.

Validação: quatro testes Node aprovados. Um teste real PostgreSQL15 em Docker29.9.2, rede none,256MB/1CPU,tmpfs, aplica001–004 e valida24 gravações concorrentes, total25, faixas, saldo desconhecido/reservado, ausência de identidade nas colunas, grants/RLS, rejeição de rota arbitrária e limpeza30dias. Contêiner temporário removido. Nenhum serviço cloud foi acessado.

Carga simulada:10/50/100/500 conexões,200/200/200/1000 pedidos respectivamente; cada fase preservou10.000registros fictícios e1sessão. Status200:90emcada;429:110/110/110/910; nenhum5xx. p95ms1052.10/4165.94/6247.46/9073.96. Throughput17.22/21.44/27.40/99.20req/s. CPUum núcleo50.74/53.27/52.88/73.16%; picoRSS160739328/168955904/173187072/281612288bytes. Esses resultados incluem restrição90/min por usuário e120/min por rede; não constituem aprovação de escala dos provedores. Evidência JSON em evidencias/comercial/carga-comercial.json.

Reprodução: `node --test testes/operacao.test.js`; definir `NUTRIFOTO_TESTAR_POSTGRES=true` e rodar `node --test testes/operacao-postgres.test.js`; `node testes/carga-comercial.cjs`. Node do runtime foi usado por caminho absoluto por PATH da sessão não conter node.exe.

Dependências externas: configurar segredos/flags/agendador, observar retenção e logs no provedor, conectar alertas ao responsável e executar restore completoDB+Storage em destino isolado. Saúde pública é vivacidade; não publicar como garantia de prontidão de todos os provedores. Não houve commit/deploy/IA/cobrança/e-mail externo.
