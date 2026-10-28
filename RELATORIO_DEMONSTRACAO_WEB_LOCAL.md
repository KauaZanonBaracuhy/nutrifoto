# NutriFoto — demonstração Web local

Data: 28/10/2026. Versão local 0.3.3. **Entrega parcial: foto real aprovada; análise textual real ainda não aprovada. A missão não está concluída pelo critério de aceitação.**

## Executar

- URL: http://127.0.0.1:4173/ (servidor deixado em execução).
- Inicialização única na pasta nutrifoto: `pnpm demo`. Requer Node com node:sqlite (testado neste computador) e as dependências já instaladas. Lê a chave do .env somente no backend e prepara os assets; não publica nem gera instaladores.
- Sem configuração de banco hospedado, foi priorizado Node local. Wrangler/workerd continua como verificação de compatibilidade; o modo proprietário local não é incorporado ao Worker.

## Alterações desta rodada

1. Adicionados scripts/iniciar-demonstracao.js e comando demo. O servidor local ganhou uma opção explícita de demonstração real, independente do simulador existente. Dados alimentares/namespace locais foram preservados.
2. Adicionado servidor/demonstracao.js, exclusivo de loopback, com conferência de Host/origem, cookie HttpOnly/SameSite Strict, CSRF, ciência de envio, validação de entradas e bloqueio clínico. A sessão local declara iaLocal, sem usuário fictício, sem licença paga inventada e sem alterar o vínculo Android.
3. Ledger SQLite privado registra intenções antes do envio, guarda resultados e limita tentativas de forma atômica/persistente. Custo desconhecido/falha não libera a tentativa. Reiniciar não reinicia orçamento. Recuperações por conteúdo são identificadas como análise real anterior, sem nova chamada.
4. Reutilizados executarIA, validação nutricional e modelo fixo openai/gpt-4o-mini via OpenRouter. Na demonstração usa-se detalhe visual low, saída limitada a 1.500 tokens e preços máximos de entrada/saída 0,15/0,60 USD por milhão. Entrada textual é limitada por bytes; a reserva conservadora específica desta entrada fica abaixo de US$0,0024 por tentativa (até três = US$0,0072). Os limites conservadores do backend comercial original não foram reduzidos. Referência de imagem low: [documentação oficial](https://developers.openai.com/api/docs/guides/images-vision).
5. Ajustado o transporte Web para aceitar a capacidade local declarada pelo servidor e manter idempotência sem criar conta falsa ou mudar armazenamento alimentar.
6. Corrigido Salvar refeição sem alimentos: agora explica o impedimento em vez de retornar silenciosamente.
7. O prompt textual agora explicita análise de descrição, mantendo o contrato JSON de entrada. Essa alteração passou em testes de contrato, mas **não foi revalidada com chamada real**, pois o limite autorizado já tinha sido consumido.

## IA real — resultados e limite financeiro

Foram autorizadas inicialmente duas chamadas e, em seguida, uma terceira. Teto acumulado: US$0,01. Realizadas **3 tentativas**, gasto comprovado **US$ 0.00058785**; nenhuma quarta chamada.

| Entrada real | Resultado | Custo USD |
|---|---|---:|
| Foto banana-evan-amos.jpg | Banana: 120 g, 105 kcal, P 1,3 g, C 27 g, G 0,3 g. Porção editada para 150 g, refeição salva e consultada após reload. | 0,00049695 |
| Texto sobre vitamina de banana e leite | API retornou lista vazia; não aprovado como análise textual funcional. | 0,00004515 |
| Texto sobre sanduíche de pão integral e ovo | API retornou lista vazia; não aprovado. | 0,00004575 |

O servidor permanece sem autorização para novos gastos. A foto anterior pode ser recuperada sem nova cobrança, com aviso visível. Isso é recuperação de uma análise real, **não uma análise nova**. Descrições/imagens novas dependem de autorização adicional; não foi apagado ou reiniciado o ledger para contornar esse bloqueio. O controle financeiro da rodada antiga permanece intacto.

## Testes

- Node: 83 testes, 81 aprovados e dois PostgreSQL ignorados. Inclui teste de contrato do novo modo com transporte explicitamente fictício: CSRF, clínica, orçamento, persistência, concorrência transacional/idempotência e recuperação. Nenhuma IA real é alegada por esse unitário.
- Navegador real no Node local: 32 grupos — 23 funcionando, sete bloqueados corretamente, um parcial e um não testado. Dados fictícios em perfis isolados. Sem respostas de sucesso fabricadas nessa execução.
- Foto real: seleção, backend/provedor, revisão de porção, salvamento, histórico, reload, reinício do servidor e recuperação identificada aprovados. Backup real baixado: evidencias/demonstracao-web/backup-demonstracao-real.json.
- Lista real vazia: testado novamente sem gasto, usando o resultado anterior; botão Salvar explicou a causa e não criou refeição.
- Workers: build dry-run aprovado e quatro grupos do workerd aprovados; sem deploy.
- Licenças: 10 grupos Web aprovados com fixtures de API/ponte Android explicitamente identificadas. Não são homologação Android, Asaas ou ativação real.
- Suíte legada test:refinamento: um grupo passou e o seguinte falhou porque ainda exige botão clínico disabled, contrariando a regra atual de permitir clique para explicar o bloqueio. Os grupos posteriores dessa suíte não executaram; o resultado não foi declarado aprovado nem o bloqueio clínico removido. Os fluxos atuais de perfil/gestação foram exercitados separadamente na matriz abaixo.
- Nenhum APK, EXE, instalador, deploy, cobrança Asaas ou alteração de saldo foi realizado. Android não testado nesta missão. Supabase/Asaas externos não configurados, portanto não homologados.

### Matriz local

| Fluxo | Estado | Evidência observada |
|---|---|---|
| W01 Primeiro acesso, tutorial e reinício do tutorial | FUNCIONANDO | Tutorial reaberto e dispensado por clique; primeiro acesso ocorreu em perfil isolado. |
| W02 Navegação e teclado | FUNCIONANDO | Quatro abas e Enter na navegação responderam. |
| W03 Temas, responsividade móvel/desktop e telas auxiliares | FUNCIONANDO | 320/390/768/1440 px sem overflow horizontal; tema conservado no reload. Não são dispositivos físicos. |
| W04 Entrada vazia explica a pré-condição | BLOQUEADA CORRETAMENTE | Foto e texto vazios explicados sem executar IA. |
| W05 Busca TACO e porção de 200 g | FUNCIONANDO | Arroz integral cozido localizado sem IA; 200 g = 247 kcal. |
| W06 Salvar refeição, calorias/macros e indicador de sequência | FUNCIONANDO | Uma refeição salva pela interface; resumo 247 kcal e sequência 1 dia. |
| W07 Edição e cancelamento de alterações | FUNCIONANDO | Cancelar preservou o nome; salvar nova porção atualizou o resumo. |
| W08 Cadastro manual, validação negativa e remoção de alimento | FUNCIONANDO | Inclusão manual no editor funciona; calorias negativas recusadas e alimento removido. |
| W09 Histórico, expansão e edição por teclado | FUNCIONANDO | Refeição presente; expansão e editor acessíveis com Enter/Escape. |
| W10 Água e peso | FUNCIONANDO | 300 ml e 75,2 kg registrados por clique. |
| W11 Gráficos com dados | FUNCIONANDO | Gráficos de calorias, proteína e peso abertos com registro alimentar e peso fictícios. |
| W12 Metas manuais, validação e persistência | FUNCIONANDO | Metas 2100 kcal/2500 ml persistiram; valor negativo não sobrescreveu as metas. |
| W13 Meu Plano: perfil e recuperação após reload | FUNCIONANDO | Perfil fictício salvo e recuperado no mesmo navegador. |
| W14 Perfil gestante e bloqueio nutricional | BLOQUEADA CORRETAMENTE | Gestação explica falta de homologação e não gera plano. |
| W15 Geração de plano clínico e aplicação de metas automáticas | BLOQUEADA CORRETAMENTE | Geração não liberada: A geração de planos aguarda homologação nutricional. Salvar seu perfil continua disponível. Não há botão para aplicar metas automáticas. |
| W16 Galeria e prévia de imagem válida | FUNCIONANDO | PNG sintético selecionado pelo seletor real e convertido em prévia; sem envio à IA. |
| W17 IA na demonstração Web e autorização de envio | BLOQUEADA CORRETAMENTE | Análise não executada; aviso: Abra Minha conta → Privacidade e confirme o envio à IA antes de analisar. |
| W18 Arquivo corrompido | BLOQUEADA CORRETAMENTE | JPEG inválido rejeitado com explicação e interface disponível. |
| W19 Arquivo de tipo não permitido | BLOQUEADA CORRETAMENTE | Tipo de arquivo não permitido foi recusado. |
| W20 Seletor de câmera Web | FUNCIONANDO | Seletor capture=environment aberto e cancelado; não valida câmera física/permissão Android. |
| L01 Ofertas públicas e quotas comerciais | FUNCIONANDO | R$24,90/30 dias: 50 fotos/20 textos; R$34,90/30 dias: 100 fotos/50 textos. Nomes publicados: Análise alimentar com IA; Análise alimentar com IA + Meu Plano alimentar |
| L02 Pix na demonstração e feedback de atualização/recuperação | BLOQUEADA CORRETAMENTE | Todos os controles respondem explicando que a vinculação segura exige Android; nenhum QR/Pix ou licença inventado. |
| L03 Acesso do proprietário no release publicado | NÃO TESTADA | Controle presente; ativação positiva depende de dispositivo atestado e credencial de teste autorizada. |
| W21 Exportação JSON e CSV com dados | FUNCIONANDO | Downloads reais incluem refeição, água e peso fictícios; CSV alimentar não vazio. |
| W22 Importação idempotente no perfil atual | FUNCIONANDO | Backup mesclado pela interface sem duplicar a refeição. |
| W23 Exclusão cancelada e confirmada | FUNCIONANDO | Cancelar conserva refeição; confirmar removeu somente o registro fictício do perfil de auditoria. |
| W24 Recuperação de refeição pelo backup | FUNCIONANDO | Registro excluído foi recuperado por importação do backup real baixado. |
| W25 Privacidade e explicações sobre armazenamento | FUNCIONANDO | Privacidade abre; exclusão local disponível. Exclusão de conta fica oculta na demonstração; não executada para preservar dados. |
| W26 PWA, verificação de atualização e reabertura offline | FUNCIONANDO | SW ativo em http://127.0.0.1:4173/sw.js; caches nutrifoto-estatico-273a843c22920942. Refeição e TACO acessíveis offline; update consultado sem apagar dados. |
| W27 Persistência após fechar e reabrir navegador | FUNCIONANDO | Refeição, 300 ml, peso 75,2 kg e perfil recuperados em novo processo Chrome usando somente o perfil isolado de auditoria. |
| W28 Falha de conexão: mensagem e preservação de registros | PARCIAL | Web mantém registros offline; consulta segura permanece bloqueada por ambiente Web, antes da conexão. Não simula falha interna Supabase. |
| W29 Erros JavaScript e rede do navegador | FUNCIONANDO | Nenhuma exceção JavaScript não tratada e nenhuma conexão externa observada. Falhas de rede induzidas no teste offline são registradas separadamente. |

## Apresentação e pendências

1. Abra a URL local. Se o navegador oferecer atualização do aplicativo, aplique-a pela interface, preservando os dados.
2. Salve perfil e preferências. Demonstre TACO, ajuste de porções, diário, histórico, água, peso e gráficos.
3. Para mostrar a análise fotográfica anterior, autorize o envio na área Privacidade e selecione testes/fixtures/banana-evan-amos.jpg. O resultado será recuperado com aviso de que não ocorreu chamada nova. Revise e salve.
4. Para recuperar o exemplo já salvo, importe o backup-demonstracao-real.json pela tela Configurações. Exportação/importação foi testada sem duplicações.
5. Não apresente o fluxo textual por IA como aprovado. TACO textual está funcional, mas não substitui essa pendência. É necessária nova autorização para validar o prompt ajustado em uma nova tentativa real; nenhuma despesa adicional foi presumida.
6. Licença Android/proprietário, expiração, revogação e Pix continuam protegidos e dependentes do backend/banco/credenciais e vínculo seguro previstos no produto. Acesso local não concede esses benefícios. Planos clínicos e aplicação automática de metas permanecem bloqueados.

Evidências: evidencias/demonstracao-web/ (controle financeiro, respostas reais, capturas, backup, matriz e logs Node). Os testes de botão/fluxo acessíveis não representam cobertura exaustiva de estados pagos não configurados. Não é possível declarar NutriFoto inteiro operacional enquanto o texto real não for comprovado e os fluxos externos não forem homologados.
