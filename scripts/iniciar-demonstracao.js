import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const raiz = resolve(import.meta.dirname, '..');
process.env.NUTRIFOTO_PREMIUM_LOCAL = 'true';
if (existsSync(resolve(raiz, '.env'))) for (const [nome, valor] of Object.entries(parseEnv(readFileSync(resolve(raiz, '.env'), 'utf8')))) if (!process.env[nome]) process.env[nome] = valor;
process.env.IA_PROVEDOR ||= 'groq';
const build = spawn(process.execPath, ['scripts/preparar-publicacao.js'], { cwd: raiz, stdio: 'inherit' });
build.on('exit', codigo => {
  if (codigo) { process.exitCode = codigo;return; }
  const servidor = spawn(process.execPath, ['servidor/local.js', '--demonstracao'], { cwd: raiz, stdio: 'inherit' });
  servidor.on('exit', c => { process.exitCode = c ?? 1; });
  process.on('SIGINT', () => servidor.kill('SIGINT'));process.on('SIGTERM', () => servidor.kill('SIGTERM'));
});
