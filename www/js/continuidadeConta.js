// Identifica somente qual banco local reabrir. Nunca concede sessão ou acesso ao servidor.
const CHAVE='nutrifoto.ultimaContaOffline';
let contaOffline=null;
function validarId(id){return typeof id==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id);}
export function lembrarContaVerificada(id){
 contaOffline=null;
 try{if(validarId(id))localStorage.setItem(CHAVE,id);else localStorage.removeItem(CHAVE);}catch{}
}
export function restaurarContaOffline(){
 try{const id=localStorage.getItem(CHAVE);contaOffline=validarId(id)?id:null;}catch{contaOffline=null;}
 return contaOffline;
}
export function obterContaOffline(){return contaOffline;}
export function esquecerContinuidadeConta(){contaOffline=null;try{localStorage.removeItem(CHAVE);}catch{}}
