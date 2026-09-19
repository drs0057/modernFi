import express from 'express';
import cors from 'cors';
import { errorMiddleware } from './errors';
import ordersRouter from './orders/routes';
import yieldCurveRouter from './yieldCurve/routes';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/yield-curve', yieldCurveRouter);
  app.use('/api/orders', ordersRouter);
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use(errorMiddleware);
  return app;
}
