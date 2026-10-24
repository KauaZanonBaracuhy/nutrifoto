import { criarAplicacao } from '../servidor/aplicacao.js';
export const config = { api: { bodyParser: false } };
export default criarAplicacao();
