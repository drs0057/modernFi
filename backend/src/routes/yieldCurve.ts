import { Router } from 'express';
import { getCurrentCurve } from '../curveService';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    res.json(await getCurrentCurve());
  } catch {
    res.status(502).json({ error: 'failed to fetch treasury data' });
  }
});

export default router;
