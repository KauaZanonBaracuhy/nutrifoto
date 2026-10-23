// PostgreSQL real isolado; Asaas, atestado e IA são adaptadores explicitamente fictícios.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process'),{promisify}=require('node:util'),{createServer}=require('node:http');
const {generateKeyPairSync,createHash,sign,randomUUID}=require('node:crypto');
const executar=promisify(execFile),raiz=path.resolve(__dirname,'..'),pasta=path.join(raiz,'evidencias/licencas');fs.mkdirSync(pasta,{recursive:true});
const conteiner='nutrifoto-licencas-'+randomUUID().slice(0,8),resultados=[];let servidor,origem,chamadasIa=0,cobrancas=0,falharCliente=false,perderResposta=false;
const ambiente={NUTRIFOTO_SIMULADO:'true',APP_ORIGIN:'http://127.0.0.1:4173',LICENCAS_ANDROID:'true',ASAAS_AMBIENTE:'sandbox',ASAAS_WEBHOOK_TOKEN:'token-ficticio-de-webhook-2026-licencas',IA_ORCAMENTO_MENSAL_USD:'100000',IA_ORCAMENTO_USUARIO_MENSAL_USD:'100000',IA_RESERVA_OPERACAO_USD:'0.025',IA_PRECO_MAX_ENTRADA_USD_MILHAO:'0.15',IA_PRECO_MAX_SAIDA_USD_MILHAO:'0.6'};
function sql(texto){return new Promise((resolver,rejeitar)=>{const p=spawn('docker',['exec','-i',conteiner,'psql','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1']);let saida='',erros='';p.stdout.on('data',x=>saida+=x);p.stderr.on('data',x=>erros+=x);p.on('error',rejeitar);p.on('close',codigo=>codigo?rejeitar(new Error(erros)):resolver(saida.trim()));p.stdin.end(texto);});}
const literal=valor=>valor===null?'null':typeof valor==='object'?"'"+JSON.stringify(valor).replaceAll("'","''")+"'::jsonb":typeof valor==='string'?"'"+valor.replaceAll("'","''")+"'":String(valor);
const repositorio={async executar(nome,parametros={}){
 if(nome==='nf_limitar')return true;
 assert.match(nome,/^nf_licenca_/);const bruto=await sql('select '+nome+'('+Object.entries(parametros).map(([k,v])=>k+'=>'+literal(v)).join(',')+');');
 const valor=bruto==='t'?true:bruto==='f'?false:bruto?JSON.parse(bruto):null;
 if(valor?.erro)throw Object.assign(new Error(valor.erro),{status:valor.status});return valor;
}};
const pagamentos=new Map();
const asaas={async cliente(){if(falharCliente){falharCliente=false;throw Object.assign(new Error('Falha fictícia antes da cobrança'),{status:503});}return{id:'cus_teste'};},async criar(dados){cobrancas++;const p={...dados,id:'pay_'+randomUUID().replaceAll('-',''),status:'PENDING'};pagamentos.set(p.id,p);if(perderResposta){perderResposta=false;throw Object.assign(new Error('Resposta fictícia perdida'),{status:503});}return{...p};},async consultar(id){assert(pagamentos.has(id));return structuredClone(pagamentos.get(id));},async localizar(id){return{data:[...pagamentos.values()].filter(p=>p.externalReference===id).map(p=>({...p}))};},async qr(){return{encodedImage:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1kAAAAASUVORK5CYII=',payload:'PIX_FICTICIO_NAO_PAGAR',expirationDate:'2099-01-01'};}};
function dispositivo(){const par=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),publica=par.publicKey.export({type:'spki',format:'der'}).toString('base64');return{publica,chave:createHash('sha256').update(Buffer.from(publica,'base64')).digest('hex'),privada:par.privateKey,certificados:[]};}
async function enviar(d,pedido,retornarEnvelope=false){
 const nonce=await fetch(origem,{method:'POST',body:JSON.stringify({acao:'desafio'})}).then(r=>r.json());
 const resumo=createHash('sha256').update(JSON.stringify(pedido)).digest('hex');
 const envelope={publica:d.publica,chave:d.chave,certificados:[],nonce:nonce.nonce,pedido,assinatura:sign('sha256',Buffer.from('NF1\n'+nonce.nonce+'\n'+resumo),d.privada).toString('base64')};
 if(retornarEnvelope)return envelope;
 const resposta=await fetch(origem,{method:'POST',body:JSON.stringify(envelope)});return{status:resposta.status,dados:await resposta.json()};
}
async function comprar(d,plano='ia',intencao=randomUUID()) {const r=await enviar(d,{acao:'pix',plano,intencao,pagador:{nome:'Pessoa Fictícia',documento:'11144477735'}});assert.equal(r.status,200,JSON.stringify(r));return r.dados;}
async function webhook(pagamento,token=ambiente.ASAAS_WEBHOOK_TOKEN){const r=await fetch(origem.replace('/licenca','/asaas-webhook'),{method:'POST',headers:{'asaas-access-token':token},body:JSON.stringify({id:'evt_'+randomUUID(),payment:{id:pagamento.id,status:'RECEIVED'}})});return{status:r.status,dados:await r.json()};}
async function verificar(nome,acao){await acao();resultados.push({nome,resultado:'APROVADO'});console.log('APROVADO '+nome);}
(async()=>{try{
 await executar('docker',['run','--rm','--pull','never','--network','none','--name',conteiner,'-e','POSTGRES_HOST_AUTH_METHOD=trust','-d','postgres:15-alpine']);
 for(let i=0;i<90;i++){try{await sql('select 1');break;}catch{if(i===89)throw new Error('PostgreSQL não iniciou');await new Promise(r=>setTimeout(r,200));}}
 await sql('create role anon;create role authenticated;create role service_role;');await sql(fs.readFileSync(path.join(raiz,'supabase/005_licencas.sql'),'utf8'));
 const {criarApiLicencas}=await import('../servidor/licencas.js');
 const atender=criarApiLicencas({ambiente,repositorio,asaas,verificarAtestado:async()=>{},executarModelo:async()=>{chamadasIa++;return{alimentos:[{nome:'Arroz fictício',porcao_estimada_g:100,calorias:124,proteina_g:2.6,carboidrato_g:25.8,gordura_g:1}],total:{calorias:124,proteina_g:2.6,carboidrato_g:25.8,gordura_g:1},simulado:true,uso:{custoUsd:0,tokens:0}};}});
 servidor=createServer(atender);await new Promise(r=>servidor.listen(0,'127.0.0.1',r));origem='http://127.0.0.1:'+servidor.address().port+'/api/licenca';
 const a=dispositivo(),b=dispositivo();let id,primeira,segunda;
 await verificar('ofertas centralizadas, inscrição assinada e dois dispositivos isolados',async()=>{
  const ofertas=await fetch(origem).then(r=>r.json());assert.deepEqual(ofertas.planos.map(p=>[p.centavos,p.dias,p.fotos]),[[2490,30,50],[3490,30,100]]);
  const x=await enviar(a,{acao:'situacao'}),y=await enviar(b,{acao:'situacao'});assert.equal(x.status,200);assert.equal(x.dados.ativa,false);assert.notEqual(x.dados.id,y.dados.id);id=x.dados.id;
 });
 await verificar('assinatura adulterada e nonce repetido são recusados',async()=>{
  const e=await enviar(a,{acao:'situacao'},true),op={method:'POST',body:JSON.stringify(e)};
  assert.equal((await fetch(origem,op)).status,200);assert.equal((await fetch(origem,op)).status,403);
  e.pedido.acao='recuperacao';assert.equal((await fetch(origem,{method:'POST',body:JSON.stringify(e)})).status,403);
 });
 await verificar('Pix pendente não ativa; criação repetida não duplica cobrança',async()=>{
  primeira=await comprar(a);assert.equal(primeira.ativa,false);assert.equal(primeira.qr.payload,'PIX_FICTICIO_NAO_PAGAR');
  await comprar(a,'ia',primeira.compra);assert.equal(cobrancas,1);
  const p=[...pagamentos.values()][0];assert.equal((await webhook(p,'invalido')).status,403);assert.equal((await webhook(p)).status,200);
  assert.equal((await enviar(a,{acao:'situacao'})).dados.ativa,false);
 });
 await verificar('confirmação consultada no provedor ativa 30 dias uma única vez',async()=>{
  const p=[...pagamentos.values()][0];p.status='RECEIVED';await webhook(p);const antes=(await enviar(a,{acao:'situacao'})).dados;
  assert(antes.ativa);assert.equal(antes.diasRestantes,30);await webhook(p);assert.equal((await enviar(a,{acao:'situacao'})).dados.validade,antes.validade);
  const guardado=await enviar(a,{acao:'situacao'});assert.equal(guardado.dados.id,id);assert.equal(guardado.dados.ativa,true);
 });
 await verificar('análise fictícia tem reserva financeira atômica e retry sem nova execução',async()=>{
  const pedido={acao:'analise',ciencia:true,intencao:randomUUID(),dados:{tipo:'foto',mediaType:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1kAAAAASUVORK5CYII='}};
  assert.equal((await enviar(a,pedido)).status,200);assert.equal((await enviar(a,pedido)).status,200);assert.equal(chamadasIa,1);
  assert.equal((await enviar(a,{...pedido,dados:{tipo:'texto',texto:'outro'}})).status,409);
  assert.equal((await enviar(a,{...pedido,intencao:randomUUID(),dados:{tipo:'plano'}})).status,403);
 });
 await verificar('última vaga diária concorrente aceita uma análise; excedentes são bloqueados',async()=>{
  await sql(`insert into nf_licenca_operacoes select '${id}',gen_random_uuid(),'ficticio','foto',(now() at time zone 'America/Sao_Paulo')::date,date_trunc('month',now())::date,0,'{}',0 from generate_series(1,48);`);
  const pedidos=await Promise.all(Array.from({length:4},()=>enviar(a,{acao:'analise',ciencia:true,intencao:randomUUID(),dados:{tipo:'foto',mediaType:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1kAAAAASUVORK5CYII='}})));
  assert.equal(pedidos.filter(r=>r.status===200).length,1,JSON.stringify(pedidos));assert.equal(pedidos.filter(r=>r.status===429).length,3);
  assert.equal((await enviar(a,{acao:'situacao'})).dados.uso.fotos,50);
  await sql(`update nf_licenca_operacoes set dia=dia-1 where licenca='${id}';`);
  assert.equal((await enviar(a,{acao:'situacao'})).dados.uso.fotos,0);
 });
 await verificar('renovação antecipada soma 30 dias sem renovação automática',async()=>{
  const antes=(await enviar(a,{acao:'situacao'})).dados.validade;segunda=await comprar(a);
  const p=[...pagamentos.values()].find(p=>p.externalReference===segunda.compra);p.status='RECEIVED';await webhook(p);
  assert.equal(Date.parse((await enviar(a,{acao:'situacao'})).dados.validade)-Date.parse(antes),30*86400000);
 });
 await verificar('código secreto transfere a licença; aparelho anterior perde acesso',async()=>{
  assert.equal((await enviar(b,{acao:'transferir',codigo:'x'.repeat(43)})).status,403);
  const codigo=(await enviar(a,{acao:'recuperacao'})).dados.codigo;
  const atual=await enviar(b,{acao:'transferir',codigo});assert.equal(atual.status,200,JSON.stringify(atual));assert.equal(atual.dados.id,id);assert(atual.dados.ativa);
  assert.equal((await enviar(a,{acao:'situacao'})).dados.ativa,false);assert.equal((await enviar(a,{acao:'transferir',codigo})).status,403);
 });
 await verificar('vencimento bloqueia IA, mantendo registros e licença para renovação',async()=>{
  await sql(`update nf_licencas set estado=jsonb_set(estado,'{validade}',to_jsonb((now()-interval '1 day')::text)),revisao=revisao+1 where id='${id}';`);
  assert.equal((await enviar(b,{acao:'situacao'})).dados.ativa,false);
  assert.equal((await enviar(b,{acao:'analise',ciencia:true,intencao:randomUUID(),dados:{tipo:'texto',texto:'arroz'}})).status,403);
 });
 await verificar('Completo tem 100 fotos; acompanhamento depende de licença vigente',async()=>{
  const c=dispositivo();await enviar(c,{acao:'situacao'});const compra=await comprar(c,'completo');const p=[...pagamentos.values()].find(p=>p.externalReference===compra.compra);p.status='RECEIVED';await webhook(p);
  assert.equal((await enviar(c,{acao:'autorizar',recurso:'acompanhamento'})).status,200);
  assert.equal((await enviar(a,{acao:'autorizar',recurso:'acompanhamento'})).status,403);
  const s=(await enviar(c,{acao:'situacao'})).dados;assert(s.acompanhamento);assert.equal(s.planos.find(p=>p.id==='completo').fotos,100);
  await sql(`insert into nf_licenca_operacoes select '${s.id}',gen_random_uuid(),'ficticio','foto',(now() at time zone 'America/Sao_Paulo')::date,date_trunc('month',now())::date,0,'{}',0 from generate_series(1,100);`);
  const excedeu=await enviar(c,{acao:'analise',ciencia:true,intencao:randomUUID(),dados:{tipo:'foto',mediaType:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1kAAAAASUVORK5CYII='}});assert.equal(excedeu.status,429);assert.match(excedeu.dados.erro,/Franquia/);
 });
 await verificar('falha antes da cobrança permite tentar; timeout após criação consulta sem duplicar; cancelamento não ativa',async()=>{
  const c=dispositivo();await enviar(c,{acao:'situacao'});const intencao=randomUUID(),pedido={acao:'pix',plano:'ia',intencao,pagador:{nome:'Pessoa Fictícia',documento:'11144477735'}};
  falharCliente=true;assert.equal((await enviar(c,pedido)).status,503);const antes=cobrancas;
  perderResposta=true;assert.equal((await enviar(c,pedido)).status,503);assert.equal((await enviar(c,pedido)).status,200);assert.equal(cobrancas,antes+1);
  const retomada=(await enviar(c,{acao:'situacao'})).dados;assert.equal(retomada.compraPendente,intencao);assert(retomada.qr);
  const p=[...pagamentos.values()].find(p=>p.externalReference===intencao);p.deleted=true;await webhook(p);
  const cancelada=(await enviar(c,{acao:'situacao',compra:intencao})).dados;assert.equal(cancelada.ativa,false);assert.equal(cancelada.compraStatus,'REVERTIDA');assert.equal(cancelada.qr,null);
 });
 await verificar('reembolso suspende benefícios; webhook antigo não reativa',async()=>{
  const p=[...pagamentos.values()][0];p.status='REFUNDED';p.refunds=[{status:'DONE'}];await webhook(p);
  const s=(await enviar(b,{acao:'situacao'})).dados;assert(s.bloqueada);p.status='RECEIVED';await webhook(p);assert.equal((await enviar(b,{acao:'situacao'})).dados.ativa,false);
 });
 await verificar('orçamento SQL limita configuração excessiva e não expõe tabelas a clientes',async()=>{
  const c=dispositivo();await enviar(c,{acao:'situacao'});const compra=await comprar(c);const p=[...pagamentos.values()].find(p=>p.externalReference===compra.compra);p.status='RECEIVED';await webhook(p);
  await sql(`update nf_licenca_orcamentos set valor=100 where escopo='global';`);
  assert.equal((await enviar(c,{acao:'analise',ciencia:true,intencao:randomUUID(),dados:{tipo:'texto',texto:'arroz'}})).status,429);
  await assert.rejects(()=>sql('set role anon;select * from nf_licencas;'),/permission denied/);
  await assert.rejects(()=>sql("set role authenticated;select nf_licenca_ler('x');"),/permission denied/);
 });
 console.log('13 grupos aprovados: PostgreSQL real; Asaas, atestado e IA simulados. Nenhuma chamada externa.');
}catch(erro){console.error(erro);process.exitCode=1;resultados.push({resultado:'REPROVADO',erro:erro.stack});}
finally{await new Promise(r=>servidor?servidor.close(r):r());await executar('docker',['rm','-f',conteiner]).catch(()=>{});fs.writeFileSync(path.join(pasta,'postgres.json'),JSON.stringify({ambiente:'PostgreSQL real isolado, sem portas; Asaas/atestado/IA ficticios',chamadasIa,cobrancas,resultados},null,2));}})();
