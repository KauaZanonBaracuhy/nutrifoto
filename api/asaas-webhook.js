import { criarApiLicencas } from '../servidor/licencas.js';
export const config = { api: { bodyParser: false } };
export default criarApiLicencas();
