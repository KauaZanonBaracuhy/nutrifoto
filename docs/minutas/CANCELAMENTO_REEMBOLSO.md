# Cancelamento e reembolso — minuta comercial não aprovada

Não há preço final nem cobrança real habilitados. Antes da oferta, o proprietário deve definir valores mensal/anual, renovação, mudança de plano, data de eficácia do cancelamento, tratamento de créditos, procedimento de reembolso, suporte e informação prévia ao consumidor, com revisão jurídica. Não presumir que cancelar gere reembolso automático.

Implementação disponível: abrir portal Stripe sandbox, consultar o estado atual da assinatura por webhook, rebaixar acesso após expiração ou estado não elegível. A URL de sucesso não concede benefícios. Renovação recusada é reconciliada pelo estado atual do provedor; mudanças e cancelamento são administrados no portal configurado.

Regra técnica de homologação: reembolso integral bloqueia benefícios pagos da conta; reembolso parcial não bloqueia por si só. Disputa aberta/perdida bloqueia; vitória/encerramento elegível remove o bloqueio daquela referência. Outros bloqueios podem permanecer. A cobrança não é cancelada automaticamente por esse bloqueio: o operador deve analisar a assinatura no Stripe. Essa regra exige aprovação comercial e jurídica; não descrevê-la como política definitiva.

A exclusão de conta é bloqueada enquanto houver assinatura não encerrada, para evitar apagar o vínculo necessário à gestão da cobrança. O usuário mantém acesso ao portal e pode retomar a exclusão após encerramento. Validar essa jornada e alternativas de atendimento antes de aceitar clientes.

O código não solicita reembolsos nem inicia disputas. Ele lê eventos sandbox e atualiza permissões. Configurar o portal, testar valores/parcelas/prorrata e documentar o atendimento humano. Fontes operacionais: [cancelamento Stripe](https://docs.stripe.com/billing/subscriptions/cancel), [webhooks de assinatura](https://docs.stripe.com/billing/subscriptions/webhooks). A política aplicável depende da revisão do fornecedor e da legislação pertinente.
