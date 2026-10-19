import { debounce } from '../core/data/channel-events';

describe('live channel updates', () => {
  it('turn a burst of changes into one refresh', () => {
    vi.useFakeTimers();
    let runs = 0;
    const refresh = debounce(() => runs++, 1_500);
    refresh(); refresh();
    vi.advanceTimersByTime(1_000);
    refresh();
    vi.advanceTimersByTime(1_499);
    expect(runs).toBe(0);
    vi.advanceTimersByTime(1);
    expect(runs).toBe(1);
    vi.useRealTimers();
  });
});
