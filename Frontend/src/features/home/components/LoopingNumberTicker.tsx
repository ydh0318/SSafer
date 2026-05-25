import { useEffect, useMemo, useState } from 'react';

type LoopingNumberTickerProps = {
  from?: number;
  to: number;
  durationMs?: number;
  edgeHoldMs?: number;
  className?: string;
  formatter?: (value: number) => string;
  paused?: boolean;
};

function LoopingNumberTicker({
  from = 0,
  to,
  durationMs = 980,
  edgeHoldMs = 170,
  className = '',
  formatter,
  paused = false,
}: LoopingNumberTickerProps) {
  const resolvedFormatter = useMemo(
    () => formatter ?? ((value: number) => new Intl.NumberFormat('ko-KR').format(value)),
    [formatter],
  );
  const [state, setState] = useState({ from, to, value: from });
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const value =
    paused || prefersReducedMotion
      ? to
      : state.from === from && state.to === to
        ? state.value
        : from;

  useEffect(() => {
    if (paused || prefersReducedMotion) {
      return undefined;
    }

    let animationFrameId = 0;
    let startedAt = 0;
    let lastValue = from;
    const range = to - from;
    const cycleMs = durationMs * 2 + edgeHoldMs * 2;

    const tick = (timestamp: number) => {
      if (startedAt === 0) {
        startedAt = timestamp;
      }

      const elapsed = (timestamp - startedAt) % cycleMs;
      const progress =
        elapsed < durationMs
          ? elapsed / durationMs
          : elapsed < durationMs + edgeHoldMs
            ? 1
            : elapsed < durationMs * 2 + edgeHoldMs
              ? 1 - (elapsed - durationMs - edgeHoldMs) / durationMs
              : 0;
      const nextValue = Math.round(from + range * progress);

      if (nextValue !== lastValue) {
        lastValue = nextValue;
        setState({
          from,
          to,
          value: nextValue,
        });
      }

      animationFrameId = window.requestAnimationFrame(tick);
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [durationMs, edgeHoldMs, from, to, paused, prefersReducedMotion]);

  return (
    <span
      aria-label={`0부터 ${to.toLocaleString('ko-KR')}까지 반복 증가하는 취약점 수`}
      className={`inline-flex min-w-[4.8ch] items-center justify-center whitespace-nowrap text-center tabular-nums ${className}`.trim()}
    >
      {resolvedFormatter(value)}
    </span>
  );
}

export default LoopingNumberTicker;
