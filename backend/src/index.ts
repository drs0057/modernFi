import express from 'express';
import cors from 'cors';
import yieldCurveRouter from './routes/yieldCurve';
import ordersRouter from './routes/orders';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/yield-curve', yieldCurveRouter);
app.use('/api/orders', ordersRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => console.log(`backend listening on ${PORT}`));
