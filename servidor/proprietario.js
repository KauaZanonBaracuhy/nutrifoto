import { randomBytes } from 'node:crypto';
import { compararSegredo, falhar } from './seguranca.js';

// Web Crypto mantém o mesmo formato no Node e no runtime Workers.
async function derivar(codigo, sal) {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(codigo), 'PBKDF2', false, ['deriveBits']);
  return Buffer.from(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: Buffer.from(sal, 'hex'), iterations: 100000 }, chave, 256)).toString('hex');
}
export async function gerarHashProprietario(codigo) {
  if (typeof codigo !== 'string' || codigo.length < 12 || codigo.length > 128) throw new Error('Use um código de 12 a 128 caracteres.');
  const sal = randomBytes(16).toString('hex');
  return `pbkdf2-sha256$100000$${sal}$${await derivar(codigo, sal)}`;
}
export async function validarCodigoProprietario(codigo, ambiente) {
  const formato = /^pbkdf2-sha256\$100000\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(ambiente.PROPRIETARIO_CODIGO_HASH || '');
  const dias = Number(ambiente.PROPRIETARIO_LICENCA_DIAS);
  if (!formato || !Number.isSafeInteger(dias) || dias < 1 || dias > 365) falhar(503, 'Ativação do proprietário ainda não configurada no servidor.');
  if (typeof codigo !== 'string' || codigo.length < 12 || codigo.length > 128 || !compararSegredo(await derivar(codigo, formato[1]), formato[2])) falhar(403, 'Código do proprietário inválido.');
  return dias;
}
