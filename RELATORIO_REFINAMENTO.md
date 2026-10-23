# NutriFoto 0.2.1 — Meu Plano e interface

22/10/2026. Atualização local de teste, sem deploy, cobrança ou chamada real de IA. Arquitetura, dados existentes, identidade visual e proteções nutricionais preservados.

## O defeito e a correção

O seletor do formulário misturava estilo alimentar com restrições: `equilibrado` era enviado como restrição inválida. A opção Nenhuma também podia limpar o estilo. Havia somente geração, sem um salvamento independente do perfil; no EXE sem backend isso deixava o formulário sem uma conclusão útil. Declarações clínicas não eram integralmente restauradas. A evidência anterior está em `evidencias/refinamento/antes/perfil-defeito.json`.

Agora o perfil pode ser salvo localmente, inclusive com declarações clínicas, sem gerar recomendações. Estilo e restrições são independentes, rascunhos de edição sobrevivem à navegação e os campos são restaurados. Editar/voltar ao plano salvo funciona. Consulta e substituições elegíveis usam os registros existentes e TACO local; falhas preservam o plano anterior e permitem tentar novamente. Sem alternativa segura, a interface informa o motivo. Resumos usam os valores reais do rascunho, sem barras artificiais de 100% ou números antigos após erro.

**Continuam bloqueados:** geração externa no EXE sem backend; recomendações para perfis clínicos sem homologação; aplicação automática às metas. A simulação de geração foi testada somente no servidor local explicitamente simulado. O EXE entregue não inventa um plano nem apresenta IA simulada como real. Substituições locais não equivalem a aprovação profissional.

## Interface e controles

Preservados temas, Space Grotesk, Lucide, cartões e navegação. Perfil dividido em seções recolhíveis; botões, foco, mensagens, espaçamentos e estados vazios harmonizados. Refeições e nutrientes ficaram legíveis; imagens de captura têm altura limitada; o aviso nutricional ocupa linha própria e não comprime o título.

Removidos os controles redundantes do rodapé de Meu Plano e o botão ativo de aplicar metas bloqueadas. Edição ficou no controle do topo. Checkout/portal continuam na tela de assinatura existente, sem duplicação em Conta; recuperação de senha nova aparece somente com token. Nenhum preço, benefício ou integração financeira foi alterado.

## Testes executados

| Verificação | Resultado |
|---|---|
| Sintaxe | 100 arquivos aprovados |
| Node | 69 aprovados; 2 PostgreSQL ignorados, sem falhas |
| Interface geral | 26 verificações aprovadas |
| Refinamento e perfil | 9 grupos aprovados, incluindo falha/retry de TACO e bloqueios |
| Compatibilidade | 27 cenários aprovados em Chromium, Firefox e WebKit |
| EXE empacotado | 6 grupos aprovados: registros, reabertura, foto, backup e isolamento |
| Distribuição externa limpa | 4 grupos aprovados; perfil salvo/reaberto, plano fictício importado, substituição, telas e assets |
| Portátil único | Extração, abertura e carregamento aprovados |
| Android API 36 | APK instalado como atualização, registros anteriores preservados; perfil salvo e recuperado após pausa/reabertura normal |

A distribuição completa foi copiada e executada em `C:\Users\kauaz\NutriFoto-Validacao-0.2.1-czM8qz`, fora do repositório. As jornadas extensas usaram `aplicativo\NutriFotoTeste.exe` dessa cópia; o portátil único teve também teste próprio de abertura. Perfis temporários separados; dados de teste fictícios. CSS e código empacotados conferidos contra a fonte atual. Não há dependência da pasta de desenvolvimento.

Capturas antes/depois em `evidencias/refinamento/antes/`, `depois/` e `exe-limpo/`, inspecionadas visualmente. Cobertura de celular/desktop, claro/escuro e oito telas. Captura nativa: `evidencias/refinamento/android-perfil-final.png`. Logs e resultados JSON na mesma pasta. Nenhum aparelho físico conectado.

**Limites observados:** no Android, um encerramento forçado imediatamente após salvar não conservou a última gravação de perfil; a reabertura após pausa normal conservou. A persistência existente em localStorage não recebeu uma migração nem garantia contra interrupção abrupta. O auditor estático premium sinaliza 51 botões por não resolver os handlers externos; não foi declarado aprovado. As jornadas de interface passaram. DESIGN lint: zero erros, dois avisos e uma informação. Leitor de tela integral não homologado.

## Distribuição pronta para testar

- Windows portátil: `builds/windows-release/NutriFoto-Teste-0.2.1-Windows-x64.exe`.
- Android assinado: `builds/android-release/NutriFoto-0.2.1-3-release.apk`.
- AAB preparado: `builds/android-release/NutriFoto-0.2.1-3-release.aab`, validado por bundletool e assinatura verificada; sem envio à Play. Identidade e chave anteriores mantidas.

| Artefato | SHA-256 |
|---|---|
| EXE | `fedaad227b8ef6c6c19ee2e042a33324e69fde0f9b32884dddb34d08e1f93b19` |
| APK | `dd9e2cc05815432ad56e5de0de99637260f6bb716ce5675cf19db2bc4d6908b8` |
| AAB | `961df49ab14f2663805e4c08df97916c2321088de4d5885ee1ec2baafb344e04` |

Pacotes examinados sem arquivos privados ou padrões de credenciais. Chave Android permanece fora do projeto; controle de IA anterior preservado. EXE de teste sem certificado Authenticode comercial.

Para recursos locais, basta o EXE. Contas/IA continuam dependendo de backend HTTPS seguro configurado e a geração de planos depende também da homologação profissional existente. O EXE atual bloqueia rede externa; conectá-lo futuramente exige uma atualização explícita do invólucro. Esta entrega não altera o parecer anterior sobre comercialização.
