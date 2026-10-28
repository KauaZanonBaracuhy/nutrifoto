# NutriFoto — desenvolvimento e validação

## Escopo e fontes
- Leia este arquivo, os TXT de desenvolvimento e o pedido atual. Fonte original: `../requitos para desenvolvimento ia.txt` (oito regras, revisão de 23/10/2026); o TXT anexado à missão define o escopo. Preserve regras anteriores compatíveis; instruções atuais do proprietário prevalecem sobre missões e relatórios históricos.
- Procure outros `AGENTS.md` no caminho afetado. Na revisão de 23/10/2026 não havia instruções adicionais na árvore própria do projeto.
- Fontes ativas: `www/`, `servidor/`, `api/`, `supabase/`, `android/`, `scripts/` e `testes/`. `www/index.html` é o shell/painel; `www/telas/` contém fragmentos de telas montados por `navegacao.js`. `web/`, `shared/` e `_android_pausado/` são legados, não fonte de publicação.
- Leia somente o necessário: `DESIGN.md`/`UX-CONTRACT.md` para UI, `LICENCAS_ANDROID.md` para ativação, `ANDROID_RELEASE.md` para assinatura. Confira informações históricas no código atual. Windows/EXE somente quando solicitado; a obrigação antiga de gerar EXE não consta no TXT atual.

## Regras do proprietário
- Código simples e limpo, com princípios de Clean Code. Use funções; não introduza orientação a objetos no código próprio. Adaptação nativa existente limita-se ao exigido pela plataforma.
- Programe em português, com funções de nomes claros e descritivos; preserve contratos externos e aliases necessários. Cada HTML representa uma tela.
- Considere larga escala: validação no servidor, limites, consultas proporcionais, atomicidade e idempotência quando necessárias; sem reestruturações preventivas.
- Preserve arquitetura, funcionalidades, dados, namespaces e identidade visual. Não migre/apague dados silenciosamente. Investigue antes de substituir bibliotecas; não refatore partes que funcionam fora do escopo.

## Procedimento de trabalho
1. Reproduza no produto, registrando plataforma, versão e passos. Build antigo, cache, configuração e eventos ausentes são hipóteses até comprovação.
2. Localize a causa e altere somente o necessário.
3. Execute testes específicos existentes, valide na interface final e faça regressão curta relacionada. Corrija e repita os testes afetados.
4. Reserve suíte completa para releases, mudanças estruturais ou impacto amplo. Unitários e fixtures complementam, não substituem, validação no aplicativo.
5. Mudanças compartilhadas exigem Web e Android quando afetarem ambas. Respeite restrições da missão, como “somente Web”, declarando a outra plataforma não testada.

**Nenhuma alteração pode ser declarada funcional até ser validada no aplicativo que o usuário realmente executará.** Missões apenas documentais exigem conferir documento/comandos, sem compilar ou testar o aplicativo desnecessariamente.

## Nunca entregar build antigo
- Identifique arquivos alterados, gere o build correto e confira sua inclusão. Confira versão, identificação e caminho do artefato. Nunca renomeie APK antigo nem aprove uma versão e entregue outra. Mudança posterior exige reconstruir/revalidar os trechos afetados.
- Web: abra a aplicação/URL realmente entregue, clique/toque e use teclado; confira estados, mensagens, navegação, console e requisições. Verifique assets carregados e service worker/cache (`www/sw.js`, versão por conteúdo). Contexto limpo ajuda no diagnóstico; teste também atualização com dados existentes, sem limpar dados do usuário para esconder falhas.
- Android: compile, confira applicationId/versão/certificado, compare `assets/public/` do APK com `builds/android-web/` e com as alterações esperadas. Instale exatamente esse APK, abra, interaja, confira UI/logs, fechamento e reabertura. Preserve identidade de assinatura e dados: atualização com `install -r`; sem desinstalação, `pm clear` ou limpeza do usuário. Testes destrutivos só em ambiente isolado autorizado.
- Registre caminho, versão e SHA-256 do APK entregue e vincule-os à instalação testada. Sem emulador, dispositivo ou infraestrutura, informe teste não realizado e causa exata; conclua testes independentes, sem inventar aprovação.
- Alterou UI: capture antes quando possível e inspecione screenshots finais, alinhamento, espaçamento, legibilidade, foco, controles alcançáveis, responsividade e temas claro/escuro afetados. Alterar CSS ou gerar screenshot sem inspecionar não comprova melhoria visual.

