# Evidências da camada de dados

Validação local em 21/10/2026, sem dados reais, contas externas ou IA paga.

Comando reproduzível na pasta `nutrifoto`: `node --test testes/dados.test.js testes/dados.browser.test.js`.

Resultado: **13 testes aprovados, 0 falhas**. Os testes browser usam Chromium via Playwright e IndexedDB real, origem HTTP em loopback, contexto temporário e fuso America/Sao_Paulo. Os endpoints de sincronização e imagens desses testes são interceptados; homologação dos provedores externos não é inferida desse resultado.

Cenários:

1. Migração IndexedDB v1 para v4 preserva ID, instante e foto; infere dia local de 22/10 01:30 UTC para 21/10 São Paulo; cria índices e resumos sem imagem.
2. Mesma intenção salva concorrentemente resulta em uma refeição; edição centralizada, totais e exclusão permanecem coerentes.
3. Dez incrementos simultâneos de água são transacionais; aplicação parcial de metas preserva água; contas locais isolam peso, água e preferências.
4. Backup integral inclui imagem, peso, água e preferências; repetir importação não duplica; campos privados não são exportados; arquivo inválido preserva dados existentes. Nomes com HTML permanecem dados.
5. Histórico pagina por dias sem sobreposição e sem carregar imagens.
6. Sincronização CAS envia dados, recupera resposta perdida repetindo a mesma operação persistida e exige decisão explícita sobre conflitos.
7. Migração legado exige consentimento e preserva banco original.
8. Exclusão local apaga somente namespace atual, incluindo revisão/outbox; outras contas e legado permanecem intactos.
9. Outbox cujo CAS ficou obsoleto pode ser resolvido explicitamente após 409.
10. Imagens são enviadas separadamente uma vez; snapshot e outbox contêm referência; abertura individual hidrata foto sob demanda; backup recupera foto remota ausente no cache.
11. Falha simulada de quota em localStorage durante restauração reverte o banco e as preferências.
12. Datas de calendário validam dias inexistentes e transição mês/ano.
13. Streak é calculado por dias reais, começa hoje ou ontem e ignora duplicatas. A consulta efetiva usa somente chaves do índice e termina ao primeiro intervalo.

Arquivos: `www/js/db.js`, `storage.js`, `datas.js`, `backup.js`, `dadosValidacao.js`, `sincronizacao.js`, `imagensRemotas.js`.

Limitações explícitas: dados remotos continuam em snapshot de metadados com CAS e limite do servidor; fotos são blobs privados separados, com limite por foto e quota do servidor. Não há promessa de histórico ilimitado. Falta de acesso à imagem faz o backup integral falhar claramente em vez de gerar arquivo incompleto. A transação IndexedDB abrange as coleções; localStorage possui rollback em falhas normais demonstrado, mas não existe transação atômica entre as duas APIs em queda abrupta do navegador. Planos/perfis legados são preservados na migração; importação de backup valida critérios atuais e pode rejeitar plano antigo inconsistente, exigindo revisão dos dados.
