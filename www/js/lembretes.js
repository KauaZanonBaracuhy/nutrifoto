import { localDate } from "./db.js";
import { avisar, lerLembretes } from "./base.js";
// ============ NOTIFICATION SCHEDULING ============
export const _notifTimers = [];

export function agendarLembretes() {
  _notifTimers.forEach(id => clearInterval(id)); _notifTimers.length=0;
  const enviados = new Set();
  function verificarLembretes() {
    const agora=new Date();const horario=String(agora.getHours()).padStart(2,'0')+':'+String(agora.getMinutes()).padStart(2,'0');
    const preferencias=lerLembretes();const lembretes=[...(preferencias.meals||[]),{name:'registro alimentar',enabled:preferencias.streakEnabled,time:preferencias.streakTime}];
    for(const lembrete of lembretes){const chave=localDate()+':'+lembrete.name;if(!lembrete.enabled||lembrete.time!==horario||enviados.has(chave))continue;enviados.add(chave);avisar('Lembrete: '+lembrete.name);}
  }
  verificarLembretes();_notifTimers.push(setInterval(verificarLembretes,30000));
}

