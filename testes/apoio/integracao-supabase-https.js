import assert from 'node:assert/strict';
import { fork,execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname,resolve,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
const executarPrograma=promisify(execFile),apoio=dirname(fileURLToPath(import.meta.url));
export async function verificarIntegracaoHttps({pasta,status,lerTokenEntregue,evidencias}){
 const pythonLocal=resolve(dirname(process.execPath),'../../python/python.exe');
 const python=process.env.PYTHON_EXECUTABLE||(existsSync(pythonLocal)?pythonLocal:'python');
 await executarPrograma(python,[join(apoio,'certificado-local.py'),pasta]);
 const origem='https://127.0.0.1:56443',origemProxy='https://127.0.0.1:56444';
 const ambiente={APP_ORIGIN:origem,SUPABASE_URL:origemProxy,SUPABASE_ANON_KEY:status.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:status.SERVICE_ROLE_KEY,RATE_LIMIT_SALT:'sal-ficticio-apenas-homologacao-local-2026',IA_QUOTA_GRATIS:'0',IA_QUOTA_PAGO:'0',IMAGENS_LIMITE_GRATIS_BYTES:'1000000',FOTOS_LIMITE_GRATIS:'10'};
 const arquivo=join(pasta,'bff-https.json');await writeFile(arquivo,JSON.stringify({origemSupabase:status.API_URL,ambiente}));
 const processo=fork(join(apoio,'servidor-supabase-https.js'),[arquivo],{env:{...process.env,NODE_EXTRA_CA_CERTS:join(pasta,'ca.pem')},stdio:['ignore','pipe','pipe','ipc']});
 let saida='';processo.stderr.on('data',parte=>saida+=parte);
 let navegador;const casos=[];
 async function verificar(nome,acao){await acao();casos.push({nome,estado:'APROVADA EM AMBIENTE LOCAL'});}
 try{
  await new Promise((resolver,rejeitar)=>{const limite=setTimeout(()=>rejeitar(new Error('BFF HTTPS não iniciou.')),15000);processo.once('message',mensagem=>{clearTimeout(limite);mensagem.pronto?resolver():rejeitar(new Error('BFF não pronto.'));});processo.once('exit',()=>{clearTimeout(limite);rejeitar(new Error('BFF encerrou antes de iniciar: '+saida.slice(0,500)));});});
  try{navegador=await chromium.launch({headless:true});}catch{navegador=await chromium.launch({channel:'chrome',headless:true});}
  const contexto=await navegador.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844},timezoneId:'America/Sao_Paulo'});
  await contexto.route('**/*',rota=>rota.request().url().startsWith(origem)?rota.continue():rota.abort());
  const pagina=await contexto.newPage();pagina.setDefaultTimeout(15000);
  async function abrir(pagina,caminho='/?tela=conta'){
   await pagina.goto(origem+caminho,{waitUntil:'networkidle'});
   if(await pagina.locator('.onboarding-skip-btn').isVisible())await pagina.locator('.onboarding-skip-btn').click();
   if(caminho.includes('tela=conta'))await pagina.locator('#screen-conta.active').waitFor();
  }
  const email=`https-${randomUUID().slice(0,8)}@exemplo.test`,senha='Teste-https-local-2026!';
  await verificar('UI HTTPS: cadastro no BFF real, confirmação por e-mail Mailpit e cookies seguros',async()=>{
   await abrir(pagina);await pagina.locator('#conta-email').fill(email);await pagina.locator('#conta-senha').fill(senha);await pagina.locator('#conta-cadastrar').click();
   const token=await lerTokenEntregue(email,'confirmacao');
   await abrir(pagina,'/?tela=conta#confirmacao='+token);await pagina.waitForFunction(()=>!location.hash);
   await pagina.locator('#conta-confirmar').click();await pagina.locator('#screen-dashboard.active').waitFor();
   const cookies=await contexto.cookies();for(const nome of ['nf_acesso','nf_renovacao','nf_csrf']){const cookie=cookies.find(item=>item.name===nome);assert.ok(cookie);assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true);assert.equal(cookie.sameSite,'Strict');}
   assert.equal(await pagina.evaluate(()=>document.cookie.includes('nf_acesso')),false);
   await pagina.screenshot({path:join(evidencias,'bff-https-conta-confirmada.png')});
  });
  await verificar('UI+BFF HTTPS: metadados e foto privada sincronizados com Supabase real',async()=>{
   await pagina.evaluate(async()=>{const banco=await import('/js/db.js');await banco.salvarPeso(72.5);await banco.salvarRefeicao({alimentos:[{nome:'Alimento de teste local',porcao_estimada_g:100,calorias:100,proteina_g:2,carboidrato_g:20,gordura_g:1}],total:{calorias:100,proteina_g:2,carboidrato_g:20,gordura_g:1},imageDataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB4sAAAAASUVORK5CYII='});});
   await abrir(pagina);await pagina.locator('#conta-sincronizar').click();await pagina.waitForFunction(()=>document.querySelector('#estado-sincronizacao').textContent==='Dados sincronizados');
   const remoto=await pagina.evaluate(async()=>{const resposta=await fetch('/api/dados');return resposta.json();});assert.equal(remoto.dados.weights[0].peso_kg,72.5);assert.equal(remoto.dados.meals.length,1);assert.match(remoto.dados.meals[0].imagemRemota,/^[a-f0-9]{64}\.png$/);assert.equal(remoto.dados.meals[0].imageDataUrl,undefined);
  });
  await verificar('UI+BFF HTTPS: outro dispositivo entra e recupera foto original e peso',async()=>{
   const outro=await navegador.newContext({ignoreHTTPSErrors:true});const outra=await outro.newPage();outra.setDefaultTimeout(15000);
   await abrir(outra);await outra.locator('#conta-email').fill(email);await outra.locator('#conta-senha').fill(senha);await outra.locator('#formulario-conta button[type=submit]').click();await outra.locator('#screen-dashboard.active').waitFor();
   const dados=await outra.evaluate(async()=>{const banco=await import('/js/db.js');const refeicoes=await banco.listarTodasRefeicoes();return{pesos:await banco.listarPesos(),refeicao:await banco.obterRefeicao(refeicoes[0].id)};});
   assert.equal(dados.pesos[0].peso_kg,72.5);assert.match(dados.refeicao.imageDataUrl,/^data:image\/png;base64,/);await outro.close();
  });
  await verificar('BFF HTTPS: acesso expirado recuperado pelo refresh real sem expor tokens',async()=>{
   const anterior=(await contexto.cookies()).find(item=>item.name==='nf_acesso').value;
   await contexto.addCookies([{name:'nf_acesso',value:'expirado-ficticio',domain:'127.0.0.1',path:'/',httpOnly:true,secure:true,sameSite:'Strict'}]);
   const sessao=await pagina.evaluate(async()=>(await fetch('/api/conta')).json());assert.equal(sessao.usuario.email,email);
   const novo=(await contexto.cookies()).find(item=>item.name==='nf_acesso').value;assert.notEqual(novo,'expirado-ficticio');assert.ok(novo.length>100);assert.ok(anterior.length>100);
  });
  await verificar('UI+BFF HTTPS: recuperação por e-mail, senha redefinida e login real',async()=>{
   await abrir(pagina);await pagina.locator('#conta-sair').click();await pagina.locator('#screen-dashboard.active').waitFor();
   await abrir(pagina);await pagina.locator('#conta-email').fill(email);await pagina.locator('#conta-recuperar').click();const token=await lerTokenEntregue(email,'recuperacao');
   await abrir(pagina,'/?tela=conta#recuperacao='+token);await pagina.waitForFunction(()=>!location.hash);await pagina.locator('#conta-senha').fill('Nova-senha-https-2026!');await pagina.locator('#conta-redefinir').click();
   await pagina.waitForFunction(()=>!document.querySelector('#formulario-conta').hasAttribute('aria-busy'));
   await pagina.locator('#conta-email').fill(email);await pagina.locator('#conta-senha').fill('Nova-senha-https-2026!');await pagina.locator('#formulario-conta button[type=submit]').click();await pagina.locator('#screen-dashboard.active').waitFor();
  });
  await verificar('BFF HTTPS: exclusão da conta e bloqueio posterior aos dados',async()=>{
   const resposta=await pagina.evaluate(async()=>{const servico=await import('/js/servicoHttp.js');await servico.requisitarApi('/api/conta',{method:'POST',body:JSON.stringify({acao:'excluir',confirmacao:'EXCLUIR'})});return(await fetch('/api/dados')).status;});assert.equal(resposta,401);
  });
  return{transporte:'Navegador → HTTPS BFF real → HTTPS proxy local → Supabase real local',confianca:'CA temporária via NODE_EXTRA_CA_CERTS apenas subprocesso; ignoreHTTPSErrors somente contexto Playwright',casos};
 }finally{await navegador?.close();if(processo.connected)processo.send('encerrar');await new Promise(resolver=>{if(processo.exitCode!==null){resolver();return;}const limite=setTimeout(()=>{processo.kill();resolver();},3000);processo.once('exit',()=>{clearTimeout(limite);resolver();});});}
}
