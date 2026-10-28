# NutriFoto 0.3.3 — ativação do proprietário e planos

Data: 24/10/2026. Implementação local; sem publicação, cobrança real ou chamadas pagas de IA.

## Alterações

- Adicionada a opção discreta “Acesso do proprietário” na tela Seu NutriFoto, separada da recuperação de compra.
- Código validado somente no servidor por hash PBKDF2-SHA256 com sal aleatório. Configurador com entrada oculta, arquivo privado fora do projeto e proteção contra sobrescrita. O valor escolhido não foi configurado nem incluído nos arquivos distribuídos.
- Concessão única e transacional do plano completo, com validade configurável de 1–365 dias. Repetir a ativação não amplia o prazo. Cinco tentativas por hora por rede e dispositivo.
- Recuperação e transferência reutilizam a licença existente, preservando prazo, consumo e bloqueios. Revogação administrativa impede reativação pelo código.
- Migração adicionada: `supabase/006_proprietario.sql`. A concessão é registrada como licença do proprietário, sem pagamento Asaas fictício.
- Nomes atualizados: “Análise alimentar com IA” e “Análise alimentar com IA + Meu Plano alimentar”. Preservados R$ 24,90/30 dias, 50 fotos e 20 textos/dia; R$ 34,90/30 dias, 100 fotos e 50 textos/dia. Franquias textuais continuam configuráveis no backend.
- Meu Plano informa que a geração e as metas automáticas permanecem indisponíveis. Preservados orçamento financeiro, quotas, armazenamento alimentar, backups e identidade de assinatura Android.
- Preferência permanente registrada em `AGENTS.md`: toda entrega deve incluir relatório das alterações.

## Verificação

| Ambiente | Resultado e alcance |
|---|---|
| Node | 80 testes aprovados; dois testes PostgreSQL da suíte ampla ignorados |
| PostgreSQL real local | 19 grupos aprovados: concessão concorrente única, prazo, repetição, transferência, revogação, quotas, orçamento e contador real de tentativas |
| Interface no navegador | 10 grupos aprovados; respostas positivas de ativação e ponte Android usaram fixtures identificadas |
| Cloudflare local | Quatro grupos de interface/API aprovados no workerd; derivação e validação PBKDF2 também exercitadas no runtime real |
| APK no emulador API 36 | Atualização por `install -r`, formulário, limpeza do campo, bloqueio por configuração ausente, encerramento e reabertura aprovados; 66 assets conferidos |
| Segurança/build | Sintaxe, verificação de segredos públicos, build Web, build Workers de validação e compilação Android assinada aprovados |

Asaas, atestado de hardware e IA foram simulados nos testes de integração. Não houve homologação de concessão real em dispositivo físico ou no backend hospedado, nem teste Asaas sandbox externo nesta entrega. O APK testado está sem origem de backend configurada e não concede licença sozinho.

## Pendências e configuração privada

1. Aplicar a migração 006 após 001–005 no banco do backend e configurar persistência e raízes confiáveis de atestado Android.
2. Executar `powershell -NoProfile -File scripts/configurar-proprietario.ps1`. O código é informado sem eco; somente o hash é salvo em `%USERPROFILE%/.nutrifoto/proprietario/configuracao.env`. Revisar a validade inicial de 30 dias. Configurar `PROPRIETARIO_CODIGO_HASH` como secret e `PROPRIETARIO_LICENCA_DIAS` no servidor; o script não publica a configuração.
3. Preparar a origem HTTPS no build Android quando o backend estiver pronto. Asaas sandbox e IA exigem seus próprios segredos e orçamento para essas operações.
4. Publicação desta alteração depende de autorização. Confirmar a revogação da antiga chave OpenRouter exposta; ela não foi utilizada em testes.

## Artefato e evidências

- APK: `builds/android-release/NutriFoto-0.3.3-7-release.apk`.
- Identidade: `com.nutrifoto.app`, versão 0.3.3, versionCode 7, target SDK 36; assinatura existente preservada.
- SHA-256: `f9e4b226b369b4cb4f3a5766ece761fc804f537af605890c11a67a8663a6264f`.
- Evidência sanitizada: `evidencias/licencas/proprietario-validacao.json`; testes e capturas na mesma pasta.

Este relatório consolida os testes já executados na implementação. A inclusão do relatório e da regra em AGENTS.md é documental e não exigiu nova compilação.
