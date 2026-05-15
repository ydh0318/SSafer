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
      className="overflow-hidden rounded-lg border border-neutral-700 bg-[#2d2f34]"
      onClick={() => textareaRef.current?.focus()}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="font-mono text-sm font-bold text-[#e8c84f]">
          {input.length}<span className="text-neutral-600">/{snippet.length}</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
          <span>{mistakeCount > 0 ? `mistakes ${mistakeCount}` : 'clean'}</span>
          {done ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#d9f66f] px-2.5 py-0.5 text-black">
              <Check className="h-3 w-3" />
              {rewardLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-[80px] bg-[#2d2f34] px-4 py-4">
        <div className="pointer-events-none whitespace-pre-wrap break-words font-mono text-sm leading-7 tracking-[0.01em] text-neutral-500">
          {snippet.split('').map((char, index) => {
            let className = 'text-neutral-500';

            if (index < input.length) {
              className =
                input[index] === char
                  ? 'text-[#f5f5f5]'
                  : 'rounded bg-[#6c232b]/50 text-[#ff6b6b]';
            } else if (index === input.length) {
              className = 'border-l-2 border-[#e8c84f] pl-0.5 text-[#8d9199]';
            }

            return (
              <span className={className} key={`${char}-${index}`}>
                {char === ' ' ? ' ' : char}
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

      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-xs text-neutral-500">
        <span>
          {mistakeCount > 0 ? (
            <span className="text-[#ff7b7b]">오타 {mistakeCount}개 — 천천히 정확하게</span>
          ) : (
            <span>노란 커서 위치에 이어서 입력하세요</span>
          )}
        </span>
        <span className="font-mono">correct {correctCount}</span>
      </div>
    </div>
  );
}

export default TypingBox;
