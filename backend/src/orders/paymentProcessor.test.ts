import { submitToPaymentProcessor } from './paymentProcessor';

const KEY = '3f2b1c9e-7a44-4d0e-9c1a-5b6d8e2f1a70';

describe('submitToPaymentProcessor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('resolves when the simulated processor accepts the order', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const promise = submitToPaymentProcessor(KEY);
    await jest.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects when the simulated processor declines the order', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const promise = submitToPaymentProcessor(KEY);
    // Attach the rejection handler before advancing timers, so the promise
    // is never briefly unhandled once it settles.
    const assertion = expect(promise).rejects.toThrow('payment processor declined the order');
    await jest.advanceTimersByTimeAsync(1000);

    await assertion;
  });

  it('waits out a randomized delay before settling', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const promise = submitToPaymentProcessor(KEY);
    let settled = false;
    promise.then(() => {
      settled = true;
    });

    await jest.advanceTimersByTimeAsync(100);
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(900);
    expect(settled).toBe(true);
  });
});
