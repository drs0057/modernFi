// Stands in for a real payment processor integration. It adds realistic
// network latency and always accepts the order.

const MIN_LATENCY_MS = 400;
const MAX_LATENCY_MS = 900;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A real processor dedupes on the idempotency key, so a retry after a
// timeout never charges twice, even across backend processes. The mock
// accepts the key and ignores it, so it does not dedupe.
export async function submitToPaymentProcessor(_idempotencyKey: string): Promise<void> {
  const latency = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
  await sleep(latency);
}
