import { Trophy, FastForward, Target, User, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import PixelGoose from '../../components/common/PixelGoose';

interface TypingStageReportModalProps {
  stageOrder: number;
  stageTitle: string;
  username: string;
  strokes: number;
  maxCpm: number;
  isDark: boolean;
  onNext: () => void;
}

export default function TypingStageReportModal({
  stageOrder,
  stageTitle,
  username,
  strokes,
  maxCpm,
  isDark,
  onNext,
}: TypingStageReportModalProps) {
  // Listen for Enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div 
        className={`relative w-full max-w-sm overflow-hidden border-2 ${
          isDark ? 'border-neutral-700 bg-[#1A1A1A]' : 'border-neutral-900 bg-white'
        } shadow-[8px_8px_0_rgba(0,0,0,0.2)] animate-in fade-in zoom-in duration-300`}
      >
        {/* Header Ribbon */}
        <div className={`py-3 px-5 text-center font-black tracking-widest text-xs uppercase ${
          isDark ? 'bg-[#d9f66f] text-black' : 'bg-black text-white'
        }`}>
          Stage {stageOrder} Cleared!
        </div>

        <div className="p-8 text-center">
          {/* Goose Celebration */}
          <div className="flex justify-center mb-6 relative">
            <div className="absolute inset-0 flex items-center justify-center animate-ping opacity-20">
              <div className={`w-24 h-24 rounded-full ${isDark ? 'bg-[#d9f66f]' : 'bg-[#9FCC2E]'}`}></div>
            </div>
            <PixelGoose mood="victory" size={80} className="relative z-10 hover:scale-110 transition-transform cursor-pointer" />
          </div>

          <h2 className={`text-2xl font-black tracking-tight mb-1 ${isDark ? 'text-white' : 'text-black'}`}>
            {stageTitle}
          </h2>
          <p className={`text-sm mb-8 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            훌륭합니다! 명령어를 마스터했어요.
          </p>

          {/* Stats Grid */}
          <div className="space-y-3 mb-8">
            <div className={`flex items-center justify-between p-3 rounded-lg border ${
              isDark ? 'bg-neutral-800/50 border-neutral-700' : 'bg-neutral-50 border-neutral-200'
            }`}>
              <div className="flex items-center gap-2">
                <User className={`w-4 h-4 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`} />
                <span className={`text-xs font-bold tracking-widest ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>AGENT</span>
              </div>
              <span className={`font-bold ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>{username}</span>
            </div>

            <div className={`flex items-center justify-between p-3 rounded-lg border ${
              isDark ? 'bg-neutral-800/50 border-neutral-700' : 'bg-neutral-50 border-neutral-200'
            }`}>
              <div className="flex items-center gap-2">
                <Target className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
                <span className={`text-xs font-bold tracking-widest ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>KEY STROKES</span>
              </div>
              <span className={`font-mono font-black text-lg ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{strokes}</span>
            </div>

            <div className={`flex items-center justify-between p-3 rounded-lg border ${
              isDark ? 'bg-neutral-800/50 border-neutral-700' : 'bg-neutral-50 border-neutral-200'
            }`}>
              <div className="flex items-center gap-2">
                <FastForward className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                <span className={`text-xs font-bold tracking-widest ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>MAX CPM</span>
              </div>
              <span className={`font-mono font-black text-lg ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{maxCpm}</span>
            </div>
          </div>

          <button
            onClick={onNext}
            className={`w-full flex items-center justify-center gap-2 py-4 font-black uppercase tracking-widest transition-all ${
              isDark 
                ? 'bg-[#d9f66f] text-black hover:bg-white hover:scale-[1.02]' 
                : 'bg-black text-white hover:bg-neutral-800 hover:scale-[1.02]'
            }`}
          >
            다음 단계로 <ChevronRight className="w-5 h-5" />
          </button>
          <div className={`mt-3 text-[10px] uppercase font-bold tracking-widest opacity-50 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Press <kbd className="px-1 py-0.5 border rounded mx-1 font-mono">Enter</kbd> to continue
          </div>
        </div>
      </div>
    </div>
  );
}
