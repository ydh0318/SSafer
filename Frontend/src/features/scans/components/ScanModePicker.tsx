import { motion } from 'framer-motion';
import { Bot, FolderUp, Terminal } from 'lucide-react';

import RevealOnScroll from '../../home/components/primitives/RevealOnScroll';
import { revealItemVariants } from '../../home/components/primitives/revealVariants';

type ScanModeOption = 'UPLOAD' | 'CLI' | 'AGENT';

type ScanModePickerProps = {
  selectedMode: ScanModeOption;
  onSelect: (mode: ScanModeOption) => void;
  isAgentAvailable: boolean;
};

type ModeConfig = {
  id: ScanModeOption;
  icon: typeof FolderUp;
  title: string;
};

const MODES: ModeConfig[] = [
  {
    id: 'UPLOAD',
    icon: FolderUp,
    title: '파일 업로드',
  },
  {
    id: 'CLI',
    icon: Terminal,
    title: 'CLI',
  },
  {
    id: 'AGENT',
    icon: Bot,
    title: 'Agent',
  },
];

function ScanModePicker({ selectedMode, onSelect, isAgentAvailable }: ScanModePickerProps) {
  return (
    <section className="space-y-4 landing-anim">
      <div className="text-xl font-black tracking-tight text-[#080B16] md:text-2xl">스캔 방식 선택</div>

      <RevealOnScroll className="grid gap-4 md:grid-cols-3" stagger={0.08}>
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isSelected = selectedMode === mode.id;
          const isDisabled = mode.id === 'AGENT' && !isAgentAvailable;

          return (
            <motion.button
              aria-pressed={isSelected}
              className={`group relative flex min-h-[128px] flex-col overflow-hidden border p-5 text-left transition-all duration-300 ease-out landing-card-radius ${
                isDisabled
                  ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-500 opacity-85 grayscale'
                  : isSelected
                    ? 'border-[#0F0F0F] bg-[#0F0F0F] text-white shadow-[0_24px_50px_rgba(15,23,42,0.18)]'
                    : 'border-neutral-200/80 bg-white hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_14px_32px_rgba(15,23,42,0.06)]'
              }`}
              disabled={isDisabled}
              key={mode.id}
              onClick={() => !isDisabled && onSelect(mode.id)}
              type="button"
              variants={revealItemVariants}
            >
              <div
                className={`inline-flex h-10 w-10 items-center justify-center transition-colors duration-300 landing-inner-radius ${
                  isDisabled ? 'bg-neutral-200' : isSelected ? 'bg-[#D4FC64]' : 'bg-[#F5F4EF]'
                }`}
              >
                <Icon
                  className={`h-4.5 w-4.5 transition-colors duration-300 ${
                    isSelected ? 'text-[#0F0F0F]' : 'text-[#0F0F0F]'
                  }`}
                />
              </div>

              <h3
                className={`mt-4 text-xl font-black tracking-tight transition-colors duration-300 ${
                  isDisabled ? 'text-neutral-500' : isSelected ? 'text-white' : 'text-[#0F0F0F]'
                }`}
              >
                {mode.title}
              </h3>
            </motion.button>
          );
        })}
      </RevealOnScroll>
    </section>
  );
}

export default ScanModePicker;
