# Contrato de interação do NutriFoto

Controles indisponíveis por licença, ambiente ou restrição clínica permanecem acionáveis para explicar a causa, sem executar a operação bloqueada. Somente operações em andamento desabilitam temporariamente seus controles para impedir duplicação. A tela de ativação oferece escolha de plano e Pagar com Pix antes da ativação; na Web demonstração explica a indisponibilidade sem criar cobrança ou Pix fictício.

Ativação Android 0.3.0: navegação de conta/assinatura leva a `ativacao`; Auth antigo permanece como infraestrutura de compatibilidade, sem cadastro obrigatório na experiência. Chave EC não exportável no Android Keystore, assinatura de desafio único e atestado validado no servidor. Licença e prazo pertencem ao backend; offline preserva consulta local/backup, sem conceder recursos pagos. Pix sandbox confirmado por consulta ao Asaas, nunca por comprovante. Recuperação usa segredo de 256 bits, invalida o aparelho anterior e não transfere dados alimentares automaticamente; estes usam o backup. Não trocar plano durante vigência; renovação do mesmo plano acumula 30 dias. Estorno/reembolso, inclusive parcial, suspende licença creditada até revisão autorizada. Nenhuma liberação de planos clínicos/metas automáticas.

Fonte: missão de comercialização do proprietário, requisitos TXT e auditoria A01–A28. Público adulto, pt-BR; planos personalizados aguardam homologação profissional. Nenhuma decisão jurídica é inferida pelo frontend.

Refinamento atual: perfil pode ser salvo independentemente da geração, com `validarPerfil({paraPlano:false})`, preservando condições e declarações de saúde. Rascunhos não salvos usam o namespace da conta na sessão; salvar persiste localmente e agenda a sincronização existente. Geração segue a disponibilidade declarada pelo servidor (mesma configuração já usada na validação de IA), conta, ciência contextual e restrições de domínio. O EXE local não oferece geração. Aplicar metas permanece bloqueado e não aparece como ação ativa. A declaração de acompanhamento não remove os bloqueios clínicos.

Substituições são oferecidas somente quando há alternativa validada para o perfil. Falha/cancelamento conserva o plano anterior; salvar troca usa cópia validada e verifica a conta antes de persistir. Editar e voltar ao rascunho compartilham um único controle no cabeçalho. Assinatura, checkout e portal permanecem na tela de assinatura existente, sem mudar valores ou contratos financeiros.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | select nativo | UX-CONTRACT.md | sexo, atividade, objetivo | teclado e popup |
| Date | input time nativo | UX-CONTRACT.md | lembrete de página ativa | fuso e teclado |
| Form | validações de domínio | nutricao.js e dadosValidacao.js | perfil, conta, metas | E2E |
| Toast | avisar | base.js | erro e sucesso | live region |
| CRUD | db.js | contrato de dados | legado e conta | testes de transação |

| Capacidade | Responsável canônico | Variações | Verificação |
|---|---|---|---|
| Formulários | HTML nativo + validação de domínio nutricao.js/dadosValidacao.js | conta, perfil, metas | erro textual, foco e teste E2E |
| Select/Listbox | select nativo do navegador | atividade/sexo/objetivo/refeições | teclado e popup nativo |
| Date/time | input time nativo, datas de registro localDate | lembretes com app aberto | fuso e teclado |
| Scrollbar | style.css global | main/dialog | largura móvel e rolagem |
| Toast | região #toast + toast compartilhado | sucesso/erro/status | aria-live |
| Diálogo | elementos.js prepararDialogo/confirmarAcao | edição, troca, exclusão | Escape, ciclo de foco, retorno |
| CRUD | db.js e API dados | legado local ou namespace conta | criar, reabrir, cancelar, editar, apagar |
| Sincronização | sincronizacao.js + CAS servidor | local/remoto/mesclar | conflito 409 nunca sobrescrito sem escolha |

Estado de criação: validar→ocupar→persistir→retornar ao dono→avisar; falha mantém formulário. Exclusão exige confirmação e nunca migra automaticamente dados antigos. Importação mescla por padrão e explicita conflito. Sessões pertencem ao servidor; UI não guarda credenciais nem tokens Auth. IA pede ciência contextual, valida deterministicamente e mostra estimativa. Lembretes são de página ativa e não são apresentados como push garantido. Alterações de domínio são centralizadas, não implementadas por tela.

