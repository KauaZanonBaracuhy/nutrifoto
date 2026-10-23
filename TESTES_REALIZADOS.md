# Testes realizados — 21/10/2026

> Atualização da rodada real de 21/10/2026: quatro requisições OpenRouter (duas gerações), 9.056 tokens, US$ 0,00145245 informados; rodada encerrada. Dois defeitos adicionais corrigidos: TACO incompleta e campo opcional undefined no backup. Testes atuais: 48 casos Node distintos aprovados considerando Postgres separado; 26 cenários gerais e 12 adicionais. Consulte RELATORIO_HOMOLOGACAO_REAL.md e RELATORIO_ATUALIZADO_PARA_CHATGPT.md. Serviços comerciais permanecem pendentes.

Ambiente: Windows, Node 24.19.0, pnpm 11.25.0, Chrome headless via Playwright; fuso America/Sao_Paulo. PostgreSQL 15 em Docker isolado, sem rede, temporário. Dados pessoais reais, pagamentos Stripe e e-mails não foram usados. Houve duas gerações de IA reais autorizadas, registradas na rodada adicional; a suíte geral continua simulada. Evidências locais em `evidencias/` são ignoradas pelo Git; exportar/preservar esse diretório separadamente se quiser transportar os resultados.

## Resultado final

| Verificação | Resultado | Evidência |
|---|---|---|
| `node --test testes/*.test.js` | 48 casos: 47 aprovados, 0 falhas, 1 ignorado (Postgres opt-in) | `evidencias/homologacao-real/unitarios.log` |
| `NUTRIFOTO_TESTAR_POSTGRES=true node --test testes/backend-postgres.test.js` | 1 aprovado, 0 falhas; cobre o mesmo caso ignorado acima | `evidencias/homologacao-real/postgres.log` |
| `node testes/interface.cjs` | 26 cenários aprovados, 0 reprovados; nenhum pageerror registrado | `evidencias/interface/resultado.json`, `evidencias/interface.log` |
| `node scripts/verificar-sintaxe.js` | 67 arquivos JS/CJS aprovados | `evidencias/homologacao-real/sintaxe.log` |
| Build e scan público | Aprovados, sem padrões de chave privada/scripts externos detectados | `scripts/verificar-seguranca.js`, build e cópia limpa |
| Instalação frozen/offline + build/sintaxe em diretório novo sem `.env`/node_modules anterior | Aprovados; cópia controlada, não clone de release | `evidencias/homologacao-real/fonte-limpa.json`, `fonte-limpa.log` |
| Auditoria pnpm de dependências | 0 vulnerabilidades reportadas (incluindo dev); 10 pacotes | `evidencias/dependencias.json` |
| Carga local sintética | 200 pedidos, concorrência 10: 90 HTTP 200, 110 HTTP 429, 0 HTTP 5xx; p50 106,84 ms, p95 211,51 ms, total 2,09 s | `evidencias/homologacao-real/carga.json` |
| Auditor estático premium em modo strict | NÃO APROVADO automaticamente: 53 alertas `affordance.actionless-button`, 0 unresolved | `evidencias/ui-estatico.json` e `ui-estatico.log` |
| Graphify AST + cluster sem rótulos pagos | Executados novamente nesta rodada; métricas no log atualizado | `../implementacao-evidencias/grafo-homologacao-real.log`, `grafo-homologacao-cluster.log`; `../graphify-out/` |

São 48 casos automatizados distintos aprovados considerando a execução separada de Postgres, além de 26 jornadas gerais e 12 adicionais de homologação. Não somar o caso Postgres duas vezes nem transformar essas contagens em percentual de cobertura.

## O que foi real e o que foi simulado

HTML, JavaScript, navegação, componentes, armazenamento IndexedDB/localStorage, uploads de arquivos sintéticos, downloads de backups, foco/teclado, cache/service worker e HTTP local executaram em Chrome real. As migrações e funções SQL executaram em PostgreSQL real. O teste monta esquemas mínimos de `auth`/`storage` para testar SQL; não executa Supabase Auth/Storage hospedados. RLS/grants, lock/CAS, concorrência de quotas, sessão proprietária/revogação, cascatas e reserva de checkout foram exercitados no banco.

Contas e IA das jornadas E2E são fixtures de um servidor local. Recuperação usa caixa fictícia em arquivo temporário e token descartável, sem envio de e-mail. Pagamento simulado responde 503 para não sugerir aprovação. Os adaptadores de Supabase/OpenRouter/Stripe foram testados com fetch interceptado, inclusive headers, schema, erro, timeout, webhook e parâmetros idempotentes; o OpenRouter foi exercitado adicionalmente com duas gerações reais, sem homologar os demais provedores ou o produto comercial. Bloqueio de rede externa nos contextos de interface impede depender de CDN ou IA paga para passar.

