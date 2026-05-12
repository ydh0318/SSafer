import { useState } from 'react';
import PixelGoose from './PixelGoose';
import SsaferCommandsModal from './SsaferCommandsModal';

export default function HiddenGoose() {
  const [showModal, setShowModal] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <style>{`
        @keyframes goose-patrol {
          0%   { transform: translate(calc(100vw - 56px), calc(100vh - 56px)) rotate(0deg) scaleX(-1); }
          30%  { transform: translate(0px, calc(100vh - 56px)) rotate(0deg) scaleX(-1); }
          32%  { transform: translate(0px, calc(100vh - 56px)) rotate(90deg) scaleX(-1); }
          48%  { transform: translate(0px, 0px) rotate(90deg) scaleX(-1); }
          50%  { transform: translate(0px, 0px) rotate(180deg) scaleX(-1); }
          80%  { transform: translate(calc(100vw - 56px), 0px) rotate(180deg) scaleX(-1); }
          82%  { transform: translate(calc(100vw - 56px), 0px) rotate(270deg) scaleX(-1); }
          98%  { transform: translate(calc(100vw - 56px), calc(100vh - 56px)) rotate(270deg) scaleX(-1); }
          100% { transform: translate(calc(100vw - 56px), calc(100vh - 56px)) rotate(360deg) scaleX(-1); }
        }
        .animate-goose-patrol {
          animation: goose-patrol 40s linear infinite;
        }
        .animate-goose-patrol:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div 
        className="fixed top-0 left-0 w-[56px] h-[56px] z-[150] cursor-pointer animate-goose-patrol drop-shadow-lg flex items-center justify-center"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setShowModal(true)}
        title="SSAfer 비밀 명령어"
      >
        <PixelGoose mood={hovered ? 'happy' : 'idle'} size={56} />
      </div>

      {showModal && <SsaferCommandsModal onClose={() => setShowModal(false)} />}
    </>
  );
}
