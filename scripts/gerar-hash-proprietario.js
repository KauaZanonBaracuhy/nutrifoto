// Recebe somente por stdin; nunca imprime código ou hash.
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gerarHashProprietario } from '../servidor/proprietario.js';
let entrada='';
for await(const parte of process.stdin){entrada+=parte;if(entrada.length>512)throw new Error('Entrada excede o limite.');}
const hash=await gerarHashProprietario(entrada.replace(/\r?\n$/,''));entrada='';
const pasta=join(homedir(),'.nutrifoto','proprietario');await mkdir(pasta,{recursive:true,mode:0o700});
const arquivo=join(pasta,'configuracao.env');
await writeFile(arquivo,`PROPRIETARIO_CODIGO_HASH=${hash}\nPROPRIETARIO_LICENCA_DIAS=30\n`,{flag:'wx',mode:0o600});
console.log('Configuração privada criada em '+arquivo+'. Validade inicial: 30 dias; revise antes de configurar o servidor. Nenhum segredo foi impresso.');
