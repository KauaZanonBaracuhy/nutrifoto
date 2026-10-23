# Operação do NutriFoto

Este procedimento prepara a operação. A execução local comprovou o banco PostgreSQL e o adaptador de testes; não comprova disponibilidade de Supabase/Stripe/Vercel em produção.

## Observação e alertas

Aplicar migrações 001, 002, 003 e 004 nessa ordem, com backup prévio. Habilitar `METRICAS_HABILITADAS=true` no servidor e definir `OPERACAO_SECRET` aleatório com pelo menos 32 caracteres, diferente de `CRON_SECRET`. Nunca colocar os segredos em arquivos públicos ou parâmetros de URL. `GET /api/saude` informa somente vivacidade do processo: não é teste de prontidão do banco, Storage ou provedores. `GET /api/operacao?minutos=60` exige Bearer e consulta agregados do banco; janela de 1 a 360 minutos. Uma consulta bem-sucedida comprova conectividade e disponibilidade da função de resumo nesse instante. Não comprova a capacidade de realizar pagamentos ou entregas de e-mail.

Executar `node --env-file=.env scripts/monitorar.js` em agendamento externo a cada cinco minutos. `MONITOR_ORIGIN`, quando definido, deve ser origem HTTPS exata; loopback HTTP é permitido somente para diagnóstico local. Código de saída 0 significa consulta sem alertas, 1 significa erro de configuração/conexão/autenticação, 2 significa alerta. A CLI imprime agregados e não envia mensagens. Configurar o agendador para avisar o responsável por códigos 1/2 é uma dependência operacional externa, ainda não homologada. Não enviar o arquivo `.env` a serviços de observação.

Alertas automáticos: pelo menos 20 pedidos e 5% de falhas HTTP; p95 a partir de `ALERTA_P95_MS` (padrão 2500 ms); qualquer 5xx em pagamento/sincronização/Storage na janela; custos IA desconhecidos ou reservas pendentes; Storage acima de `ALERTA_STORAGE_BYTES` quando maior que zero. Reservas em andamento podem gerar alerta transitório: investigar a duração antes de reconciliar. Ausência de tráfego não é prova de disponibilidade; o agendador deve consultar também a vivacidade pública. Custos são do mês UTC; Storage é o inventário reservado/confirmado de imagens, não a cobrança da infraestrutura.

O histograma tem limites 50/100/250/500/1000/2500/5000/10000/60000 ms. p95 é limite superior aproximado; pedidos acima de 60 segundos saturam a última faixa. Métricas persistentes contêm somente minuto, rota permitida, status, faixa, quantidade e duração total. Não contêm IP, usuário, e-mail, imagem, alimento, token ou corpo. O log HTTP usa identificador aleatório por pedido em `X-Request-Id`; pedir esse identificador ao investigar erro. Não copiar dados de saúde em tickets. Falha ao persistir observação registra apenas `metrica_indisponivel` e não refaz o pedido nem a cobrança. Ainda é necessário observar esse log no provedor e configurar prazo de retenção dos logs externos.

## Retenção

Manter métricas agregadas 30 dias por padrão; `METRICAS_RETENCAO_DIAS` aceita 1 a 365. A função protegida `nf_limpar_metricas(dias)` remove somente agregados antigos; o cron de manutenção deve chamá-la quando métricas estiverem habilitadas. Confirmar o agendamento diário e observar sua última execução antes de liberar produção. A limpeza operacional 001 trata contadores, resultados e eventos efêmeros; ledger financeiro 003 exige reconciliação e política própria, não deve ser eliminado como cache. Backups e logs do provedor têm retenções independentes: registrar as janelas efetivas e restringir os acessos.

## Incidente

