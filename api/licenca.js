import { criarApiLicencas } from '../servidor/licencas.js';
export const config = { api: { bodyParser: false } };
export const maxDuration = 60;
export default criarApiLicencas();