## Toda ação visível responde
- Se disponível, executa a função. Se indisponível, explica causa real e próximo passo por aviso contextual/diálogo existente, acessível a toque, clique e teclado, sem executar a operação bloqueada.
- Evite `disabled` em ações que precisam explicar licença, pagamento, conexão, quota, configuração ou restrição clínica. Ocupação temporária pode impedir duplicação, com feedback claro. Não crie controles decorativos, redundantes ou sem evento.
- Teste eventos e mudanças visíveis, não só presença de HTML. Conforme o fluxo: sem licença, ativa, vencida, limite diário, servidor indisponível e perfil gestante/clínico. Diferencie defeito, configuração ausente, conexão, bloqueio intencional e limitação do ambiente; não exponha erros técnicos ou segredos.

## Segurança e integrações
- Segredos somente no servidor. Nunca publicar `.env`, service role, chaves Asaas/OpenRouter ou assinatura privada em Web/APK/Git/logs/evidências. Diagnósticos verificam presença sem imprimir valores privados.
- Licença Android usa Keystore, desafio único e atestado validado no backend; Web é demonstração, sem vínculo seguro fictício. Preserve Auth/Stripe legados para compatibilidade. Migrações atuais: `supabase/001` a `006`.
- Asaas somente sandbox; confirmação por webhook validado e consulta confiável no servidor. APK, URL de sucesso e comprovante não concedem licença. Preserve dispositivo único, prazo, quotas diárias atômicas, idempotência, reservas e tetos financeiros, mesmo se a configuração comercial estiver incorreta.
- Planos clínicos e aplicação automática de metas permanecem bloqueados até homologação pertinente. Simulações/replays devem ser identificados e não comprovam precisão clínica, pagamento ou integração externa.
- Sem autorização específica: não fazer IA paga, cobranças reais, compras, deploy, push, envio de mensagens ou reescrita de histórico. Push pode disparar deploy. Rodada anterior de IA encerrada: preserve `evidencias/homologacao-real/controle.json`, sem reiniciar seu orçamento.
- Em 23/10/2026 não havia backend hospedado nem configuração Asaas disponível; reconfirme antes de homologar. Não fabrique Pix/pagamento aprovado. `NUTRIFOTO_BACKEND_ORIGIN` fornece apenas origem HTTPS pública ao build; configuração privada permanece no backend existente.

## Comandos confirmados
Premium Web local 0.3.4: `pnpm demo` define explicitamente NUTRIFOTO_PREMIUM_LOCAL no processo Node de loopback. Pode habilitar sugestões gerais de plano, metas revisáveis e resumo para adultos elegíveis, sem criar direitos comerciais. Restrições clínicas permanecem no backend; metas só mudam após revisão e confirmação. Não habilitar esse adaptador no Worker. As sete novas tentativas autorizadas nesta missão (cinco + duas de revalidação) foram consumidas, além das três anteriores; não reutilizar autorização nem apagar o ledger. Estado atual: Premium ativo, novas despesas bloqueadas, resultados reais anteriores recuperáveis com aviso.
Web local com IA real: `pnpm demo` prepara os assets e inicia Node em `http://127.0.0.1:4173`. O backend local usa sessão/CSRF e ledger SQLite privado em `%USERPROFILE%/.nutrifoto/demonstracao-web/`, sem conceder licença Android nem simular pagamentos. As três tentativas autorizadas em 28/10/2026 foram consumidas; iniciar novamente não libera orçamento. Recuperar resultados reais existentes não gera nova chamada e deve ser identificado na interface. Não reiniciar nem apagar esse ledger para contornar o limite; qualquer gasto novo exige autorização específica.
Cloudflare: entrada `cloudflare/worker.js`, assets `www/`, configuração `wrangler.jsonc`; veja `CLOUDFLARE.md`. `pnpm run build:cloudflare` faz dry run, `pnpm run test:cloudflare` testa workerd real local, `pnpm run dev:cloudflare` desabilita a leitura do `.env` legado. Prévia no Worker existente usa `pnpm run preview:cloudflare`; main/produção continuam exigindo promoção autorizada. Nunca confundir URL antiga respondendo 200 com build novo implantado.

Na raiz `nutrifoto/`, PowerShell, Node >=22 e pnpm com lockfile. Reutilize dependências; instale somente se necessário: `pnpm install --frozen-lockfile --ignore-scripts`.

