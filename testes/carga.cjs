const {spawn}=require('node:child_process');
const {mkdtempSync,writeFileSync,mkdirSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {resolve,join}=require('node:path');
const {performance}=require('node:perf_hooks');
const raiz=resolve(__dirname,'..'),pasta=resolve(raiz,'evidencias'),origem='http://127.0.0.1:4287';mkdirSync(pasta,{recursive:true});
const servidor=spawn(process.execPath,['servidor/local.js','--simulado','--porta','4287'],{cwd:raiz,env:{...process.env,NUTRIFOTO_FIXTURES:join(mkdtempSync(join(tmpdir(),'nutrifoto-carga-')),'dados.json')},stdio:'ignore'});
(async()=>{
 for(let tentativa=0;tentativa<60;tentativa++){try{if((await fetch(origem)).ok)break;}catch{}await new Promise(resolver=>setTimeout(resolver,100));}
 const inicial=await fetch(origem+'/api/conta'),sessao=await inicial.json();let cookies=inicial.headers.getSetCookie().map(cookie=>cookie.split(';')[0]);
 const login=await fetch(origem+'/api/conta',{method:'POST',headers:{Origin:origem,'Content-Type':'application/json','X-CSRF-Token':sessao.csrf,Cookie:cookies.join('; ')},body:JSON.stringify({acao:'entrar',email:'ana@exemplo.test',senha:'Teste-local-2026!'})});
 if(!login.ok)throw Error('Falha ao preparar carga isolada');cookies.push(...login.headers.getSetCookie().map(cookie=>cookie.split(';')[0]));
 const duracoes=[],contagens={};let indice=0;const inicio=performance.now();
 await Promise.all(Array.from({length:10},async()=>{while(indice++<200){const inicioPedido=performance.now();const resposta=await fetch(origem+'/api/assinatura',{headers:{Cookie:cookies.join('; ')}});await resposta.text();duracoes.push(performance.now()-inicioPedido);contagens[resposta.status]=(contagens[resposta.status]||0)+1;}}));
 duracoes.sort((a,b)=>a-b);
 const resultado={simulado:true,redeExterna:false,pedidos:duracoes.length,concorrencia:10,duracaoTotalMs:performance.now()-inicio,p50Ms:duracoes[Math.floor(duracoes.length*.5)],p95Ms:duracoes[Math.floor(duracoes.length*.95)],status:contagens,limite:'Mede somente processo local e adaptador JSON de testes; não mede capacidade de Vercel, Supabase, IA ou clientes reais.'};
 writeFileSync(join(pasta,'carga.json'),JSON.stringify(resultado,null,2));console.log(JSON.stringify(resultado,null,2));if(Object.keys(contagens).some(status=>Number(status)>=500))process.exitCode=1;
})().catch(erro=>{console.error(erro);process.exitCode=1;}).finally(()=>servidor.kill());
