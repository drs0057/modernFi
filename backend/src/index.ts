import express from 'express';
import cors from 'cors';
import yieldCurveRouter from './routes/yieldCurve';
import { refreshYieldCurve } from './treasury';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/yield-curve', yieldCurveRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;

refreshYieldCurve()
  .then((result) => console.log('startup yield curve refresh ok', result))
  .catch((err) => console.error('startup yield curve refresh failed', err))
  .finally(() => {
    app.listen(PORT, () => console.log(`backend listening on ${PORT}`));
  });
