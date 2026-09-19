import { Router } from 'express';
import { asyncHandler } from '../errors';
import { getCurrentCurve } from './curveService';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await getCurrentCurve());
  })
);

export default router;
