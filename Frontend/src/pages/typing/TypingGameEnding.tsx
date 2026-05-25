import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { useUiStore } from '../../store/uiStore';

export default function TypingGameEnding({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const isDark = useUiStore((s) => s.theme) === 'dark';
  const navigate = useNavigate();

  useEffect(() => {
    // Animation sequence
    // 0: initial hidden
    // 1: blocks appear on the left
    // 2: fly into mouth & gulp
    // 3: burp
    // 4: congrats
    const t1 = setTimeout(() => setStep(1), 800);
    const t2 = setTimeout(() => setStep(2), 2200);
    const t3 = setTimeout(() => setStep(3), 3600);
    const t4 = setTimeout(() => setStep(4), 5000);

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
    };
  }, []);

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-500`}>
      <div className={`relative flex flex-col items-center justify-start pt-16 px-12 pb-12 rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-[#1a1a1a] text-white' : 'bg-white text-black'} w-full max-w-2xl min-h-[520px]`}>
        
        {step >= 4 && (
          <button onClick={onClose} className="absolute top-4 right-4 text-neutral-400 hover:text-white transition">
            <X className="w-6 h-6" />
          </button>
        )}

        <div className="relative w-full h-[180px] flex items-center justify-center">
          {/* Blocks flying */}
          <div className={`absolute z-20 left-1/2 top-1/2 -translate-y-1/2 transition-all duration-700 ease-in-out ${step === 0 ? '-translate-x-64 opacity-0' : step === 1 ? '-translate-x-48 opacity-100 scale-100' : 'translate-x-0 opacity-0 scale-50'}`}>
            <div className="font-mono bg-neutral-800 text-[#d9f66f] px-3 py-1 rounded shadow-lg text-sm whitespace-nowrap">sudo ufw enable</div>
          </div>
          
          <div className={`absolute z-20 left-1/2 top-1/2 -translate-y-1/2 mt-12 transition-all duration-700 ease-in-out delay-75 ${step === 0 ? '-translate-x-64 opacity-0' : step === 1 ? '-translate-x-40 opacity-100 scale-100' : 'translate-x-0 opacity-0 scale-50'}`}>
            <div className="font-mono bg-neutral-800 text-sky-400 px-3 py-1 rounded shadow-lg text-sm whitespace-nowrap">tail -f /var/log/syslog</div>
          </div>

          <div className={`absolute z-20 left-1/2 top-1/2 -translate-y-1/2 -mt-10 transition-all duration-700 ease-in-out delay-150 ${step === 0 ? '-translate-x-64 opacity-0' : step === 1 ? '-translate-x-56 opacity-100 scale-100' : 'translate-x-0 opacity-0 scale-50'}`}>
            <div className="font-mono bg-neutral-800 text-rose-400 px-3 py-1 rounded shadow-lg text-sm whitespace-nowrap">chmod 600 ~/.ssh/id_rsa</div>
          </div>

          {/* Goose */}
          <div className={`relative z-30 transition-transform duration-300 ${step === 2 ? 'scale-125' : 'scale-100'}`}>
            <PixelGoose mood={step >= 4 ? 'victory' : step === 2 ? 'alert' : step === 3 ? 'happy' : 'working'} size={120} />
            
            {/* Gulp text */}
            <div className={`absolute -top-6 left-1/2 -translate-x-1/2 font-black text-2xl text-rose-500 transition-all duration-300 ${step === 2 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-75'}`}>
              꿀꺽!
            </div>

            {/* Burp text */}
            <div className={`absolute -top-10 -right-12 bg-white text-black px-4 py-2 rounded-2xl rounded-bl-none font-bold text-xl shadow-xl border-2 border-neutral-200 transition-all duration-300 origin-bottom-left ${step === 3 ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
              꺼억~💨
            </div>
          </div>
        </div>

        {/* Message */}
        <div className={`w-full mt-10 text-center transition-all duration-700 delay-300 ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
          <h2 className="text-3xl font-extrabold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-sky-400">
            타이핑 마스터!
          </h2>
          <p className={`text-base mb-6 ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
            축하합니다! 5-5까지 모든 명령어를 완벽하게 마스터하셨습니다.<br/>
            거위가 당신이 친 명령어들을 먹어치우고 든든해졌네요!<br/>
            이제 서버 환경에서도 두렵지 않을 거예요. 정말 멋집니다!
          </p>
          <button
            onClick={() => navigate(ROUTES.dashboard)}
            className={`px-6 py-3 rounded-lg font-bold transition-colors shadow-lg ${isDark ? 'bg-[#d9f66f] text-black hover:bg-[#c5e655]' : 'bg-neutral-900 text-white hover:bg-black'}`}
          >
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
