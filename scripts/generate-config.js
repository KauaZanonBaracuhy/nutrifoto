/**
 * generate-config.js — gera www/js/config.local.js a partir do arquivo .env
 *
 * Uso:
 *   node scripts/generate-config.js
 *
 * Lê OPENROUTER_API_KEY do arquivo .env (parser manual, sem dependências externas).
 * Nunca imprime nenhum trecho da chave no console.
 *
 * O arquivo gerado NÃO é commitado (está no .gitignore).
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");
const CONFIG_PATH = resolve(PROJECT_ROOT, "www", "js", "config.local.js");
const EXAMPLE_PATH = resolve(PROJECT_ROOT, "www", "js", "config.example.js");
const ENV_PATH = resolve(PROJECT_ROOT, ".env");

// Lê o placeholder de config.example.js para usar como fallback
const exampleContent = readFileSync(EXAMPLE_PATH, "utf8");
const exampleKeyMatch = exampleContent.match(/OPENROUTER_API_KEY\s*=\s*'([^']+)'/);
const PLACEHOLDER = exampleKeyMatch ? exampleKeyMatch[1] : "sk-or-v1-SUBSTITUA_AQUI";

/**
 * Parser manual simples de arquivo .env.
 * Lê linha por linha, separa KEY=VALUE, ignora comentários e linhas vazias.
 * Não usa dependências externas.
 */
function parseEnvFile(filePath) {
  const vars = {};
  if (!existsSync(filePath)) {
    return vars;
  }
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Remove aspas simples ou dupladas ao redor do valor
      if ((value.startsWith("'") && value.endsWith("'")) ||
          (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
      }
      vars[key] = value;
    }
  }
  return vars;
}

function isValidKey(key) {
  return key && key.startsWith("sk-or-") && key.length > 20 && !key.includes("SUBSTITUA") && !key.includes("SUA_CHAVE");
}

// Lê diretamente do arquivo .env (com parser manual)
const envVars = parseEnvFile(ENV_PATH);
const envKey = envVars.OPENROUTER_API_KEY;

if (isValidKey(envKey)) {
  writeFileSync(
    CONFIG_PATH,
    `// config.local.js — gerado automaticamente por scripts/generate-config.js\n` +
    `// NÃO COMMITAR. Este arquivo é regenerado a cada build.\n` +
    `window.OPENROUTER_API_KEY = '${envKey}';\n`,
    "utf8"
  );
  console.log(`  config.local.js gerado com sucesso a partir do .env`);
} else {
  writeFileSync(
    CONFIG_PATH,
    `// config.local.js — gerado automaticamente por scripts/generate-config.js\n` +
    `// AVISO: OPENROUTER_API_KEY não encontrada no ambiente.\n` +
    `// Configure a variável OPENROUTER_API_KEY no arquivo .env local.\n` +
    `// (copie .env.example para .env e cole sua chave real da OpenRouter)\n` +
    `window.OPENROUTER_API_KEY = '${PLACEHOLDER}';\n`,
    "utf8"
  );
  console.warn(`\n  ⚠ AVISO: OPENROUTER_API_KEY não encontrada no .env.`);
  console.warn(`  O config.local.js foi gerado com a chave placeholder.`);
  console.warn(`  O deploy funcionará mas a análise de imagem ficará desabilitada.`);
  console.warn(`  Configure a variável no arquivo .env para habilitar a IA.\n`);
}