1. Registrar horário UTC, rota, status e identificador de requisição, sem dados pessoais. Consultar resumo protegido e estado do provedor; preservar evidências mínimas em local restrito.
2. Para custo IA anômalo, definir limites IA como zero/desabilitar provedor e manter reservas. Não repetir análises desconhecidas. Reconciliar apenas com evidência do provedor pela rotina financeira, sem nova geração.
3. Para falha de pagamento, consultar eventos assinados e estado atual no Stripe sandbox. Não conceder plano pelo retorno do navegador e não reenviar cobranças manualmente. Produção depende de homologação do ciclo real.
4. Para indisponibilidade de sincronização/Storage, comunicar indisponibilidade e preservar cópia local. Não limpar armazenamento do navegador nem sobrescrever a nuvem sem comparar revisões. Exclusões parciais devem ser retomadas pelo fluxo idempotente.
5. Para suspeita de credencial exposta, revogar/rotacionar no console autorizado e atualizar somente o segredo do servidor. Não testar credenciais antigas. Conferir assets e logs, avaliar alcance e acionar responsáveis pela avaliação jurídica de comunicação.
6. Retomar gradualmente após verificar sessão, sincronização, imagem privada, orçamento e observação. Registrar causa, impacto observado, correção e teste que impede recorrência.

## Backup e restauração

Exportação pessoal do aplicativo, backup PostgreSQL e backup dos objetos Storage são três coisas distintas. A exportação JSON inclui dados da conta e suas imagens quando disponíveis; não recupera usuários, sessões, ledger, eventos ou configurações do projeto. `pg_dump` sozinho não contém os bytes dos objetos Storage.

Antes de um release, produzir dump consistente do banco e inventário dos objetos com prefixo/chave, tamanho e SHA256, copiar os bytes para destino privado criptografado e registrar horário/versão das migrações. Proteger dumps, manifestos e chaves; não incluir credenciais em comandos gravados. Não alegar backup completo quando objetos ou configuração Auth/templates estiverem ausentes. Não copiar sessões ativas ou dados reais para testes cotidianos.

Restaurar primeiro em projeto ou contêiner novo com identificador inequívoco e sem acesso à aplicação de produção. Conferir explicitamente host/projeto de destino antes de qualquer importação. Criar buckets privados, restaurar banco/configurações necessárias, importar objetos e comparar contagem/bytes/hashes e vínculos usuário→objeto. Testar isolamento entre duas contas fictícias, download, CAS de sincronização e restauração de exportação. Não reativar integrações pagas/SMTP externo no destino de ensaio. Depois destruir somente os recursos temporários comprovadamente criados para esse ensaio. RPO/RTO reais dependem do agendamento e de restauração cronometrada do conjunto completo; ainda não certificados por ensaio PostgreSQL isolado.

## Release e reversão

Não fazer deploy automaticamente. Congelar dependências pelo lockfile, executar build/verificações, testes de servidor, banco e UI e revisar os artefatos públicos. Separar segredos e origens de desenvolvimento, homologação e produção. Aplicar migrações aditivas antes de ativar flags; migrações 001/002 existentes exigem seguir o procedimento de aplicação única documentado. Manter versão do aplicativo e backup anteriores. Em falha, desabilitar a funcionalidade/limites e restaurar o artefato anterior compatível; não remover tabelas nem executar migração inversa destrutiva sem plano de dados. Fixar o gitlink do repositório pai somente no release autorizado. Commit, push e publicação continuam pendentes de autorização explícita.

## Limites de capacidade

`node testes/carga-comercial.cjs` cria quatro servidores efêmeros exclusivamente em loopback, com heap limitado a 384 MB e 10 mil registros fictícios cada. Testa 10, 50, 100 e 500 conexões concorrentes. Mede p50/p95/p99, throughput, status, CPU do servidor, pico RSS e preservação dos registros. O adaptador JSON serializa escritas; HTTP429 é esperado e protege o servidor. Métricas elevadas podem refletir fila e serialização das fixtures. CPU percentual é de um núcleo e RSS inclui memória além do heap. O resultado em `evidencias/comercial/carga-comercial.json` não dimensiona banco PostgreSQL, Vercel, e-mail, Stripe ou IA, nem representa 500 clientes reais habilitados. O teste PostgreSQL separado verifica agregação concorrente e permissões; não é benchmark do banco em produção.
