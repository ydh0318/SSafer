import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type TypingBoxProps = {
  snippet: string;
  rewardLabel?: string;
  onComplete?: () => void;
};

function TypingBox({ snippet, rewardLabel = '+10 XP', onComplete }: TypingBoxProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isCompletedRef = useRef(false);

  useEffect(() => {
    setInput('');
    isCompletedRef.current = false;
  }, [snippet]);

  const correctCount = input.split('').filter((char, index) => char === snippet[index]).length;
  const mistakeCount = input.length - correctCount;
  const done = input === snippet;

  useEffect(() => {
    if (done && !isCompletedRef.current) {
      isCompletedRef.current = true;
      onComplete?.();
    }
  }, [done, onComplete]);

  return (
    <div
      className="overflow-hidden rounded-[28px] border border-neutral-700 bg-[#2d2f34] shadow-[0_18px_50px_rgba(17,17,17,0.24)]"
      onClick={() => textareaRef.current?.focus()}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="text-4xl font-black tracking-tight text-[#e8c84f]">
          {input.length}/{snippet.length}
        </div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-neutral-400">
          <span>{mistakeCount > 0 ? `mistakes ${mistakeCount}` : 'clean run'}</span>
          {done ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#d9f66f] px-3 py-1 text-black">
              <Check className="h-3 w-3" />
              {rewardLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-[220px] bg-[#2d2f34] px-6 py-7 sm:min-h-[260px] sm:px-8">
        <div className="pointer-events-none whitespace-pre-wrap break-words font-mono text-[1.75rem] leading-[1.9] tracking-[0.01em] text-neutral-500 sm:text-[2.2rem]">
          {snippet.split('').map((char, index) => {
            let className = 'text-neutral-500';

            if (index < input.length) {
              className =
                input[index] === char
                  ? 'text-[#f5f5f5]'
                  : 'rounded-[6px] bg-[#6c232b]/50 text-[#ff6b6b]';
            } else if (index === input.length) {
              className = 'border-l-4 border-[#e8c84f] pl-0.5 text-[#8d9199]';
            }

            return (
              <span className={className} key={`${char}-${index}`}>
                {char === ' ' ? '\u00A0' : char}
              </span>
            );
          })}
        </div>

        <textarea
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="absolute inset-0 h-full w-full resize-none overflow-hidden opacity-0"
          name="ssafer-typing-box"
          onChange={(event) => setInput(event.target.value.slice(0, snippet.length))}
          ref={textareaRef}
          rows={Math.max(snippet.split('\n').length, 3)}
          spellCheck={false}
          value={input}
          wrap="off"
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-neutral-300">
          {mistakeCount > 0 ? (
            <span className="font-medium text-[#ff7b7b]">오타가 빨간색으로 표시됩니다. 천천히 정확하게 입력해보세요.</span>
          ) : (
            <span>지금 입력 중인 위치는 노란 커서로 표시됩니다.</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">
          <span>correct {correctCount}</span>
          <span>mistakes {Math.max(mistakeCount, 0)}</span>
        </div>
      </div>
    </div>
  );
}

export default TypingBox;
