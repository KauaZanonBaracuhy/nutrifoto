import teste from 'node:test';
import assert from 'node:assert/strict';
import {localDate,validarDia,deslocarDia,calcularStreak} from '../www/js/datas.js';
teste('calendário cruza mês/ano e rejeita dias inexistentes',()=>{assert.equal(deslocarDia('2026-12-31',1),'2027-01-01');assert.throws(()=>validarDia('2026-02-30'));assert.equal(localDate('2026-10-21'),'2026-10-21');});
teste('streak real começa hoje ou ontem e ignora duplicatas',()=>{assert.equal(calcularStreak(['2026-10-20','2026-10-19','2026-10-19'],'2026-10-21'),2);assert.equal(calcularStreak(['2026-10-19'],'2026-10-21'),0);assert.equal(calcularStreak(['2026-10-21','2026-10-20'],'2026-10-21'),2);});
