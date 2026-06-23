import { Router } from 'express';
import { getClientes, getHistorialCliente } from '../controllers/clientes.controller';

const router = Router();

router.get('/clientes', getClientes);
router.get('/clientes/:telefono/historial', getHistorialCliente);

export default router;
