import { Router } from 'express';
import { asyncHandler } from '../errors';
import { Term } from '../terms';
import { parseOrderListQuery } from './listQuery';
import { listOrders } from './orderRepository';
import { placeOrder, quoteOrder } from './orderService';
import { isIdempotencyKey, validateOrderInput } from './validation';

const router = Router();

router.get(
  '/quote',
  asyncHandler(async (req, res) => {
    const term = req.query.term;
    const amount = Number(req.query.amount);

    const invalid = validateOrderInput(term, amount);
    if (invalid) {
      return res.status(400).json({ error: invalid });
    }

    res.json(await quoteOrder({ term: term as Term, amount }));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const key = req.header('Idempotency-Key');
    if (!isIdempotencyKey(key)) {
      return res.status(400).json({ error: 'Idempotency-Key header must be a UUID' });
    }

    const { term, amount } = req.body ?? {};
    const invalid = validateOrderInput(term, amount);
    if (invalid) {
      return res.status(400).json({ error: invalid });
    }

    const { order, replayed } = await placeOrder(key, { term, amount });
    if (replayed) {
      res.set('Idempotent-Replayed', 'true');
    }
    res.status(replayed ? 200 : 201).json(order);
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseOrderListQuery(req.query);
    const { orders, total } = await listOrders(query);
    res.json({ orders, total, ...query });
  })
);

export default router;
