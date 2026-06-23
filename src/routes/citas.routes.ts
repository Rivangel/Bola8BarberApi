import { Router } from 'express';
import {
  postCita,
  getCitasPorFecha,
  putCita,
  deleteCita,
} from '../controllers/citas.controller';

const router = Router();

router.post('/citas', postCita);
router.get('/citas', getCitasPorFecha);
router.put('/citas/:id', putCita);
router.delete('/citas/:id', deleteCita);

export default router;