Navegação usa um HTML por tela montado pela camada navegação. URLs ?tela= preservam abertura direta e voltar/avançar sem recarregar. Estado de captura não é apagado ao trocar abas; rascunhos não são enviados silenciosamente. Contas diferentes trocam também IndexedDB e chaves de preferências. Exportação contém informações pessoais e exige cuidado de armazenamento.

## Fluxos comerciais acrescentados em 22/10/2026

Autoridade: missão definitiva do proprietário; IMPLEMENTACAO_COMERCIAL.md F01–F26; contratos em servidor/comercial.js, custos.js e assinatura.js. Preços finais, retenção de imagens e documentos jurídicos continuam pendentes de aprovação; a UI não inventa esses valores.

| Operação | Responsável | Ocupado / sucesso / falha | Evidência |
|---|---|---|---|
| Confirmar e-mail | conta.js + Supabase Auth | recolhe TokenHash do fragmento em memória; bloqueia repetição; consulta sessão; erro inline preserva tentativa | comercial-interface e SupabaseHTTPS |
| Consultar assinatura | assinatura.js + API assinatura | status de consulta; capacidades do servidor; resposta antiga não cruza contas; erro inline e botão atualizar | comercial-interface |
| Checkout/portal | API assinatura | servidor escolhe Price ID e intenção; botões desabilitados durante pedido; erro persistente e retry; URL nunca concede plano | comercial-interface/backend |
| IA interrompida | servicoHttp.js + chavesIa.js | intenção durável antes de fetch; erro/JSON interrompido conserva UUID;24h exige conciliação | dados.browser |
| Atualizar PWA | atualizacao.js + confirmarAcao | aviso dentro de Configurações, sem cobrir ações; cancelar conserva rascunho; confirmar ativa e recarrega | pwa-atualizacao |
| Abrir registro de peso | painel.js abrirRegistroPeso | foco imediato; preenchimento tardio não substitui digitação nem atravessa troca de conta | interface geral |
| Reabrir offline | continuidadeConta.js + conta.js | UUID seleciona somente cópia local; sessão continua não autenticada até revalidação; logout remove lembrança | continuidade-interface |
| Troca de conta em outra aba | servicoHttp.js + BFF | conta esperada capturada antes de await; precondição divergente nega antes da operação e limpa contexto antigo | continuidade-interface + backend-multiabas |

O select de período mantém o controle nativo já adotado no projeto. Nova tela e aviso usam classes/tokens existentes; não há nova paleta nem componente de diálogo paralelo. Minutas documentais fora de www não são publicadas pelo build.

Ativação do proprietário: formulário nativo em details da tela de ativação; usa licenca.js/executar e o mesmo alerta #licenca-erro. Limpa o código ao enviar, nunca o persiste; status vem do backend assinado. Web explica a restrição Android. Concessão, recuperação e revogação pertencem às RPCs de licença, sem compartilhar o código administrativo com recuperação de compra. Catálogo permanece central em licenca-politica.js; Meu Plano não promete geração enquanto bloqueada.

Premium de demonstração local (28/10/2026): servidor Node explícito em loopback é dono de premiumLocal/licencaLocal; o navegador apenas apresenta essa capacidade. Quando ativa, a tela existente Seu NutriFoto mostra “Plano Premium — Demonstração Local” sem Pix/código/Android. Fora desse adaptador, o comportamento comercial permanece. Sugestões gerais reutilizam o rascunho de Meu Plano; porções são editáveis e recalculadas, com substituições do catálogo TACO e filtros preservados. Metas/resumo usam details, diet-field, botões e confirmarAcao existentes em Configurações. Metas exigem revisão explícita; cancelamento conserva valores. Dados de IA entram por textContent; resultados recuperados são identificados. Ocupação impede duplicações; falhas preservam dados e explicam configuração, rede, orçamento ou restrição clínica. Nenhuma nova paleta foi criada.

Apresentação Premium local (28/10/2026, decisão do proprietário): o adaptador local continua identificado internamente por premiumLocal; a interface exibe “Plano Premium” e “Seu Premium”, sem avisos de demonstração ou comandos de execução. Painel usa texto discreto api-key-help no lugar do cartão diet-disclaimer. Captura conserva ciência de envio, estimativa e revisão. A tela de acesso informa apenas capacidades realmente liberadas, sem inventar pagamento, prazo ou vínculo Android. Avisos de simulação/replay, falhas e restrições clínicas continuam obrigatórios quando aplicáveis. O comportamento comercial fora de premiumLocal permanece.
