# Integração Groq — NutriFoto Web 0.3.4

28/10/2026. Demonstração local, sem deploy, APK, EXE ou novas chamadas OpenRouter.

- URL: http://127.0.0.1:4173/ — inicialização: `pnpm demo`.
- Groq é o provedor padrão local. Adaptador com `fetch`, modelo consultado na conta, formatos JSON existentes, validação nutricional preservada e nenhum fallback automático.
- Modelo efetivamente utilizado: `qwen/qwen3.8-27b`, ativo no GET `/models`. Capacidades de imagem/texto e schema estrito conferidas na documentação oficial: [modelo](https://console.groq.com/docs/model/qwen/qwen3.8-27b), [JSON estruturado](https://console.groq.com/docs/structured-outputs).
- Correção prática: saídas curtas limitadas a 700 tokens para metas e 1.200 para resumo; plano mantém 3.500. Os módulos curtos passaram após recusas 429. Espera persistente considera Retry-After e resets, incluindo milissegundos, sem repetição automática.
- Ledger Groq independente, reserva transacional, deduplicação, resultado recuperado identificado, limite local configurável de 20 tentativas/dia UTC e bloqueio de resultados incertos. OpenRouter permaneceu byte a byte igual ao hash registrado antes desta missão. Controle financeiro histórico também preservado.
- Verificação de distribuição passou: nenhuma chave privada atual encontrada nos assets Web ou bundle Workers. Scanner público passou a reconhecer também o padrão de chave Groq. Nenhuma dependência adicionada.

## Cinco operações reais pelo navegador

| Módulo | Resultado validado | Tokens |
|---|---|---:|
| Foto | Fotografia real de banana, primeira execução Groq deste arquivo; alimento reconhecido, porção editada para 150 g e refeição salva | 1.611 |
| Texto | Sanduíche integral com ovo; alimentos/macros estruturados e refeição salva | 455 |
| Meu Plano | Rascunho para adulto elegível; edição de porção, recálculo e substituição TACO salvos | 2.455 |
| Metas | kcal, g e ml validados; cancelar preservou dados, edição e confirmação salvaram meta de água em 2.600 ml | 362 |
| Resumo | Baseado nas duas refeições efetivamente registradas; texto exibido e persistido | 213 |

Total das cinco gerações concluídas: **5.096 tokens**, sem cache ou respostas simuladas nessas aprovações. Houve ainda quatro solicitações recusadas por 429; a tentativa de resumo durante a pausa foi bloqueada antes do provedor. Ledger mantém nove reservas, cinco concluídas e quatro limitadas; não foi apagado. Reexecuções de cache após reinício foram identificadas separadamente e não geraram novas chamadas. A foto foi selecionada pelo navegador a partir da fixture existente, sem captura física de câmera nesta missão.

## Free, limites e configuração privada

O proprietário confirmou a organização no plano Free pelo painel. Isso é uma confirmação humana, **não uma consulta automática de faturamento**; GET `/models` confirma somente modelo/disponibilidade. A integração não compra créditos, não troca o plano e não chama OpenRouter automaticamente. O custo zero registrado decorre dessa confirmação de Free, não de um extrato financeiro retornado pela API.

Cabeçalhos reais identificaram **1.000 requisições/dia e 8.000 tokens/minuto**. Outros limites podem existir; os valores públicos da documentação não foram apresentados como medição da conta. [Documentação de limites](https://console.groq.com/docs/rate-limits) e [faturamento](https://console.groq.com/docs/billing-faqs).

No `.env` privado da raiz: `IA_PROVEDOR=groq`, `GROQ_API_KEY`, `GROQ_MODELO=qwen/qwen3.8-27b`, `GROQ_PLANO=free`, `GROQ_FREE_CONFIRMADO_EM=<ISO UTC da confirmação>` e, opcionalmente, `GROQ_LIMITE_LOCAL_DIA=20`. A chave foi normalizada do nome antigo para `GROQ_API_KEY`, sem divulgá-la. Após confirmar novamente no painel, o operador atualiza a data privada e reinicia `pnpm demo`; a aplicação não renova essa confirmação sozinha. Alterar o plano da organização durante a janela não é detectável pelo endpoint de modelos: interrompa a demonstração e revalide antes de usar outra modalidade/chave.

## Testes e evidências

- Node: **91 aprovados, zero falhas, dois PostgreSQL ignorados** (93 casos).
- Chrome/Playwright local: cinco módulos reais acima; duas refeições, perfil, plano, metas e resumo recuperados após reiniciar o servidor e reabrir o navegador. Substituição TACO e cache identificados conferidos após reinício.
- Regressão Web: 30 grupos, sendo 24 funcionais, cinco bloqueios corretos e um teste parcial de indisponibilidade/offline. Sem defeitos reproduzidos nesses grupos. O grupo parcial não homologou Supabase. Galeria/seletor de câmera foram exercitados; não câmera física.
- Falhas controladas, sem usar credenciais inválidas contra a API real: chave ausente/recusada, Free ausente/expirado, modelo indisponível, conexão, JSON inválido/incompleto, limites, pausa, ausência de consentimento, restrições clínicas, concorrência, idempotência e persistência do ledger. A limitação 429 também ocorreu realmente.
- Workers: build Wrangler sem publicar e quatro grupos de API/interface/PWA no workerd local aprovados. Compatibilidade do adaptador compilada; não houve geração Groq hospedada em Worker, nem ativação do Premium local no Worker.
- Evidências: `evidencias/groq/resumo-validacao.json`, `ia.json`, `revalidacao-real.json`, `reinicio.json`, `resultados.json` e screenshots. Backups e perfis de teste são isolados, com dados fictícios.

Pendente: manter Free confirmado e respeitar as cotas compartilhadas da organização. Android, EXE, deploy e testes PostgreSQL não foram executados nesta missão. A revogação da antiga chave OpenRouter historicamente exposta continua dependendo do proprietário; ela não foi usada aqui.

## Teste na aba existente do proprietário — 28/10/2026

O clique foi reproduzido na aba real do aplicativo. Ela ainda executava assets 0.3.2 em cache e mostrava o bloqueio antigo da demonstração Web. Perfil salvo pela interface, atualização disponível aplicada pelo fluxo oficial para 0.3.4, autorização de envio da análise solicitada habilitada e botão Gerar rascunho acionado. Groq concluiu uma nova geração; a interface exibiu “Rascunho salvo para revisão” e quatro refeições editáveis. Nenhum código foi alterado nesta verificação, nenhum dado local foi apagado e nenhuma meta foi aplicada. Aba deixada aberta no resultado. Evidências: `evidencias/groq/rascunho-aba-usuario.json` e `rascunho-aba-usuario.png`. Esta geração adicional não integra a contagem original dos cinco módulos acima. O resultado é estimativo e permanece sujeito à revisão profissional.
