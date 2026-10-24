# Relatório de homologação real do NutriFoto

Rodada de 21/10/2026 (São Paulo; registros UTC iniciam em 22/10). Continuação da implementação 0.2.0, preservando código, dados e alterações Git anteriores. Não houve deploy, push, alteração de credenciais, e-mail, pagamento Stripe ou uso de dados pessoais reais.

## Provedor, autenticação e custo

A configuração local contém OPENROUTER_API_KEY; não há variável de modelo preenchida. O backend fixa `openai/gpt-4o-mini`. O diagnóstico autenticado GET `/api/v1/key` retornou 200; GET `/api/v1/models` confirmou o modelo, entradas text/image/file e suporte a response_format/max_tokens. As gerações realmente retornaram esse modelo. Execução textual foi roteada pelo OpenRouter para Azure e a imagem para OpenAI, conforme o campo provider recebido.

| Chamada OpenRouter | Finalidade | HTTP | Entrada | Saída | Total tokens | Custo USD informado |
|---|---|---|---:|---:|---:|---:|
| 1 | Diagnóstico da chave, GET key | 200 | — | — | — | Sem geração |
| 2 | Catálogo de modelo/preços, GET models | 200 | — | — | — | Sem geração |
| 3 | Texto alimentar | 200 | 187 | 129 | 316 | 0,00010545 |
| 4 | Foto de banana | 200 | 8.660 | 80 | 8.740 | 0,00134700 |
| Total | 4 requisições, 2 gerações | | 8.847 | 209 | 9.056 | **0,00145245** |

Não foi usada a quinta chamada permitida. A rodada foi encerrada persistentemente em `evidencias/homologacao-real/controle.json`; novas gerações são recusadas pelo controle. Não apagar esse arquivo nem reiniciar orçamento automaticamente. Reexecuções posteriores do teste reutilizaram as respostas reais gravadas; não geraram consumo adicional.

Orçamento local conservador: US$ 0,05; teto de cinco requisições OpenRouter contando diagnóstico e catálogo, sem retry automático. O catálogo informou US$ 0,00000015/token de entrada e US$ 0,0000006/token de saída. Antes de cada geração reservou-se custo conservador considerando todo o contexto de 128 mil tokens de entrada e o teto de saída; após a resposta foi conferido usage.cost. Custo ausente, falha ambígua, reserva pendente, limite de chamadas ou orçamento interrompem novas requisições. O teto de saída foi **700 tokens por análise** (configuração só do processo de teste); respostas terminaram com finish_reason stop. Não se alterou orçamento/limite da conta no provedor; o diagnóstico não informou saldo total. O valor acima é custo de inferência informado, sem câmbio, taxas de compra de créditos ou promessa de preço comercial.

Referências oficiais de diagnóstico/catálogo: https://openrouter.ai/docs/api/api-reference/api-keys/get-current-key e https://openrouter.ai/api/v1/models . Registro sanitizado não inclui rótulo da chave, tokens de autenticação ou saldo agregado da conta.

## Imagem autorizada e resultados

Foto: `testes/fixtures/banana-evan-amos.jpg`, miniatura 330 × 291, Evan-Amos, Banana-Single.jpg, CC BY-SA 3.0. Fonte e atribuição: https://commons.wikimedia.org/wiki/File:Banana-Single.jpg ; licença: https://creativecommons.org/licenses/by-sa/3.0/ . Licença e descrição acompanham a fixture em `testes/fixtures/LICENCA_IMAGEM.md`. O teste enviou essa foto pelo seletor de galeria, pelo tratamento de imagem do aplicativo, BFF Node e OpenRouter. Nunca enviou chave ao navegador.

Reconhecimento: um alimento, nome “banana”, estimativa de parte comestível 120 g, 105 kcal, proteína 1,3 g, carboidrato 27 g e gordura 0,3 g. A identidade visual banana coincide com a referência da foto. O modelo não informou variedade/preparo inequívocos, portanto a correspondência automática com TACO foi recusada e a interface manteve selo IA. Isso é o comportamento conservador esperado.

A fonte da imagem não informa massa medida, tamanho físico ou peso comestível: **erro de porção não pode ser quantificado**. Não transformar os 120 g em verdade medida. Apenas como comparação ilustrativa, a estimativa equivale a 87,5 kcal/100 g; a referência local TACO ID 179, “Banana, nanica, crua”, tem 91,5 kcal/100 g: diferença −4,37%. Isso não comprova variedade, precisão visual ou adequação clínica.