## Jornadas de interface

1. Primeiro acesso, navegação e um fragmento HTML por tela.
2. TACO sem conta, porção editada e total único.
3. Duplo clique sem duplicação, persistência após reload e streak real.
4. Edição/cancelamento e nomes HTML tratados como texto.
5. Inclusão/remoção de alimentos e rejeição de valores inválidos.
6. Histórico com payload seguro e exclusão cancelada.
7. Água e peso persistidos no dia local.
8. Download JSON/CSV e importação integral idempotente pela interface.
9. Conta Ana vazia e migração explícita preservando legado.
10. Galeria e IA fictícia somente após ciência técnica.
11. Perfil inválido bloqueado, plano rotulado como rascunho, macros próprios e aplicação de metas impedida.
12. Segunda sessão recupera diário e foto privada sob demanda.
13. Logout/conta Bruno isolados e indisponibilidade explícita do checkout sem Stripe.
14. Cadastro `.test` e recuperação/redefinição fictícia por fragmento, incluindo aba existente e remoção do token da URL.
15. Exclusão da conta fictícia e acesso posterior não autorizado.
16. Imagem inválida, rede indisponível e retorno ao fluxo.
17. Cancelamento de requisição pendente e recusa de resposta nutricional inválida.
18. Sessão expirada oculta os dados da conta e solicita login.
19. Larguras 320/390/768/1440, temas, sem overflow horizontal do documento, macros sem decimais infinitos e teclado em telas irmãs.
20. Assets sem configuração secreta/CDN, endpoints protegidos e painel funcional sem Chart.
21. TACO ambígua exige confirmação de preparo.
22. 35 dias: carrega 30 + 5, abre edição com Enter, fecha com Escape e restaura foco.
23. Service worker instalado: reabre offline e calcula TACO local sem IA (200 g de arroz integral: 247 kcal arredondadas na tela).
24. Relógio controlado: lembrete recorre no próximo dia enquanto a página continua aberta.
25. Nenhum evento pageerror capturado no conjunto dessas jornadas. Isso não prova ausência de todos os erros possíveis; falhas controladas mostram mensagens próprias.

Screenshots finais: `evidencias/interface/painel-320.png`, `painel-390.png`, `painel-768.png`, `painel-1440.png`, `configuracoes-gelo-desktop.png`, `outro-dispositivo.png`. Foram inspecionadas visualmente as capturas de 320 px e do tema claro. O antigo `perfil-desktop.png` é evidência intermediária e não deve ser usado como screenshot final. Os arquivos backup.json/CSV nessa pasta contêm somente dados fictícios.

## Domínio, persistência e segurança

A suíte inclui porções 50/100/150/200 g e edições repetidas, precisão da TACO preservada, 597 correspondências exatas e ambiguidades de arroz/frango/feijão, aliases de restrição e filtros, somas e números inválidos, perfil adulto/condições/gestação, nutrientes novos na substituição, prompt sem misturar alergias e preferências, limite e cancelamento do corpo da resposta.

Persistência: upgrade v1→v4 com foto/IDs, transações e intenção concorrente única, água concorrente, merge de metas preservando água, isolamento de contas/preferências, backup completo, arquivo inválido/quotas com rollback normal, paginação sem fotos, retomada da outbox após resposta perdida, 409 com decisão explícita, migração consentida e recuperação de fotos remotas. Dados legados inconsistentes são arquivados para revisão em vez de aplicados automaticamente.

Servidor: origem/CSRF/cookies, autenticação e isolamento, corpo limitado, validação repetida, plano/IA sem sessão recusados, quota/idempotência, logs sem payload/segredos, assinatura webhook/tempo/replay/fora de ordem e bloqueio de cobrança real. O SQL real aprovou 16 reservas IA concorrentes com limite 5 (5 aceitas/11 negadas), oito chamadas com rate limit 3 (3 aceitas/5 negadas), duas gravações CAS com só uma vencedora, quotas de imagem e oito intenções concorrentes de checkout com a mesma chave/expiração. Manutenção sem segredo/sem autorização é recusada e com segredo válido aciona limpeza em teste isolado.

A chave atual foi usada somente pelo servidor em diagnóstico e duas gerações autorizadas. A antiga não foi testada contra o provedor. Scan de padrões e auditoria de dependências não equivalem a pentest ou prova de ausência de vulnerabilidades.

