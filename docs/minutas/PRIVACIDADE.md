# Minuta de privacidade — não aprovada para publicação

Versão técnica de 22/10/2026. Preencher e revisar com profissional antes de oferecer o serviço. Responsável pelo tratamento, identificação do fornecedor, contato de privacidade e suporte: **pendentes do proprietário**. Este texto descreve o código; não determina base legal nem comprova conformidade.

O NutriFoto é um diário alimentar para adultos. Sem conta, refeições, água, peso, perfil, metas e preferências ficam no navegador. Entrar cria um espaço separado por conta; copiar registros anteriores exige escolha explícita. Sair encerra a sessão, mas conserva dados locais da conta para uso posterior. Em dispositivo compartilhado, use também a opção de apagar dados locais. O navegador não é armazenamento criptografado pelo aplicativo.

Para reabrir o diário sem conexão, o navegador lembra apenas o UUID da última conta verificada. Isso seleciona a cópia local, sem criar autenticação ou liberar acesso remoto. Sair, excluir ou invalidar a sessão remove essa lembrança. Antes de sincronizar, a conta precisa ser revalidada; mudança de titular em outra aba bloqueia a operação antiga.

Na sincronização, o servidor recebe registros, preferências e imagens associadas. O Supabase mantém autenticação, banco e bucket privado. Dados alimentares, peso, características físicas e restrições podem revelar saúde; a avaliação de dados sensíveis e sua base legal precisa de revisão específica. A indicação de ciência sobre IA é uma proteção técnica contextual, não uma autorização jurídica abrangente.

A análise envia o texto ou a imagem fornecidos ao OpenRouter e ao provedor que executar o modelo `openai/gpt-4o-mini`. A configuração solicita provedores que não coletem dados para treinamento, mas isso depende do atendimento do provedor e não equivale a garantia de retenção zero. Fotografia não mede massa nem certifica alergênicos. Não inclua rostos, documentos, nomes ou informações de terceiros. O resultado estimado pode ser corrigido antes de salvar.

Quando configurados, Vercel hospeda o aplicativo e Stripe processa assinatura. O NutriFoto recebe identificadores de cliente/assinatura, situação e eventos financeiros; não recebe os dados completos do cartão pelo seu formulário. A implementação atual aceita somente sandbox e não habilita cobranças reais.

| Destinatário previsto | Finalidade | Confirmar antes da oferta |
|---|---|---|
| Supabase | Auth, Postgres, Storage | região, contrato, subprocessadores, retenção de Auth/backups |
| Vercel | hospedagem e logs | região, logs de acesso, prazos e acesso administrativo |
| OpenRouter e provedor do modelo | inferência de texto/imagem | roteamento, países, contrato, política de conteúdo e retenção |
| Stripe | assinatura e eventos financeiros | entidade contratante, retenções financeiras, fluxo de direitos |
| Provedor SMTP a definir | confirmação e recuperação | domínio, operador, destinatários, retenção e país |

Transferências internacionais podem ocorrer. Não foram definidos país, mecanismo ou instrumento contratual desta operação; validar esses pontos com os provedores e assessoria antes da publicação.

Registros de usuário permanecem até exclusão solicitada. Resultados temporários de IA, eventos e contadores têm limpeza administrativa; o ledger conserva evidência mínima de operações para impedir nova cobrança e controlar orçamento enquanto a conta existir. Na exclusão, dados vinculados à conta são removidos por cascata, mas o total financeiro mensal agregado sem identidade não é reduzido. Métricas HTTP são agregadas por minuto/rota/status/latência, sem conteúdo alimentar ou identidade, com retenção configurável. Os padrões técnicos não são prazos legais aprovados. Backups externos, logs de infraestrutura e registros dos fornecedores têm políticas próprias ainda a aprovar.

Exportar gera arquivo pessoal com imagens e dados do diário; guarde-o em local seguro. Alterar refeições e perfil corrige os dados que serão sincronizados. A exclusão remota exige encerramento prévio de assinatura vigente, bloqueia novas operações, remove imagens e só então apaga a conta. Uma falha parcial exige retomar a exclusão. Cópias locais de outros dispositivos e backups exportados pelo usuário não são apagados remotamente.

Antes da oferta, definir canal autenticado para pedidos de acesso, correção, portabilidade, informação, oposição e eliminação quando aplicáveis; validar identidade com o mínimo de dados, registrar protocolo sem conteúdo de saúde e encaminhar solicitações aos operadores. Direitos e exceções devem ser avaliados caso a caso. Não inventar prazo de resposta ou retenção obrigatória.

Fontes para revisão: [LGPD, texto compilado](https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm), [ANPD: titular de dados](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados), [ANPD: agentes de tratamento](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_agentes_de_tratamento_e_encarregado___defeso_eleitoral.pdf). Estes documentos fundamentam a revisão necessária; não constituem aprovação desta minuta.
