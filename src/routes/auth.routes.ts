import { Router } from 'express';
import { postLogin, getMe } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.post('/auth/login', postLogin);
router.get('/auth/me', requireAuth, getMe);

export default router;
