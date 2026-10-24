/** Infraestrutura real local, sempre descartável; nunca lê .env nem acessa a nuvem. */
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, basename } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verificarIntegracaoHttps } from '../testes/apoio/integracao-supabase-https.js';
const executarPrograma=promisify(execFile);
const raiz=fileURLToPath(new URL('..',import.meta.url));
const argumentos=process.argv.slice(2);
const valorArgumento=nome=>argumentos.includes(nome)?argumentos[argumentos.indexOf(nome)+1]:undefined;
const executavel=process.env.SUPABASE_CLI||'supabase';
const pasta=valorArgumento('--workdir')||await mkdtemp(join(tmpdir(),'nutrifoto-supabase-'));
if(!resolve(pasta).startsWith(resolve(tmpdir())+ '\\')&&!resolve(pasta).startsWith(resolve(tmpdir())+'/'))throw new Error('A homologação aceita apenas diretório temporário isolado.');
if(!/^nutrifoto-supabase-[a-z\d]+$/i.test(basename(pasta)))throw new Error('Projeto temporário sem prefixo de isolamento.');
const evidencias=resolve(raiz,'evidencias/comercial');await mkdir(evidencias,{recursive:true});
const resultado={inicio:new Date().toISOString(),ambiente:'Supabase real LOCAL descartável; não é homologação cloud',cli:null,migracoes:[],casos:[],backup:{},erro:null};
const projeto=basename(pasta),banco=`supabase_db_${projeto}`;
let pilhaIniciada=false;
const marcador=join(pasta,'.nutrifoto-homologacao-local.json');
if(valorArgumento('--workdir')){
 const propriedade=JSON.parse(await readFile(marcador,'utf8'));
 if(propriedade.projeto!==projeto||propriedade.raiz!==raiz)throw new Error('Diretório não pertence a este harness. Não será alterado.');
}else await writeFile(marcador,JSON.stringify({projeto,raiz}));
async function cli(args){return(await executarPrograma(executavel,[...args,'--workdir',pasta],{timeout:600000,maxBuffer:16*1024*1024})).stdout;}
async function sql(texto,base='postgres'){
 return new Promise((resolver,rejeitar)=>{const processo=spawn('docker',['exec','-i',banco,'psql','-X','-q','-v','ON_ERROR_STOP=1','-At','-U','postgres','-d',base]);let saida='',erro='';processo.stdout.on('data',parte=>saida+=parte);processo.stderr.on('data',parte=>erro+=parte);processo.on('error',rejeitar);processo.on('close',codigo=>codigo?rejeitar(new Error(erro)):resolver(saida.trim()));processo.stdin.end(texto);});
}
async function caso(nome,executar){await executar();resultado.casos.push({nome,estado:'APROVADA EM AMBIENTE LOCAL'});console.log(`APROVADO: ${nome}`);}
try{
 const contextos=JSON.parse((await executarPrograma('docker',['context','inspect'])).stdout);
 const hostDocker=process.env.DOCKER_HOST||contextos[0]?.Endpoints?.docker?.Host||'';
 if(!/^(?:npipe:\/\/|unix:\/\/|tcp:\/\/(?:127\.0\.0\.1|localhost):)/.test(hostDocker))throw new Error('Docker remoto não é permitido neste ensaio local.');
 if(argumentos.includes('--ja-iniciado'))pilhaIniciada=true;
 resultado.cli=(await executarPrograma(executavel,['--version'])).stdout.trim();
 if(!argumentos.includes('--ja-iniciado')){
  await cli(['init']);
  const configuracao=join(pasta,'supabase/config.toml');let texto=await readFile(configuracao,'utf8');
  texto=texto.replaceAll('54321','56321').replaceAll('54322','56322').replaceAll('54320','56320').replaceAll('54324','56324').replaceAll('54323','56323').replaceAll('54329','56329').replaceAll('enable_confirmations = false','enable_confirmations = true').replace('minimum_password_length = 6','minimum_password_length = 12').replace('email_sent = 2','email_sent = 100').replaceAll('http://127.0.0.1:3000','https://127.0.0.1:56443');
  await mkdir(join(pasta,'supabase/templates'),{recursive:true});
  for(const nome of ['confirmacao','recuperacao'])await copyFile(join(raiz,`supabase/templates/${nome}.html`),join(pasta,`supabase/templates/${nome}.html`));
  texto+='\n[auth.email.template.confirmation]\nsubject = "Confirme sua conta NutriFoto"\ncontent_path = "./supabase/templates/confirmacao.html"\n\n[auth.email.template.recovery]\nsubject = "Recupere sua conta NutriFoto"\ncontent_path = "./supabase/templates/recuperacao.html"\n';
  await writeFile(configuracao,texto);
  pilhaIniciada=true;
  await cli(['start','--exclude','realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor','--yes']);
 }
 const status=JSON.parse(await cli(['status','-o','json']));
 const origem=status.API_URL,mail=status.MAILPIT_URL||status.INBUCKET_URL;
 for(const endereco of [origem,mail])assert.equal(new URL(endereco).hostname,'127.0.0.1');
 async function chamar(caminho,{chave=status.ANON_KEY,token,method='GET',dados,corpo,tipo='application/json'}={}){
  const resposta=await fetch(origem+caminho,{method,headers:{apikey:chave,Authorization:`Bearer ${token||chave}`,'Content-Type':tipo},body:corpo??(dados===undefined?undefined:JSON.stringify(dados)),signal:AbortSignal.timeout(20000)});
  const texto=await resposta.text();let conteudo;try{conteudo=JSON.parse(texto);}catch{conteudo=texto;}
  return{status:resposta.status,dados:conteudo};
 }
 async function administrar(caminho,opcoes={}){return chamar(caminho,{...opcoes,chave:status.SERVICE_ROLE_KEY});}
 async function rpc(nome,dados){return administrar(`/rest/v1/rpc/${nome}`,{method:'POST',dados});}
 async function lerTokenEntregue(email,tipo){
  for(let tentativa=0;tentativa<40;tentativa++){
   const mensagens=await(await fetch(mail+'/api/v1/messages')).json();
   for(const mensagem of mensagens.messages||[]){
    if(!JSON.stringify(mensagem.To).includes(email))continue;
    const conteudo=await(await fetch(mail+'/api/v1/message/'+mensagem.ID)).json();
    const token=String(conteudo.HTML||conteudo.Text||'').match(new RegExp('#'+tipo+'=([a-z0-9]+)','i'))?.[1];
    if(token)return token;
   }
   await new Promise(resolver=>setTimeout(resolver,200));
  }
  throw new Error('Token não entregue pelo template no mailbox local.');
 }
 await caso('migrações próprias em Postgres Supabase real',async()=>{
  for(const arquivo of (await readdir(join(raiz,'supabase'))).filter(nome=>/^\d+.*\.sql$/.test(nome)).sort()){await sql(await readFile(join(raiz,'supabase',arquivo),'utf8'));resultado.migracoes.push(arquivo);}
 });
 // Link com TokenHash é gerado pelo Auth real. O endereço .test fica somente no Mailpit local.
 const pessoas=[];
 for(const nome of ['ana','bruno']){
  const email=`${nome}-${randomUUID().slice(0,8)}@exemplo.test`,senha='Teste-local-2026!';
  await caso(`Auth: cadastro ${nome} exige confirmação e entrega mensagem no mailbox local`,async()=>{
   const cadastro=await chamar('/auth/v1/signup',{method:'POST',dados:{email,password:senha}});assert.equal(cadastro.status,200);assert.ok(cadastro.dados.id);assert.equal(cadastro.dados.access_token,undefined);
   const entrada=await chamar('/auth/v1/token?grant_type=password',{method:'POST',dados:{email,password:senha}});assert.equal(entrada.status,400);
   const tokenHash=await lerTokenEntregue(email,'confirmacao');
   const verificado=await chamar('/auth/v1/verify',{method:'POST',dados:{type:'signup',token_hash:tokenHash}});assert.equal(verificado.status,200);assert.ok(verificado.dados.access_token);
   pessoas.push({email,senha,id:verificado.dados.user.id,token:verificado.dados.access_token,refresh:verificado.dados.refresh_token});
   const repetido=await chamar('/auth/v1/verify',{method:'POST',dados:{type:'signup',token_hash:tokenHash}});assert.ok(repetido.status>=400);
  });
 }
 const [ana,bruno]=pessoas;
 await caso('Auth: refresh real e sessão do proprietário',async()=>{
  const renovado=await chamar('/auth/v1/token?grant_type=refresh_token',{method:'POST',dados:{refresh_token:ana.refresh}});assert.equal(renovado.status,200);ana.token=renovado.dados.access_token;
  const sessao=JSON.parse(Buffer.from(ana.token.split('.')[1],'base64url')).session_id;
  assert.equal((await rpc('nf_sessao_ativa',{p_usuario:ana.id,p_sessao:sessao})).dados,true);
  assert.equal((await rpc('nf_sessao_ativa',{p_usuario:bruno.id,p_sessao:sessao})).dados,false);
 });
 await caso('Auth: recuperação real, token de uso único e nova senha',async()=>{
  assert.equal((await chamar('/auth/v1/recover',{method:'POST',dados:{email:ana.email}})).status,200);
  const tokenHash=await lerTokenEntregue(ana.email,'recuperacao');
  const sessao=await chamar('/auth/v1/verify',{method:'POST',dados:{type:'recovery',token_hash:tokenHash}});assert.equal(sessao.status,200);
  const novaSenha='Senha-nova-local-2026!';assert.equal((await chamar('/auth/v1/user',{method:'PUT',token:sessao.dados.access_token,dados:{password:novaSenha}})).status,200);
  assert.ok((await chamar('/auth/v1/verify',{method:'POST',dados:{type:'recovery',token_hash:tokenHash}})).status>=400);
  assert.ok((await chamar('/auth/v1/token?grant_type=password',{method:'POST',dados:{email:ana.email,password:ana.senha}})).status>=400);
  const entrada=await chamar('/auth/v1/token?grant_type=password',{method:'POST',dados:{email:ana.email,password:novaSenha}});assert.equal(entrada.status,200);ana.token=entrada.dados.access_token;
 });
 const pacote={meals:[],weights:[],water:[]};
 await caso('PostgREST: dados CAS, repetição, isolamento e bloqueio de acesso direto',async()=>{
  const argumentos={p_usuario:ana.id,p_dados:pacote,p_revisao:0,p_chave:'local-real-1',p_hash:'hash-local'};
  const gravado=await rpc('nf_gravar_dados',argumentos);assert.equal(gravado.status,200);assert.equal(gravado.dados.revisao,1);
  assert.equal((await rpc('nf_gravar_dados',argumentos)).dados.revisao,1);
  assert.equal((await rpc('nf_ler_dados',{p_usuario:bruno.id})).dados.revisao,0);
  for(const token of [status.ANON_KEY,ana.token,bruno.token]){
   assert.ok((await chamar('/rest/v1/nf_dados',{token})).status>=400);
   assert.ok((await chamar('/rest/v1/rpc/nf_ler_dados',{method:'POST',token,dados:{p_usuario:ana.id}})).status>=400);
  }
 });
 const imagem=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB4sAAAAASUVORK5CYII=','base64');
 const caminho=`${ana.id}/foto-teste.png`,bucket='nutrifoto-imagens';
 await caso('Storage: bucket privado, envio e leitura reais, anon e outro titular bloqueados',async()=>{
  assert.ok([200,201].includes((await administrar(`/storage/v1/object/${bucket}/${caminho}`,{method:'POST',corpo:imagem,tipo:'image/png'})).status));
  assert.equal((await administrar(`/storage/v1/object/authenticated/${bucket}/${caminho}`)).status,200);
  for(const token of [status.ANON_KEY,bruno.token])assert.ok((await chamar(`/storage/v1/object/authenticated/${bucket}/${caminho}`,{token})).status>=400);
  assert.ok((await chamar(`/storage/v1/object/public/${bucket}/${caminho}`)).status>=400);
 });
 await caso('Backup: dump PostgreSQL completo e restore em outro banco isolado',async()=>{
  const arquivo='/tmp/nutrifoto-homologacao.dump',destino=`nf_restore_${randomUUID().replaceAll('-','').slice(0,12)}`;
  await executarPrograma('docker',['exec',banco,'pg_dump','-U','postgres','-Fc','-f',arquivo,'postgres']);
  await executarPrograma('docker',['exec',banco,'createdb','-U','postgres',destino]);
  await executarPrograma('docker',['exec',banco,'pg_restore','-U','supabase_admin','--no-owner','--no-privileges','--exit-on-error','-d',destino,arquivo],{maxBuffer:8*1024*1024});
  assert.equal(await sql(`select revisao from public.nf_dados where usuario='${ana.id}';`,destino),'1');
  assert.equal(await sql(`select count(*) from auth.users where id='${ana.id}';`,destino),'1');
  resultado.backup.banco={formato:'pg_dump custom completo',restore:'outro database no Postgres temporário',verificados:['revisão da conta','Auth usuário']};
 });
 await caso('Backup: bytes Storage separados do dump, cópia restaurada e hash íntegro',async()=>{
  const resposta=await fetch(`${origem}/storage/v1/object/authenticated/${bucket}/${caminho}`,{headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:`Bearer ${status.SERVICE_ROLE_KEY}`}});assert.equal(resposta.status,200);const bytes=Buffer.from(await resposta.arrayBuffer());
  const copia=join(pasta,'backup-storage.png');await writeFile(copia,bytes);const restaurados=await readFile(copia);
  assert.ok([200,201].includes((await administrar(`/storage/v1/object/${bucket}/${ana.id}/restaurada.png`,{method:'POST',corpo:restaurados,tipo:'image/png'})).status));
  const restaurada=await fetch(`${origem}/storage/v1/object/authenticated/${bucket}/${ana.id}/restaurada.png`,{headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:`Bearer ${status.SERVICE_ROLE_KEY}`}});
  const hash=valor=>createHash('sha256').update(valor).digest('hex');assert.equal(hash(Buffer.from(await restaurada.arrayBuffer())),hash(imagem));resultado.backup.storage={objetos:1,bytes:bytes.length,sha256:hash(bytes),separadoDoDump:true};
 });
 await caso('Auth: exclusão real do titular e remoção em cascata dos dados comerciais',async()=>{
  // Storage é explicitamente removido antes do usuário; o dump não contém os bytes.
  const removido=await administrar(`/storage/v1/object/${bucket}`,{method:'DELETE',dados:{prefixes:[caminho,`${ana.id}/restaurada.png`]}});assert.equal(removido.status,200);
  assert.equal((await administrar(`/auth/v1/admin/users/${ana.id}`,{method:'DELETE'})).status,200);
  assert.equal(await sql(`select count(*) from public.nf_dados where usuario='${ana.id}';`),'0');
 });
 await caso('Integração UI HTTPS e BFF real com Supabase local',async()=>{
  resultado.integracaoHttps=await verificarIntegracaoHttps({pasta,status,lerTokenEntregue,evidencias});
 });
}catch(erro){resultado.erro=String(erro.message).replace(/eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/gi,'[JWT REMOVIDO]').replace(/sb_(?:secret|publishable)_[a-z0-9_-]+/gi,'[CHAVE LOCAL REMOVIDA]').slice(0,1500);process.exitCode=1;console.error('FALHA: '+resultado.erro);}
finally{
 resultado.fim=new Date().toISOString();
 // Exclusivamente o projeto criado por este script; não usa prune nem remove volumes alheios.
 if(pilhaIniciada&&!argumentos.includes('--manter')){try{await cli(['stop','--no-backup']);resultado.limpeza='Stack temporária removida.';}catch{resultado.limpeza='Falhou; executar stop --no-backup apenas no workdir temporário desta execução.';}}
 await writeFile(join(evidencias,'supabase-local.json'),JSON.stringify(resultado,null,2)+'\n');
}