## Achados das próprias verificações

Falhas reais encontradas e corrigidas: sobreposição de ações inferiores pela navegação/FAB; token de recuperação não recolhido em navegação apenas por fragmento na aba existente; arredondamento prematuro da TACO fazia entrada direta e edição divergirem; macro numérico com precisão de ponto flutuante transbordava visualmente em 320 px; contraste da navegação em tema claro. As jornadas afetadas foram repetidas e a última execução completa está aprovada.

Falhas do teste corrigidas: espera do carregamento assíncrono da paginação; fixture de namespace entre casos; sincronização da navegação após login. Não foram contadas como defeitos comprovados do produto. Execuções anteriores reprovadas não são omitidas, mas os arquivos finais apontam para a última execução.

O auditor premium procura ação no atributo HTML onclick/@click/v-on:click e não segue addEventListener ou atribuição `.onclick` de módulos externos. Os 53 alertas finais desse tipo permanecem no JSON bruto: captura/app, conta/privacidade, navegação, tutorial, configurações e plano têm bindings em `app.js`, `conta.js`, `navegacao.js`, `tutorial.js`, `configuracoes.js` e `plano.js`. As jornadas essenciais foram exercitadas acima; isso não transforma o resultado strict em PASS nem prova individualmente todas as combinações de botões. Não foi adicionado handler inline incompatível com a CSP para silenciar a ferramenta. Não há certificação completa de acessibilidade ou auditoria visual automatizada.

A cópia limpa em Windows emitiu aviso Node DEP0190 sobre execução do binário pnpm por shell no auxiliar de verificação; programa/argumentos são locais controlados, não conteúdo de requisição. O build terminou com sucesso; não é advertência do aplicativo publicado. Graphify tem limitação de colisão de rótulos e consultas truncadas a 800 tokens; a explicação focada de sincronizarDados mostrou conta→sincronização→executor, conferida no código. Baseline 473 nós/840 relações e final 901/2.208 incluem ferramentas e não são métrica de desempenho/qualidade.

## Não executado e limites comerciais

Não houve CI remoto, deploy, clone de commit contendo esta entrega, Supabase hospedado/SMTP real, Stripe sandbox autenticado, precisão de fotos reais contra referência pesada, validação nutricional/jurídica, restauração cloud com objetos Storage, teste de retenção/monitoramento externo, carga distribuída, Android/APK, câmera de aparelho, Safari/iOS/Firefox, instalação/atualização PWA em aparelhos ou leitor de tela real. O modo offline foi testado em Chrome após cache instalado; uma primeira visita sem rede não pode instalar o aplicativo.

Carga mede apenas GET de assinatura com adaptador JSON local. HTTP 429 demonstra bloqueio configurado, não suporte a 200 clientes. Não extrapolar p95 para cloud. Metadados continuam snapshot limitado (3,8 MB e 10.000 por coleção), fotos 1 MB/unidade com orçamento configurável; conjuntos maiores precisam de evolução e medições. Importação entre IndexedDB/localStorage não é atômica sob queda abrupta. Lembretes não cobrem página fechada/suspensa. Atualizações/cache/dispositivos e todas as integrações devem ser homologados antes de piloto real.

## Adição da rodada real

O cenário 26 recusa referência TACO incompleta sem gastar API e reaplica a resposta textual real gravada, preservando estimativas e total 150 kcal. A jornada separada tem 12 cenários, cobrindo texto/foto reais ou replay, edição/persistência/histórico/gráficos, TACO sem consumo, plano bloqueado, backup/restauração e erros 401/429/503/JSON/timeout simulados. Casos Node novos cobrem TACO null, teto de tokens, erros do provedor, contrato JSON sem marca e backup de campo undefined legado sem modificar o original. A primeira resposta textual real falhou na UI por TACO null; a foto ao vivo passou após essa correção. A execução final adicional reutiliza respostas reais, sem repetir consumo.

Consulte `evidencias/homologacao-real/resultado-interface.json`, `regressao-interface.json`, `controle.json` e `RELATORIO_HOMOLOGACAO_REAL.md`. Tokens/custo: 9.056/US$ 0,00145245, quatro requisições ao todo; rodada encerrada. As falhas iniciais, correções e limites de reconhecimento/porção/composição são documentados no relatório real. A base tem 15 registros sem nutrientes utilizáveis, sem conversão em zero. Não há evidência estatística de acurácia ou homologação clínica.
