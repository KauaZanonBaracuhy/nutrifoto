import { criarAplicacao } from '../servidor/aplicacao.js';
export const config = { api: { bodyParser: false } };
export const maxDuration = 60;
export default criarAplicacao();
