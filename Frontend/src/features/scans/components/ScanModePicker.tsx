import { motion } from 'framer-motion';
import { Bot, FolderUp, Terminal } from 'lucide-react';
import type { ReactNode } from 'react';

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
  description: string;
  chips: string[];
};

const MODES: ModeConfig[] = [
  {
    id: 'UPLOAD',
    icon: FolderUp,
    title: '파일 업로드',
    description: '설정 파일을 바로 올려서 빠르게 결과 확인. CLI 설치 없이 브라우저에서 바로 가능.',
    chips: ['.env', 'docker-compose.yml', 'Dockerfile', 'sshd_config'],
  },
  {
    id: 'CLI',
    icon: Terminal,
    title: 'CLI',
    description: '로컬에서 전체 프로젝트 스캔. 파일 권한, 볼륨 마운트, 포트 공개 여부까지 검사.',
    chips: ['pip install ssafer', 'ssafer run --upload'],
  },
  {
    id: 'AGENT',
    icon: Bot,
    title: 'Agent',
    description: '로컬 Agent를 연결해서 실제 서버 런타임 환경 기준으로 점검합니다.',
    chips: ['프로젝트 파일', '서버 런타임'],
  },
];

function Chip({ children, selected }: { children: ReactNode; selected: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 font-mono text-[11px] transition-colors duration-300 landing-inner-radius ${
        selected ? 'bg-white/[0.08] text-white/70' : 'bg-[#F5F4EF] text-neutral-600'
      }`}
    >
      {children}
    </span>
  );
}

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
              aria-describedby={isDisabled ? `scan-mode-${mode.id}-reason` : undefined}
              className={`group relative flex min-h-[240px] flex-col overflow-hidden border p-6 text-left transition-all duration-300 ease-out landing-card-radius ${
                isDisabled
                  ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-500 opacity-60 grayscale'
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
                className={`mt-7 text-xl font-black tracking-tight transition-colors duration-300 ${
                  isDisabled ? 'text-neutral-500' : isSelected ? 'text-white' : 'text-[#0F0F0F]'
                }`}
              >
                {mode.title}
              </h3>
              <p
                className={`mt-2 text-sm leading-relaxed transition-colors duration-300 ${
                  isDisabled ? 'text-neutral-500' : isSelected ? 'text-white/60' : 'text-neutral-500'
                }`}
              >
                {isDisabled ? '이 프로젝트에서는 사용 불가' : mode.description}
              </p>

              {isDisabled && mode.id === 'AGENT' ? (
                <div
                  className="mt-4 rounded-xl bg-black px-4 py-3 font-mono text-xs leading-6 text-[#D4FC64]"
                  id={`scan-mode-${mode.id}-reason`}
                >
                  <div>ssafer login</div>
                  <div>ssafer agent</div>
                </div>
              ) : null}

              <div className="mt-auto pt-5">
                <div className="flex flex-wrap gap-1.5">
                  {mode.chips.map((chip) => (
                    <Chip key={chip} selected={isSelected}>
                      {chip}
                    </Chip>
                  ))}
                </div>
              </div>
            </motion.button>
          );
        })}
      </RevealOnScroll>
    </section>
  );
}

export default ScanModePicker;
