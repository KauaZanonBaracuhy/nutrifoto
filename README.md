# NutriFoto

Versão atual: **0.3.2**, Web e Android (Capacitor 8/SDK 36). Backend reutilizado em **Cloudflare Workers + Static Assets**; configuração e publicação de prévia em [CLOUDFLARE.md](CLOUDFLARE.md). Produção depende de promoção autorizada e configuração externa; não está homologada para clientes pagantes.

Atualização comercial de 22/10/2026: consulte [IMPLEMENTACAO_COMERCIAL.md](IMPLEMENTACAO_COMERCIAL.md), [TESTES_COMERCIAIS.md](TESTES_COMERCIAIS.md), [CONFIGURACAO_PARA_PRODUCAO.md](CONFIGURACAO_PARA_PRODUCAO.md) e [RELATORIO_DEFINITIVO_PARA_CHATGPT.md](RELATORIO_DEFINITIVO_PARA_CHATGPT.md). Supabase real local integrado em HTTPS foi homologado. Stripe hospedado, SMTP externo, decisões legais/comerciais e revisão profissional continuam pendentes; cobranças reais permanecem desabilitadas.

Diário alimentar em português, com TACO local, refeições editáveis, água, peso, histórico, backup e estimativas por foto/texto condicionadas à licença. A Web funciona como demonstração. Android usa ativação por instalação, sem cadastro obrigatório; dados alimentares locais e infraestrutura de contas legada são preservados.

Frontend em HTML/CSS/módulos JavaScript; backend com validação no servidor, Supabase existente para persistência transacional e Asaas exclusivamente sandbox. IA usa OpenRouter somente no servidor, com quotas e orçamento obrigatório. Nenhuma chave privada pertence ao frontend/APK. Auth/Stripe legados permanecem para compatibilidade. Veja [licenças e limitações](LICENCAS_ANDROID.md) e [assinatura Android](ANDROID_RELEASE.md).

## Executar demonstração local

Requisitos: Node 22 ou superior e pnpm 11.25.0.

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build
node servidor/local.js --simulado --porta 4173
```

Abra http://127.0.0.1:4173. Simulação identificada, sem e-mails, cobranças ou chamadas pagas de IA. TACO e diário funcionam localmente; resultados fictícios não orientam alimentação real. Simulação é proibida em hospedagem. Para executar o Worker real localmente: `pnpm run dev:cloudflare --port 8787`; sem secrets, APIs dependentes explicam a configuração ausente. Não há Pix fabricado ou ativação decidida pelo cliente.

## Documentação vigente

- [Arquitetura e homologação](ARQUITETURA_ATUAL.md)
- [Correções A01–A28](CORRECOES_REALIZADAS.md)
- [Testes e limitações](TESTES_REALIZADOS.md)
- [Relatório autossuficiente para revisão](RELATORIO_FINAL_PARA_CHATGPT.md)
- [Build](BUILD.md), [design](DESIGN.md) e [contratos de interação](UX-CONTRACT.md)

`www/` é a fonte do frontend e `cloudflare/worker.js` é a entrada Workers; `web/`, `shared/` e `_android_pausado/` são legados. Assets de terceiros, licenças agregadas e precache são gerados pelo build. `.env`, secrets, exemplos de configuração e chaves de assinatura não são assets públicos. A chave OpenRouter antiga permanece no histórico preservado: sua revogação precisa ser confirmada pelo proprietário.

## Rodada de IA real

[Homologação real](RELATORIO_HOMOLOGACAO_REAL.md) e [contexto atualizado](RELATORIO_ATUALIZADO_PARA_CHATGPT.md): duas gerações OpenRouter passaram pelos fluxos controlados após correções de TACO incompleta e backup de campo opcional. Foram quatro requisições totais, 9.056 tokens e US$ 0,00145245 informados. Rodada encerrada; não repetir consumo automaticamente. Isso não configura Supabase nem libera venda/planos/cobranças. O comando --simulado permanece inteiramente fictício para IA.

## Testar no Windows sem emulador

Abra `builds/windows-release/NutriFoto-Teste-0.2.0-Windows-x64.exe`. Diário e TACO funcionam localmente; contas e IA aguardam backend publicado. Leia [teste Windows](WINDOWS_TESTE.md) para persistência, limitações e reprodução do build.
