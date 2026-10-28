# NutriFoto Web 0.3.4 — Premium de demonstração local

28/10/2026. Somente Web local; sem deploy, APK, EXE, pagamento ou modificação de licença comercial. Este relatório atualiza o parecer Web 0.3.3: texto agora foi aprovado com IA real.

## Usar

- URL: http://127.0.0.1:4173/ (servidor em execução).
- Comando único: `pnpm demo`, na pasta nutrifoto. Node 24.22.1 testado.
- Estado: **Plano Premium — Demonstração Local**, confirmado pelo backend; dispensa Pix, Android e código.
- Configurações → Metas e resumo com IA; Meu Plano → perfil e sugestões gerais; Nova refeição → Foto/Texto. Ciência de envio é necessária para a API.

## Alterações

- Adaptador Node isolado controla Premium explicitamente, restrito a loopback e recusado em produção. Não participa do bundle do Worker, não altera Supabase/Asaas nem cria licença comercial. Reiniciar com o comando mantém habilitação local.
- Liberados cinco módulos gerais: foto, texto, rascunho alimentar, metas revisáveis e resumo do diário. Adultos com gestação, amamentação, condições clínicas ou restrições que exigem avaliação continuam bloqueados.
- Reutilizados backend OpenRouter, perfil, rascunhos, banco local, TACO e padrões visuais. Nenhum novo provedor/dependência foi instalado. Modelo: openai/gpt-4o-mini.
- Plano: porções editáveis com recálculo e persistência; substituições TACO preservadas. Corrigida incompatibilidade de categorias retornadas pela IA (cereal, proteína e laticínio), sem remover filtros alimentares.
- Metas/resumo: schema JSON estrito. Corrigida ambiguidade de chave traduzida e água em litros; unidades agora são explícitas em mililitros. Valores inválidos são recusados; nenhuma conversão de unidade é presumida.
- Metas só se aplicam após edição/revisão e confirmação; cancelar preserva metas anteriores. Resumo utiliza agregados reais dos últimos sete dias registrados e informa a limitação dos dados.
- Corrigida mensagem de servidor local indisponível na consulta Premium. Orçamento e licença são estados diferentes.

## IA real e interface

| Módulo | Resultado comprovado |
|---|---|
| Foto | Análise real anterior de banana recuperada com aviso, sem nova chamada: 120 g, 105 kcal. Seleção, edição, salvamento e diário testados. Não é geração nova nesta rodada. |
| Texto | Nova chamada real: pão integral e ovo cozido, total 218 kcal, P 12 g, C 29 g, G 7 g. Resultado editável e salvo. |
| Meu Plano | Nova chamada real: quatro refeições, 1.756 kcal no rascunho. Visualização, substituição TACO, ajuste de porção, recálculo, persistência e backup aprovados. Não é validação clínica ou garantia de adequação individual. |
| Metas | Nova chamada real aprovada após correção do schema: 2200 kcal e 2500 ml na sugestão. Cancelamento, edição da água para 2.600 ml, confirmação e reload aprovados. |
| Resumo | Nova chamada real baseada nos agregados enviados do diário; exibida, preservada e recuperada após reinício. Não houve fabricação de registros. |

As primeiras respostas de metas/resumo foram recusadas. Nenhum sucesso foi simulado para escondê-las: foram corrigidas e repetidas com autorização adicional.

## Testes e persistência

- Node: **86 testes, 84 aprovados, dois PostgreSQL ignorados**. Contratos de schema, unidades, categorias, filtros, CSRF, orçamento e impossibilidade de concessão Premium no Worker incluídos. Provedor fictício usado somente nos unitários.
- Regressão Web local: 30 grupos, 24 funcionando, cinco bloqueados corretamente e um parcial (falha local/offline testada; falha interna Supabase não simulada). Inclui perfil, temas 320/390/768/1440, TACO, refeições, edição/exclusão, histórico, água, peso, gráficos, metas manuais, backups e offline.
- Metas: teste adicional de interface com fixture explicitamente identificada, separado da aprovação com provedor real.
- Reinício real do servidor: Premium ativo, metas/resumo anteriores recuperados com aviso e nova consulta não autorizada recusada. Refeições, perfil, plano e metas mantidos.
- Build Workers dry-run e quatro grupos workerd aprovados; produção continua usando regras comerciais. Nenhum domínio hospedado foi utilizado como substituto da demonstração local.
- Capturas finais inspecionadas: licenca-local.png, plano-real.png, metas-resumo-aprovados.png, plano-substituicao-porcao.png e reinicio-premium.png em evidencias/premium-local/.

## Orçamento e limites reais

Foram autorizadas cinco novas tentativas (US$0,025) e duas de revalidação (US$0,01), além das três da rodada anterior. O ledger mantém **10 tentativas históricas**, sete resultados concluídos e três reservas de chamadas recusadas sem custo conciliado. Custo comprovado acumulado dos resultados concluídos: **US$ 0.00160845**. Isso não é o custo exato das três falhas: permanecem reservados conservadoramente até US$0,0108, sem devolução por tempo/reinício. O controle da rodada antiga não foi alterado.

**As autorizações de novas chamadas estão encerradas.** O servidor foi reiniciado sem flag financeira. Os cinco módulos permanecem acessíveis; consultas novas exigem autorização adicional. Resultados reais já guardados podem ser recuperados sem gasto, identificados na interface. Premium não promete IA gratuita/ilimitada. Não apagar o ledger privado para contornar limites.

## Roteiro e evidências

1. Execute o comando e abra a URL. Se houver aviso de atualização, aplique pela interface, sem apagar dados.
2. Mostre o selo Premium e a tela Seu NutriFoto, sem cobrança.
3. Use o próprio perfil/diário ou importe `evidencias/premium-local/backup-premium-final.json`: dados de teste, refeições e plano realmente obtidos.
4. Demonstre edição, TACO, porções, substituições, histórico, água/peso, metas e exportação.
5. Para recuperar resultados anteriores, conserve o perfil e registros do exemplo. Foto: testes/fixtures/banana-evan-amos.jpg; texto: “Sanduíche de duas fatias de pão integral com um ovo cozido”. Selecione estimativa IA se a TACO oferecer alternativas. Modificar perfil/descrição/registros pode exigir uma consulta nova, sujeita a orçamento.

Evidências: evidencias/premium-local/ia.json, revalidacao-real.json, reinicio.json, plano-interacoes.json, resultados.json, controle-financeiro.json, node-final.log e scripts de navegador. Credencial somente no servidor; ledger fora do Git.

Não foram homologados pagamentos/serviços Supabase externos, aparelhos físicos ou uso clínico. Nenhuma avaliação de adequação nutricional individual foi declarada. Nesta missão, não foi refeita a suíte legada refinamento, previamente incompatível com o fluxo antigo de login; os fluxos atuais foram testados separadamente.
