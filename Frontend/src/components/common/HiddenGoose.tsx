import { useEffect, useRef, useState } from 'react';
import PixelGoose from './PixelGoose';
import SsaferCommandsModal from './SsaferCommandsModal';

const PATROL_MS = 40_000;
const SIZE = 56;

type Mode = 'patrolling' | 'dragging' | 'returning';

export default function HiddenGoose() {
  const [showModal, setShowModal] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [mode, setMode] = useState<Mode>('patrolling');
  const [delta, setDelta] = useState({ x: 0, y: 0 });

  const outerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startX: 0, startY: 0, moved: false, cosTheta: 1, sinTheta: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'patrolling') return;
    // e.preventDefault() 호출 금지 — 호출하면 이후 click 이벤트가 발생하지 않음

    // 현재 애니메이션의 회전 행렬을 읽어 좌표계 역변환에 사용
    // 외부 div는 rotate(θ) scaleX(-1) → matrix 값: a=-cos(θ), b=-sin(θ)
    let cosTheta = 1;
    let sinTheta = 0;
    if (outerRef.current) {
      const matrix = window.getComputedStyle(outerRef.current).transform;
      const m = matrix?.match(/^matrix\(([^)]+)\)$/);
      if (m) {
        const vals = m[1].split(',').map(parseFloat);
        cosTheta = -vals[0];
        sinTheta = -vals[1];
      }
    }

    dragRef.current = { startX: e.clientX, startY: e.clientY, moved: false, cosTheta, sinTheta };
    setDelta({ x: 0, y: 0 });
    setMode('dragging');
  };

  useEffect(() => {
    if (mode !== 'dragging') return;

    const onMove = (e: MouseEvent) => {
      const mouseDX = e.clientX - dragRef.current.startX;
      const mouseDY = e.clientY - dragRef.current.startY;
      const { cosTheta, sinTheta } = dragRef.current;
      // 화면 좌표 delta → 외부 div 로컬 좌표 delta 역변환
      dragRef.current.moved = true;
      setDelta({
        x: -cosTheta * mouseDX - sinTheta * mouseDY,
        y: -sinTheta * mouseDX + cosTheta * mouseDY,
      });
    };

    const onUp = () => {
      // 실제 이동이 있었을 때만 spring 복귀
      // 이동 없이 mouseup이면 transitionend가 발생하지 않아 영구 고착되므로 바로 복귀
      if (dragRef.current.moved) {
        setMode('returning');
      } else {
        setMode('patrolling');
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [mode]);

  const handleTransitionEnd = () => {
    if (mode === 'returning') setMode('patrolling');
  };

  const handleClick = (e: React.MouseEvent) => {
    if (dragRef.current.moved) {
      e.preventDefault();
      return;
    }
    setShowModal(true);
  };

  // 외부 div 애니메이션: hover 중이거나 드래그/복귀 중에는 일시정지
  const animPaused = hovered || mode !== 'patrolling';

  // 내부 div transform: 외부 div와 다른 요소라 애니메이션 transform과 충돌 없음
  let innerStyle: React.CSSProperties = {};
  if (mode === 'dragging') {
    innerStyle = {
      transform: `translate(${delta.x}px, ${delta.y}px)`,
      transition: 'none',
    };
  } else if (mode === 'returning') {
    innerStyle = {
      transform: 'translate(0px, 0px)',
      transition: 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)',
    };
  }

  const mood =
    mode === 'dragging' ? 'eating'
    : mode === 'returning' ? 'happy'
    : hovered ? 'happy'
    : 'idle';

  return (
    <>
      <style>{`
        @keyframes goose-patrol {
          0%   { transform: translate(calc(100vw - ${SIZE}px), calc(100vh - ${SIZE}px)) rotate(0deg) scaleX(-1); }
          30%  { transform: translate(0px, calc(100vh - ${SIZE}px)) rotate(0deg) scaleX(-1); }
          32%  { transform: translate(0px, calc(100vh - ${SIZE}px)) rotate(90deg) scaleX(-1); }
          48%  { transform: translate(0px, 0px) rotate(90deg) scaleX(-1); }
          50%  { transform: translate(0px, 0px) rotate(180deg) scaleX(-1); }
          80%  { transform: translate(calc(100vw - ${SIZE}px), 0px) rotate(180deg) scaleX(-1); }
          82%  { transform: translate(calc(100vw - ${SIZE}px), 0px) rotate(270deg) scaleX(-1); }
          98%  { transform: translate(calc(100vw - ${SIZE}px), calc(100vh - ${SIZE}px)) rotate(270deg) scaleX(-1); }
          100% { transform: translate(calc(100vw - ${SIZE}px), calc(100vh - ${SIZE}px)) rotate(360deg) scaleX(-1); }
        }
        .goose-patrol {
          animation: goose-patrol ${PATROL_MS}ms linear infinite;
        }
      `}</style>

      {/* 외부 div: 순찰 경로 애니메이션만 담당. transform 인라인 없음 */}
      <div
        ref={outerRef}
        className="fixed top-0 left-0 z-[150] goose-patrol"
        style={{
          width: SIZE,
          height: SIZE,
          animationPlayState: animPaused ? 'paused' : 'running',
        }}
      >
        {/* 내부 div: 드래그 오프셋만 담당. 애니메이션 없음 → transform 충돌 없음 */}
        <div
          className="w-full h-full flex items-center justify-center drop-shadow-lg"
          style={{
            cursor: mode === 'dragging' ? 'grabbing' : 'grab',
            userSelect: 'none',
            ...innerStyle,
          }}
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={handleClick}
          onTransitionEnd={handleTransitionEnd}
          title="SSAfer 비밀 명령어"
        >
          <PixelGoose mood={mood} size={SIZE} />
        </div>
      </div>

      {showModal && <SsaferCommandsModal onClose={() => setShowModal(false)} />}
    </>
  );
}
