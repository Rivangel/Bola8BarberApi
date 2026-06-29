import { Router } from 'express';
import { getClientes, putCliente, getHistorialCliente } from '../controllers/clientes.controller';

const router = Router();

router.get('/clientes', getClientes);
router.put('/clientes/:id', putCliente);
router.get('/clientes/:telefono/historial', getHistorialCliente);

export default router;
