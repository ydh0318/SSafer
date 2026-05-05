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

  const correct = input.split('').every((char, index) => char === snippet[index]);
  const done = input === snippet;

  useEffect(() => {
    if (done && !isCompletedRef.current) {
      isCompletedRef.current = true;
      onComplete?.();
    }
  }, [done, onComplete]);

  return (
    <div className="cursor-text" onClick={() => textareaRef.current?.focus()}>
      <div className="relative whitespace-pre-wrap bg-neutral-900 p-4 font-mono text-base">
        {snippet.split('').map((char, index) => {
          let className = 'text-neutral-600';

          if (index < input.length) {
            className =
              input[index] === char ? 'text-[#3DDC84]' : 'bg-[#E63946]/30 text-[#E63946]';
          } else if (index === input.length) {
            className = 'bg-white/20 text-white';
          }

          return (
            <span className={className} key={`${char}-${index}`}>
              {char === ' ' ? '\u00A0' : char}
            </span>
          );
        })}

        <textarea
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="absolute inset-0 h-full w-full resize-none overflow-hidden opacity-0"
          name="ssafer-typing-box"
          onChange={(event) => setInput(event.target.value.slice(0, snippet.length))}
          ref={textareaRef}
          rows={Math.max(snippet.split('\n').length, 2)}
          spellCheck={false}
          value={input}
          wrap="off"
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className={correct ? 'text-neutral-500' : 'text-[#E63946]'}>
          {input.length} / {snippet.length}
          {correct ? '' : ' · 오타!'}
        </span>
        {done ? (
          <span className="inline-flex items-center gap-1 bg-[#3DDC84] px-2 py-0.5 font-bold text-black">
            <Check className="h-3 w-3" />
            완벽! {rewardLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default TypingBox;
