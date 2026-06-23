import { Router } from 'express';
import { verificarWebhook, recibirWebhook } from '../controllers/webhook.controller';
import { verifySignature } from '../middleware/verifySignature';

const router = Router();

// Handshake de verificación (sin firma, Meta solo manda query params).
router.get('/webhook', verificarWebhook);

// Recepción de mensajes (verificamos la firma de Meta antes de procesar).
router.post('/webhook', verifySignature, recibirWebhook);

export default router;
