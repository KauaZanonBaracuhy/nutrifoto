import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const argumentos=process.argv.slice(2);
const processo=spawn(process.execPath,[resolve(import.meta.dirname,'../node_modules/wrangler/bin/wrangler.js'),'dev','--local','--show-interactive-dev-session=false',...argumentos],{
  stdio:'inherit',env:{...process.env,CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false',WRANGLER_SEND_METRICS:'false'}
});
processo.on('exit',codigo=>{process.exitCode=codigo??1;});
process.on('SIGINT',()=>processo.kill('SIGINT'));
process.on('SIGTERM',()=>processo.kill('SIGTERM'));
