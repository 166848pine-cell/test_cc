/** 最後の呼び出しからms経過後に1回だけ実行する。 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, ms);
  };
}

/** 前回実行からintervalMs未満なら待ってから実行する(直列化)。 */
export function rateLimit<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  intervalMs: number,
): (...args: A) => Promise<R> {
  let last = 0;
  let chain: Promise<unknown> = Promise.resolve();
  return (...args: A) => {
    const run = async (): Promise<R> => {
      const wait = last + intervalMs - Date.now();
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait));
      }
      last = Date.now();
      return fn(...args);
    };
    const p = chain.then(run, run);
    chain = p.then(
      () => undefined,
      () => undefined,
    );
    return p;
  };
}
