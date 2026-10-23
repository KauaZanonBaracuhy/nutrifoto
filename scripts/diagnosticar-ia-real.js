import { prepararDiagnostico } from '../testes/apoio/controle-ia-real.js';
try{console.log(JSON.stringify(await prepararDiagnostico(),null,2));}
catch(erro){console.error(erro.message);process.exitCode=1;}
