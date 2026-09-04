// config.example.js — arquivo de configuração genérico (SEMPRE commitado)
// Define window.OPENROUTER_API_KEY com placeholder se ainda não estiver definido.
// O index.html carrega config.local.js ANTES deste arquivo (se existir).
// Em produção (deploy sem config.local.js), este arquivo define o placeholder.
// O app.js verifica se a chave contém "SUA_CHAVE" e redireciona para configuração.
if (!window.OPENROUTER_API_KEY) {
  window.OPENROUTER_API_KEY = 'sk-or-v1-SUA_CHAVE_AQUI';
}