A edição de 120 para 180 g recalculou 105 para 157,5 kcal, sem dupla escala. O resultado foi salvo, reaberto no histórico e editado novamente; reload preservou as duas refeições e os gráficos. Backup integral com imagem foi exportado/restaurado com refeições idênticas, em conta e armazenamento temporários de teste.

## Texto real e comparação nutricional

Entrada externa: “Vitamina preparada com 100 g de banana nanica crua e 100 g de leite de vaca integral, sem açúcar.”, quantidade total 200 g. A descrição completa não é uma correspondência local TACO e exigiu IA. O modelo retornou dois ingredientes de 100 g: banana nanica 89 kcal/P1,1/C23/G0,3 e leite integral 61 kcal/P3,2/C5/G3,3. Total: 150 kcal/P4,3/C28/G3,6. O backend validou schema, porções e somas.

A banana textual ficou −2,73% em kcal em relação ao ID 179 por 100 g, mas omitiu preparo no nome retornado; não ganhou selo TACO. O leite foi encontrado pelo nome, porém seus quatro campos nutricionais na base são null. O PDF oficial também usa asteriscos na composição centesimal dessa linha: não foram inventados números para preencher a lacuna. Referência: NEPA/UNICAMP, TACO 4ª edição, tabela 1, página impressa 55 (PDF página 57), alimento 458: https://nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/taco_4_edicao_ampliada_e_revisada.pdf#page=57 . O valor 61 kcal do leite continua identificado como estimativa de IA; não houve comparação numérica validável desse ingrediente com o registro incompleto.

A base mantém 597 nomes, dos quais 582 têm nutrientes utilizáveis pelos critérios atuais e 15 não podem ser usados automaticamente. Não são 597 referências completas. A lista está em `comparacao-nutricional.json`. A pesquisa local exata de arroz integral continuou calculando 200 g/247 kcal exibidas sem consumir API.

## Erros encontrados e correções

1. **Referência TACO incompleta interrompia resultado real.** A primeira geração textual teve HTTP 200 e foi interpretada no servidor, mas o cliente tentou substituir leite válido da IA por nutrientes null da TACO. Corrigidos `www/js/tacoSearch.js` e `captura.js`: identidade exata é separada de disponibilidade nutricional; referência incompleta não substitui valores, não ganha selo e a consulta direta oferece estimativa externa somente após ação explícita. Não se converteram ausências em zero. Dependentes, inclusive substituições, foram conferidos pelo Graphify/código.
2. **Campo opcional undefined bloqueava backup integral.** Respostas sem marca geravam propriedade marca_identificada undefined, preservada pelo IndexedDB e recusada pelo exportador. `nutricao.js` agora omite campos ausentes; `backup.js` normaliza propriedades undefined na cópia exportada, sem modificar o banco original ou converter NaN/null em nutrientes válidos. Testes provam restauração e preservação do registro legado original.
3. **Controle de tokens verificável.** `IA_MAX_TOKENS_ANALISE` aceita inteiro 128–1500, padrão 1500; teste usou 700. Valores inválidos falham antes do provedor. A integração aceita adaptadores internos de transporte/modelo para testar o BFF com respostas reais gravadas; nenhuma opção HTTP pública ativa esse modo.
4. **Ajuste do teste, não defeito comprovado do produto.** Após login em conta fictícia nova, o tutorial próprio da conta reaparece no reload; a jornada agora o dispensa como usuário. O primeiro teste também passou a sair de captura/resultados antes de trocar tela após falha.

As respostas reais 3 e 4 foram gravadas antes da validação e reutilizadas depois das correções. O texto ao vivo inicialmente falhou na UI; a foto ao vivo passou após a primeira correção. A execução final completa usa ambas as respostas reais em replay, com o mesmo código de backend/cliente, e mantém quatro requisições externas no total. Não se oculta a falha inicial nem se apresenta replay como nova geração ao vivo.

## Testes finais

