// Stands in for a real payment processor integration: adds realistic
// network latency and an occasional decline, so the order-submission flow
// exercises the same success/failure paths it would against a real one.

const MIN_LATENCY_MS = 400;
const MAX_LATENCY_MS = 900;
const FAILURE_RATE = 0.15;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function submitToPaymentProcessor(): Promise<void> {
  const latency = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
  await sleep(latency);

  if (Math.random() < FAILURE_RATE) {
    throw new Error('payment processor declined the order');
  }
}