| Objetivo | Comando |
|---|---|
| Build Web, assets e versão de cache | `pnpm run build:web` |
| Web local, dados e IA explicitamente fictícios | `node servidor/local.js --simulado --porta 4173` → `http://127.0.0.1:4173/` |
| Sintaxe / segredos públicos | `pnpm run check` / `pnpm run test:seguranca` |
| Interface Playwright de ativação | `pnpm run test:licencas:interface` (inclui fixtures; não é APK) |
| Outros fluxos Web | Escolha em `package.json`: `test:interface`, `test:pwa`, `test:continuidade`, conforme o impacto |
| Licenças / PostgreSQL real local | `pnpm run test:licencas` / `pnpm run test:licencas:postgres` (Docker; Asaas/IA/atestado simulados) |
| Suíte Node ampla | `pnpm test` (confira ignorados e dependências) |
| Assets Android e sync separados | `node scripts/preparar-android.js`, depois `node node_modules/@capacitor/cli/bin/capacitor sync android` |
| Release APK + AAB | `pnpm run build:android` ou `pnpm run build:aab` (já prepara/sincroniza e verifica assinatura) |
| Somente APK | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/compilar-android.ps1 -SomenteApk` |

Android: Capacitor 8, JDK 21, SDK/target 36, identidade `com.nutrifoto.app`. Build respeita `JAVA_HOME`, `ANDROID_HOME`, `NUTRIFOTO_SIGNING_PROPERTIES`; padrões privados em `%USERPROFILE%/.nutrifoto/android/` e `%USERPROFILE%/.nutrifoto/assinatura/release.properties`. Nunca gere outra chave para atualizar instalações existentes. Confira versões em `package.json`, `www/js/base.js`, `android/app/build.gradle`; incremente `versionCode` em atualização distribuída. Artefatos: `builds/android-release/`.

ADB existente: escolha `$serial` de `devices` e defina `$apk` com o caminho exato anunciado pelo build:
```powershell
$adb = Join-Path $env:USERPROFILE '.nutrifoto/android/sdk/platform-tools/adb.exe'
& $adb devices
& $adb -s $serial install -r $apk
& $adb -s $serial shell am start -n com.nutrifoto.app/.MainActivity
& $adb -s $serial shell dumpsys package com.nutrifoto.app
& $adb -s $serial logcat -d -s AndroidRuntime Capacitor/Console chromium
& $adb -s $serial shell uiautomator dump /sdcard/nutrifoto-botoes.xml
Get-FileHash -LiteralPath $apk -Algorithm SHA256
```
Use ADB `shell input tap`/`shell input swipe` com coordenadas da UI atual. Existe `testes/android-botoes.py`, executável com o Python disponível, mas fixa `emulator-5554` e geometria 720×1600: confira ambiente/estado inicial antes de usar. Não é suíte Android universal; retomadas não comprovam execução completa. Release restringe depuração/logs; silêncio no log não prova ausência de erro.

## Economia e entrega
- Sempre produza ou atualize um relatório Markdown das alterações de cada entrega, conforme pedido do proprietário em 24/10/2026. Mantenha-o conciso: alterações, testes reais versus simulados/não executados, pendências e artefatos com versão/hash quando aplicável. Preserve relatórios históricos; não inclua segredos. Entregue o link do relatório na resposta final, mesmo quando ela for curta.
- Buscas direcionadas (`rg`), trechos relevantes e reutilização de resultados/testes/scripts. Não releia documentos, repita auditorias ou comandos caros sem necessidade. Não instale ferramentas pesadas nem faça IA paga para testes repetitivos. Economizar não dispensa verificações essenciais.
- Graphify sob demanda, apenas com benefício claro ou pedido explícito; `graphify-out/` não obriga uso. Consultas focadas `query`/`explain`/`path`/`affected`, inicialmente 500–1000 tokens, reutilizando resultados e validando no código. MCP exige raiz absoluta em `project_path`. Sem watchers, extração paga ou atualização automática/global; atualize em lote quando solicitado/necessário. Se dispensável e falhar, leia diretamente. PowerShell: `graphify` ou `& 'C:\Users\kauaz\.local\bin\graphify.exe'`, nunca Bash literal.
- Entrega curta: o que mudou e onde; testes efetivos por plataforma; reais, simulados e não executados; pendências; caminho/versão/hash do build validado. Evidência mínima em `evidencias/`, sem segredos ou relatórios duplicados. Não afirme “funcionando” sem comprovação no produto final.

Groq na demonstração local (28/10/2026): `pnpm demo` usa `IA_PROVEDOR=groq` por padrão. Segredos/configuração ficam exclusivamente no `.env` privado: `GROQ_API_KEY`, `GROQ_MODELO=qwen/qwen3.8-27b`, `GROQ_PLANO=free` e `GROQ_FREE_CONFIRMADO_EM` em ISO UTC. A confirmação de Free é feita pelo proprietário no painel, válida por 24 horas; a API de modelos não certifica faturamento. Sem confirmação válida, falhar fechado. Nunca atualizar essa confirmação automaticamente nem inferir Free de HTTP 200. `GROQ_LIMITE_LOCAL_DIA` limita tentativas locais (padrão 20/dia UTC), além das cotas do provedor. Uso/pause/reservas ficam em `groq.sqlite`, separado do ledger OpenRouter; não zerar para liberar cotas. Não há fallback pago. OpenRouter segue disponível por configuração explícita e sujeito às autorizações históricas esgotadas. Compatibilidade Workers não autoriza ativar Premium local em produção nem publicar secrets automaticamente.
