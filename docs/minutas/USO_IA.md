# Informações sobre IA — minuta técnica

O modelo configurado é `openai/gpt-4o-mini`, acessado pelo OpenRouter no servidor. A imagem ou o texto são enviados somente após ação de análise e ciência contextual na sessão. Senhas e chaves não fazem parte desse envio. Evite inserir dados identificáveis; o aplicativo não remove automaticamente todos os metadados ou informações visuais possíveis.

Identificação de alimentos e quantidade estimada podem estar erradas. O resultado passa por validação de estrutura, limites numéricos, somas e regras de domínio; essas verificações não detectam todo erro de identificação. Correspondência TACO é conservadora; alimento ambíguo exige escolha e tabela incompleta não vira zero. Informações manuais não se tornam resultados validados por apenas receberem o nome de um alimento.

Há limites por conta, plano, intervalo, tokens e orçamento global. Sem orçamento configurado, a chamada paga é bloqueada. A mesma tentativa usa uma chave idempotente. Se o resultado financeiro for desconhecido, sua reserva permanece comprometida até reconciliação administrativa comprovada. Interromper a tela não garante interromper cobrança externa.

As duas gerações reais anteriores (texto e banana) são evidência funcional restrita; não provam precisão nutricional em geral. Novos testes usam respostas gravadas e fixtures. Não há liberação comercial de planos personalizados nem de metas automáticas. Contratos, retenção e transferências dos operadores exigem revisão antes da oferta.