- Node: **48 casos**, 47 aprovados, zero falhas, um Postgres opt-in ignorado. O mesmo caso passou separadamente em PostgreSQL 15 real isolado: 48 casos distintos aprovados ao considerar ambas as execuções.
- Regressão geral Playwright: **26 cenários**, zero falhas. IA e provedores simulados nessa suíte.
- Jornada adicional de homologação: **12 cenários**, zero falhas; resultados de duas gerações reais/replays, com conta/armazenamento fictícios. Inclui edição, gravação sem duplicação, reload, histórico/gráficos, backup/restauração, TACO sem consumo, plano bloqueado e erros simulados 401/429/503, JSON inválido e timeout. Nenhum pageerror capturado.
- Sintaxe: **67 arquivos** aprovados; build e scan público aprovados. Instalação frozen/offline + build/sintaxe em pasta limpa sem .env novamente aprovados. O auxiliar Windows mantém aviso Node DEP0190 já documentado, sem falha do build.
- Carga local repetida: 200 pedidos, concorrência 10, 90 respostas 200, 110 respostas 429 e zero 5xx; p95 211,51 ms. Não mede Vercel/Supabase, IA sob carga, usuários reais ou custo de escala.
- As dependências não mudaram nesta rodada; a auditoria anterior reportou zero vulnerabilidades. O auditor premium strict tem 53 alertas de reconhecimento de bindings externos documentados na etapa anterior, não uma aprovação automática. Não há certificação integral de acessibilidade.

## Segurança, integrações e limites

A chave atual é diferente da encontrada no histórico Git. Nenhuma das duas foi encontrada nos assets atuais de www ou na cópia legada web; configuração privada legada não é servida. HTML, localStorage/sessionStorage/cookies acessíveis ao JavaScript e respostas backend foram conferidos sem conter a chave. A antiga não foi usada em nenhum diagnóstico: sua **revogação continua não verificada e deve ser confirmada no provedor**. O histórico Git não foi reescrito.

Somente a chave OpenRouter está preenchida no .env local. Faltam APP_ORIGIN de homologação, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RATE_LIMIT_SALT, quotas e orçamento de imagens, CRON_SECRET e credenciais/preço/webhook Stripe test. Não foram inventadas credenciais, criadas contas remotas ou enviadas mensagens.

Supabase Auth/Storage, SMTP/recuperação real, sincronização cloud, exclusão cloud, Stripe sandbox, monitoramento e restauração de objetos privados continuam pendentes de ambiente. SQL/RLS/CAS/quotas e recuperação fictícia passaram localmente, sem equivaler a serviços hospedados homologados. Planos reais continuaram bloqueados com 403; estrutura/matemática/persistência dos rascunhos são testadas com fixtures. Nenhuma proteção nutricional, aplicação automática de metas ou cobrança real foi ativada. Compatibilidade medida é Chrome headless com viewports móveis/desktop; aparelho físico, Safari/iOS, outros motores e leitor de tela real ainda pendentes. LGPD e revisão nutricional continuam exigindo responsáveis humanos e contratos/políticas aprovados.

O arquivo aberto no IDE `web/index.html` é legado; a fonte ativa permanece `www/index.html` e `www/telas/`. O comando normal --simulado continua usando IA fictícia. A validação real foi feita pelo harness isolado; não significa que fornecer só a chave configure uma instalação comercial, que ainda exige Supabase e demais variáveis.

## Evidências e próximos passos

Diretório: `evidencias/homologacao-real/`. Arquivos principais: controle.json, resposta-3.json, resposta-4.json, interpretado-texto.json, interpretado-foto.json, texto-interface.json, foto-interface.json, foto-porcao-editada.json, comparacao-nutricional.json, backup-com-respostas-reais.json, resultado-interface.json, regressao-interface.json, unitarios.log, postgres.log, seguranca-credenciais.json, fonte-limpa.json, carga.json e screenshots texto-real.png/foto-real.png/historico-real.png. Somente dados de teste e fotografia licenciada. Evidências são locais/ignoradas pelo Git; preservar separadamente ao transportar a entrega.

Os relatórios anteriores receberam atualização datada. Para continuidade: confirmar revogação antiga; preencher serviços de homologação conforme ARQUITETURA_ATUAL.md; validar e-mail, dois usuários reais de teste e dois dispositivos, Storage privado, conflitos e restauração cloud; configurar Stripe exclusivamente test; definir preços/quotas/custos e alertas; obter revisão jurídica/nutricional; executar CI remoto e matriz de dispositivos; revisar release/gitlink antes de publicação. Não repetir IA paga sem uma nova autorização e orçamento de rodada.

**Demonstração privada: APTO COM RESTRIÇÕES.** Há prova limitada de IA real e fluxo funcional após correções, em ambiente controlado, sem acurácia clínica comprovada.

**Piloto com clientes reais: NÃO APTO.** Serviços remotos, revogação anterior, privacidade, nutrição e operação não foram homologados.

**Lançamento em larga escala: NÃO APTO.** Além dos bloqueadores do piloto, faltam carga cloud, economia do produto, monitoramento/recuperação, suporte e compatibilidade/acessibilidade ampliadas.
