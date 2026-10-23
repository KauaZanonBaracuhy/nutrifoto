import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {parse} from 'acorn';
test('imports locais do frontend apontam para arquivos empacotados existentes',()=>{
  const pasta=resolve(import.meta.dirname,'../www/js');
  for(const nome of readdirSync(pasta).filter(nome=>nome.endsWith('.js'))){
    const arquivo=resolve(pasta,nome),arvore=parse(readFileSync(arquivo,'utf8'),{ecmaVersion:'latest',sourceType:'module'});
    for(const trecho of arvore.body){
      const origem=trecho.source?.value;
      if(typeof origem==='string'&&origem.startsWith('.'))assert(existsSync(resolve(dirname(arquivo),origem)),nome+' importa um arquivo ausente: '+origem);
    }
  }
});
