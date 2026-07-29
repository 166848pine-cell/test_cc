import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, rateLimit } from '../../src/throttle';

describe('throttle.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('UT-T01: debounce 100ms内に3回 → 最後の1回のみ実行', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a');
    vi.advanceTimersByTime(30);
    d('b');
    vi.advanceTimersByTime(30);
    d('c');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('UT-T02: rateLimit(1000ms) 連続2回 → 2回目は1秒以上待つ', async () => {
    const calls: number[] = [];
    const fn = vi.fn(async () => {
      calls.push(Date.now());
    });
    const limited = rateLimit(fn, 1000);

    const start = Date.now();
    const p1 = limited();
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    const p2 = limited();
    await vi.advanceTimersByTimeAsync(500);
    expect(fn).toHaveBeenCalledTimes(1); // まだ2回目は実行されない
    await vi.advanceTimersByTimeAsync(600);
    expect(fn).toHaveBeenCalledTimes(2);
    await Promise.all([p1, p2]);
    expect(calls[1] - start).toBeGreaterThanOrEqual(1000);
  });
});
