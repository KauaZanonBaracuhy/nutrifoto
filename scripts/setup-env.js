/**
 * setup-env.js — cria/atualiza .env com a chave da OpenRouter de forma interativa
 *
 * A chave é lida do terminal (readline) e gravada em .env.
 * A chave NUNCA é impressa no console, logada, ou mostrada em nenhuma saída.
 *
 * Uso:
 *   node scripts/setup-env.js
 */

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");
const ENV_PATH = resolve(PROJECT_ROOT, ".env");

function maskKey(key) {
  if (!key || key.length < 12) return "***";
  return key.substring(0, 7) + "..." + key.substring(key.length - 4);
}

function isValidKey(key) {
  return key && key.startsWith("sk-or-") && key.length > 20;
}

function parseEnv(content) {
  const vars = {};
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) vars[m[1]] = m[2];
  }
  return vars;
}

function serializeEnv(vars) {
  return Object.entries(vars).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("\n  NutriFoto — setup da chave da OpenRouter\n");

  // 1. Verifica se .env já existe
  let envVars = {};
  let existingKey = null;
  if (existsSync(ENV_PATH)) {
    const content = readFileSync(ENV_PATH, "utf8");
    envVars = parseEnv(content);
    if (envVars.OPENROUTER_API_KEY) {
      existingKey = envVars.OPENROUTER_API_KEY;
      console.log(`  .env já existe. Chave atual: ${maskKey(existingKey)}`);
    } else {
      console.log("  .env existe mas sem OPENROUTER_API_KEY.");
    }
  } else {
    console.log("  .env não existe. Vamos criar.");
  }

  // 2. Pergunta se quer substituir (se já existe) ou se quer criar
  if (existingKey && !isValidKey(existingKey)) {
    const replace = await ask("  A chave existente é placeholder. Substituir? (s/n) [s]: ");
    if (replace.toLowerCase() === "n") {
      console.log("  Cancelado. Nenhuma alteração feita.");
      return;
    }
  }

  // 3. Lê a chave do terminal
  const newKey = await ask("  Cole sua chave da OpenRouter (começa com sk-or-v1-): ");

  if (!newKey) {
    console.log("  Nenhuma chave fornecida. Cancelado.");
    return;
  }

  if (!isValidKey(newKey)) {
    console.log("  ✗ Chave inválida. Deve começar com 'sk-or-v1-' e ter mais de 20 caracteres.");
    const retry = await ask("  Tentar novamente? (s/n) [n]: ");
    if (retry.toLowerCase() === "s") {
      return main();
    }
    return;
  }

  // 4. Atualiza o .env preservando outras variáveis
  envVars.OPENROUTER_API_KEY = newKey;
  writeFileSync(ENV_PATH, serializeEnv(envVars), "utf8");

  console.log(`  ✓ .env atualizado. Chave salva: ${maskKey(newKey)}`);
  console.log("  (a chave não foi exibida — só o prefixo e os 4 últimos caracteres)");
}

main().catch((err) => {
  console.error("  Erro:", err.message);
  process.exit(1);
});
