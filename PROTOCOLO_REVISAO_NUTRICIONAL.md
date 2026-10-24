# Protocolo para revisão profissional

Versão 22/10/2026. Não executa chamadas pagas. Responsável nutricionista, registro profissional, amostra aprovada, critérios clínicos e assinatura de liberação: pendentes. Plano personalizado e aplicar metas continuam bloqueados. A avaliação de software não substitui esta etapa.

Preparar amostra consentida e sem rostos/documentos: alimento pesado em balança, receita com ingredientes pesados, preparo, rótulo quando aplicável e fotografia em iluminação/distância registradas. Usar a massa medida como referência; nunca a massa inferida pela própria IA. Identificar versão do modelo, prompt, base, data e profissional. Evitar transferir dados clínicos reais para testes.

| Grupo | Casos mínimos para seleção profissional | Revisar |
|---|---|---|
| Frutas | banana de variedades distintas, maçã com/sem casca | espécie, parte comestível, massa |
| Preparações simples | arroz integral/branco, frango grelhado/cozido | preparo e correspondência TACO |
| Compostas | vitamina, feijoada, sopa, sanduíche | ingredientes ocultos, somas e óleo |
| Industrializados | iogurte e leite de marcas/teores distintos | rótulo, porção, dados ausentes |
| Ambiguidade | prato desfocado/oculto, vários alimentos parecidos | pedir revisão, não inventar certeza |
| Quantidades | 50g/100g/180g, alimento cru versus cozido | escala proporcional e densidade |
| Domínio inválido | negativos, nulos, NaN, números enormes | rejeição técnica sem salvar |
| Alergias/restrições | leite, amendoim, glúten e ingredientes mistos | nenhuma certificação por foto |
| Perfis protegidos | menor, gestante, condição clínica | bloquear planos automáticos |
| Fluxo manual | corrigir nome, preparo e porção | invalidar referência inadequada |

Para cada caso, preencher: ID; referência e procedência; massas/ingredientes; saída original; identificação correta/incorreta/indeterminada; erro absoluto e relativo por nutriente onde houver referência válida; correção necessária; risco; parecer; responsável. Relatar também falsos resultados plausíveis, não apenas médias. O profissional deve definir previamente limites aceitáveis por tipo de caso e quais funções podem ser oferecidas.

A banana real anterior não tinha massa medida. A descrição textual de vitamina tinha massas especificadas, mas o nome retornado da banana e os nutrientes ausentes do leite limitam a comparação. Não usar esses exemplos como estudo de acurácia. Replays atuais verificam regressões de código sem novo consumo.

Liberação exige revisão de todas as divergências, ajustes validados com novos testes controlados e aprovação documentada do escopo. A flag PLANOS_HOMOLOGADOS não é uma aprovação. Mesmo após eventual revisão, a aplicação automática de metas só pode mudar em tarefa específica com evidência e autorização.
