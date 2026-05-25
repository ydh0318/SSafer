import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import SiteHeader from '../../../components/layout/SiteHeader';

type AppleData = {
  bittenSrc: string;
  bubble: string;
  code: string;
  dangerRange: readonly [number, number];
};

const APPLES: AppleData[] = [
  {
    bittenSrc: '/landing/1bite.png',
    bubble: '비밀번호가 그대로 노출됨',
    code: 'DB_PASSWORD=mysecret123',
    dangerRange: [12, 23],
  },
  {
    bittenSrc: '/landing/2bite.png',
    bubble: '서버 권한이 과도하게 열림',
    code: 'privileged: true',
    dangerRange: [12, 16],
  },
  {
    bittenSrc: '/landing/nbite.png',
    bubble: 'DB 포트가 외부에 그대로 열림',
    code: '0.0.0.0:3306:3306',
    dangerRange: [0, 7],
  },
];

function useTypewriter(text: string, speed = 36) {
  const [state, setState] = useState({ displayed: '', text });
  const displayed = state.text === text ? state.displayed : '';
  const done = displayed === text;

  useEffect(() => {
    if (!text) {
      return undefined;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let index = 0;

    const tick = () => {
      if (cancelled) {
        return;
      }

      index += 1;
      setState({
        displayed: text.slice(0, index),
        text,
      });

      if (index < text.length) {
        const jitter = Math.floor(Math.random() * 40);
        timer = setTimeout(tick, speed + jitter);
      }
    };

    timer = setTimeout(tick, 220);

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [text, speed]);

  return { displayed, done };
}

function TerminalLine({ code, dangerRange }: { code: string; dangerRange: readonly [number, number] }) {
  const { displayed, done } = useTypewriter(code);
  const [dangerStart, dangerEnd] = dangerRange;
  const length = displayed.length;
  const cutStart = Math.min(dangerStart, length);
  const cutEnd = Math.min(dangerEnd, length);

  const safeBefore = displayed.slice(0, cutStart);
  const dangerPart = displayed.slice(cutStart, cutEnd);
  const safeAfter = displayed.slice(cutEnd);

  return (
    <code className="terminal-code text-base leading-none">
      <span className="text-red-400/80">! </span>
      <span className="text-white/90">{safeBefore}</span>
      <span className="terminal-danger">{dangerPart}</span>
      <span className="text-white/90">{safeAfter}</span>
      {!done ? (
        <span className="terminal-cursor ml-0.5 inline-block h-[1.05em] w-[0.5em] translate-y-[0.18em] bg-red-400" />
      ) : (
        <motion.span
          animate={{ opacity: 1, scale: 1, x: 0 }}
          className="vuln-badge ml-2.5 inline-flex items-center gap-1 rounded border border-red-500/50 bg-red-500/15 px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-[0.14em] text-red-300"
          initial={{ opacity: 0, scale: 0.5, x: -10 }}
          transition={{ type: 'spring', damping: 14, stiffness: 320 }}
        >
          <span aria-hidden="true">!</span>
          INSECURE
        </motion.span>
      )}
    </code>
  );
}

type AppleHeroSectionProps = {
  bottomFadeColor?: string;
  showHeader?: boolean;
};

function AppleHeroSection({ bottomFadeColor, showHeader = true }: AppleHeroSectionProps = {}) {
  const [bitten, setBitten] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleAppleClick = (index: number) => {
    const wasBitten = bitten[index];
    setBitten((prev) => {
      const next = [...prev] as [boolean, boolean, boolean];
      next[index] = !wasBitten;
      return next;
    });

    if (wasBitten) {
      if (activeIndex === index) {
        setActiveIndex(null);
      }
    } else {
      setActiveIndex(index);
    }
  };

  const hasFade = Boolean(bottomFadeColor);

  return (
    <section className={`relative w-full overflow-hidden bg-black text-white ${hasFade ? 'h-[160vh]' : 'h-screen'}`}>
      {hasFade ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[60vh]"
          style={{ background: `linear-gradient(to bottom, transparent, ${bottomFadeColor})` }}
        />
      ) : null}

      <div className={hasFade ? 'sticky top-0 h-screen' : 'h-full'}>
        {showHeader ? <SiteHeader showSessionBar={false} variant="transparent" /> : null}

        <main className="relative z-10 flex h-[calc(100vh-4rem)] flex-col items-center px-8 pt-2 md:pt-4">
          <div className="grid w-full max-w-6xl grid-cols-3 gap-x-6">
            {APPLES.map((apple, index) => {
              const isBitten = bitten[index];
              const isActive = activeIndex === index;

              return (
                <div className="relative flex flex-col items-center" key={index}>
                  <div className="relative flex h-44 w-full items-end justify-center">
                    <AnimatePresence>
                      {isActive ? (
                        <motion.div
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute bottom-0 flex flex-col items-center"
                          exit={{ opacity: 0, y: -12 }}
                          initial={{ opacity: 0, y: -8 }}
                          key="overlay"
                          transition={{ duration: 0.28, ease: 'easeOut' }}
                        >
                          <motion.div
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.5, y: 10 }}
                            initial={{ opacity: 0, scale: 0.4, y: 16 }}
                            transition={{ type: 'spring', damping: 12, stiffness: 340 }}
                          >
                            <motion.div
                              animate={{ y: [0, -3, 0, -3, 0], rotate: [0, -1.4, 1.4, -1.4, 0] }}
                              className="relative rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800 shadow-[0_12px_30px_rgba(0,0,0,0.55)]"
                              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                            >
                              {apple.bubble}
                              <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white" />
                            </motion.div>
                          </motion.div>

                          <div className="h-3" />

                          <motion.div
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.7, y: -8 }}
                            initial={{ opacity: 0, scale: 0.6, y: -18 }}
                            transition={{ delay: 0.05, type: 'spring', damping: 12, stiffness: 300 }}
                          >
                            <motion.img
                              alt=""
                              animate={{ y: [0, -3, 0, -3, 0], rotate: [0, -6, 6, -6, 0] }}
                              className="h-16 w-16 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.75)]"
                              src="/landing/doguk.png"
                              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                            />
                          </motion.div>
                        </motion.div>
                      ) : !isBitten ? (
                        <motion.div
                          animate={{ opacity: 1 }}
                          className="take-a-bite select-none text-white/90"
                          exit={{ opacity: 0 }}
                          initial={{ opacity: 0 }}
                          key="cta"
                          transition={{ duration: 0.25 }}
                        >
                          Take a bite !
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  <motion.button
                    aria-label={isBitten ? `사과 ${index + 1} 되돌리기` : `사과 ${index + 1} 베어 물기`}
                    className="relative h-64 w-64 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 md:h-72 md:w-72"
                    onClick={() => handleAppleClick(index)}
                    type="button"
                    whileHover={!isBitten ? { scale: 1.07, y: -6 } : { scale: 1.03 }}
                    whileTap={{ scale: 0.9, rotate: -8 }}
                  >
                    <AnimatePresence initial={false}>
                      <motion.div
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        className="absolute inset-0"
                        exit={{ opacity: 0, scale: 1.12, rotate: 6 }}
                        initial={{ opacity: 0, scale: 0.82, rotate: -6 }}
                        key={isBitten ? `bitten-${index}` : `fresh-${index}`}
                        transition={{ type: 'spring', damping: 14, stiffness: 260 }}
                      >
                        <motion.img
                          alt="apple"
                          animate={isBitten ? { y: 0, rotate: 0 } : { y: [0, -7, 0], rotate: [0, -1.2, 1.2, 0] }}
                          className={`h-full w-full select-none object-contain ${isBitten ? '' : 'fresh-apple-glow'}`}
                          draggable={false}
                          src={isBitten ? apple.bittenSrc : '/landing/apple.png'}
                          transition={
                            isBitten ? { duration: 0.3 } : { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }
                          }
                        />
                      </motion.div>
                    </AnimatePresence>
                  </motion.button>

                  <div className="-mt-2 flex h-9 w-full items-center justify-center">
                    <AnimatePresence>
                      {isActive ? (
                        <motion.div
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          initial={{ opacity: 0, y: 10 }}
                          key="code"
                          transition={{ delay: 0.18, duration: 0.28 }}
                        >
                          <TerminalLine code={apple.code} dangerRange={apple.dangerRange} />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>

          <motion.div
            animate={{ y: [0, 8, 0], opacity: [0.55, 1, 0.55] }}
            className="mt-auto pb-44 text-xs font-light tracking-[0.4em] text-white/60"
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            SCROLL DOWN
          </motion.div>
        </main>
      </div>

      <style>{`
        .take-a-bite {
          font-family: 'Montserrat', "Segoe UI", "Helvetica Neue", sans-serif;
          font-size: 1.55rem;
          font-weight: 200;
          letter-spacing: 0.18em;
          white-space: nowrap;
        }
        .terminal-code {
          font-family: 'JetBrains Mono', "Cascadia Code", "Cascadia Mono", "Fira Code", Consolas, "Courier New", monospace;
          font-weight: 500;
          letter-spacing: -0.005em;
        }
        .terminal-danger {
          color: #fca5a5;
          text-decoration-line: underline;
          text-decoration-style: wavy;
          text-decoration-color: #ef4444;
          text-decoration-thickness: 2px;
          text-underline-offset: 4px;
          animation: appleHeroDangerGlow 1.6s ease-in-out infinite;
        }
        @keyframes appleHeroDangerGlow {
          0%, 100% { text-shadow: 0 0 4px rgba(239, 68, 68, 0.35); }
          50% { text-shadow: 0 0 14px rgba(239, 68, 68, 0.95); }
        }
        @keyframes appleHeroTerminalBlink {
          0%, 50% { opacity: 1; }
          50.01%, 100% { opacity: 0; }
        }
        .terminal-cursor {
          animation: appleHeroTerminalBlink 1s steps(1) infinite;
          box-shadow: 0 0 8px rgba(252, 165, 165, 0.7);
        }
        @keyframes appleHeroVulnPulse {
          0%, 100% { box-shadow: 0 0 0 rgba(239, 68, 68, 0); }
          50% { box-shadow: 0 0 14px rgba(239, 68, 68, 0.6); }
        }
        .vuln-badge {
          animation: appleHeroVulnPulse 1.8s ease-in-out infinite;
        }
        @keyframes appleHeroIdleGlow {
          0%, 100% { filter: drop-shadow(0 6px 10px rgba(176, 220, 110, 0.18)); }
          50% { filter: drop-shadow(0 10px 22px rgba(176, 220, 110, 0.5)); }
        }
        .fresh-apple-glow {
          animation: appleHeroIdleGlow 3s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .fresh-apple-glow, .terminal-cursor, .terminal-danger, .vuln-badge { animation: none; }
        }
      `}</style>
    </section>
  );
}

export default AppleHeroSection;
