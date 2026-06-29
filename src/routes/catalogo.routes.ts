import { Router } from 'express';
import { getServicios, getBarberos } from '../controllers/catalogo.controller';

const router = Router();

router.get('/servicios', getServicios);
router.get('/barberos', getBarberos);

export default router;
