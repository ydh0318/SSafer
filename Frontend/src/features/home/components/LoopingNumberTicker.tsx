import { useEffect, useMemo, useState } from 'react';

type LoopingNumberTickerProps = {
  from?: number;
  to: number;
  durationMs?: number;
  edgeHoldMs?: number;
  className?: string;
  formatter?: (value: number) => string;
};

function LoopingNumberTicker({
  from = 0,
  to,
  durationMs = 980,
  edgeHoldMs = 170,
  className = '',
  formatter,
}: LoopingNumberTickerProps) {
  const resolvedFormatter = useMemo(
    () => formatter ?? ((value: number) => new Intl.NumberFormat('ko-KR').format(value)),
    [formatter],
  );
  const [value, setValue] = useState(from);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (reducedMotion.matches) {
      setValue(to);
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
        setValue(nextValue);
      }

      animationFrameId = window.requestAnimationFrame(tick);
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [durationMs, edgeHoldMs, from, to]);

  return (
    <span
      aria-label={`0부터 ${to.toLocaleString('ko-KR')}까지 반복 증감하는 취약점 수`}
      className={`inline-flex min-w-[4.8ch] items-center justify-center whitespace-nowrap text-center tabular-nums ${className}`.trim()}
    >
      {resolvedFormatter(value)}
    </span>
  );
}

export default LoopingNumberTicker;
