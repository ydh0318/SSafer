import { useEffect, useRef, useState } from 'react';
import PixelGoose from './PixelGoose';
import SsaferCommandsModal from './SsaferCommandsModal';

const PATROL_MS = 40_000;
const SIZE = 56;

type Mode = 'patrolling' | 'dragging' | 'returning';

// 컴포넌트 외부에 정의 — 렌더링마다 <style> 재삽입되는 렉 방지
const PATROL_STYLE = `
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
`;

export default function HiddenGoose() {
  const [showModal, setShowModal] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [mode, setMode] = useState<Mode>('patrolling');

  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    startX: 0,
    startY: 0,
    moved: false,
    dragStarted: false, // handleMouseDown이 실제로 드래그 모드를 시작했는지 추적
    cosTheta: 1,
    sinTheta: 0,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'patrolling') {
      // 순찰 중이 아닐 때 클릭 → 드래그 시작 아님을 표시
      dragRef.current.dragStarted = false;
      return;
    }

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

    dragRef.current = { startX: e.clientX, startY: e.clientY, moved: false, dragStarted: true, cosTheta, sinTheta };
    setMode('dragging');
  };

  useEffect(() => {
    if (mode !== 'dragging') return;

    const onMove = (e: MouseEvent) => {
      const mouseDX = e.clientX - dragRef.current.startX;
      const mouseDY = e.clientY - dragRef.current.startY;
      const { cosTheta, sinTheta } = dragRef.current;

      // 3px 이상 이동했을 때만 드래그로 간주 (미세한 흔들림 클릭 오판 방지)
      if (Math.abs(mouseDX) > 3 || Math.abs(mouseDY) > 3) {
        dragRef.current.moved = true;
      }

      const dx = -cosTheta * mouseDX - sinTheta * mouseDY;
      const dy = -sinTheta * mouseDX + cosTheta * mouseDY;

      // setState 대신 직접 DOM 조작 → 마우스 이동마다 리렌더링 없음
      if (innerRef.current) {
        innerRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
        innerRef.current.style.transition = 'none';
      }
    };

    const onUp = () => {
      if (dragRef.current.moved) {
        // 실제 드래그 → spring 복귀 애니메이션
        if (innerRef.current) {
          innerRef.current.style.transform = 'translate(0px, 0px)';
          innerRef.current.style.transition = 'transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1)';
        }
        setMode('returning');
      } else {
        // 이동 없는 클릭 → 즉시 복귀
        if (innerRef.current) {
          innerRef.current.style.transform = '';
          innerRef.current.style.transition = '';
        }
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
    if (mode === 'returning') {
      // 복귀 완료 → moved 리셋하여 다음 클릭이 막히지 않도록
      dragRef.current.moved = false;
      if (innerRef.current) {
        innerRef.current.style.transform = '';
        innerRef.current.style.transition = '';
      }
      setMode('patrolling');
    }
  };

  const handleClick = () => {
    // dragStarted=true(이번 클릭이 드래그 시작) AND moved=true(실제 이동)일 때만 차단
    if (dragRef.current.dragStarted && dragRef.current.moved) {
      return;
    }
    dragRef.current.dragStarted = false;
    setShowModal(true);
  };

  const animPaused = hovered || mode !== 'patrolling';

  const mood =
    mode === 'dragging' ? 'eating'
    : mode === 'returning' ? 'happy'
    : hovered ? 'happy'
    : 'idle';

  return (
    <>
      <style>{PATROL_STYLE}</style>

      <div
        ref={outerRef}
        className="fixed top-0 left-0 z-[150] goose-patrol"
        style={{
          width: SIZE,
          height: SIZE,
          animationPlayState: animPaused ? 'paused' : 'running',
        }}
      >
        <div
          ref={innerRef}
          className="w-full h-full flex items-center justify-center drop-shadow-lg"
          style={{
            cursor: mode === 'dragging' ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={handleClick}
          onTransitionEnd={handleTransitionEnd}
          title="SSAFER 비밀 명령어"
        >
          <PixelGoose mood={mood} size={SIZE} />
        </div>
      </div>

      {showModal && <SsaferCommandsModal onClose={() => setShowModal(false)} />}
    </>
  );
}
