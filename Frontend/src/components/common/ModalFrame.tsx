import { X } from 'lucide-react';
import type { ReactNode } from 'react';

type ModalFrameProps = {
  children: ReactNode;
  onClose: () => void;
};

function ModalFrame({ children, onClose }: ModalFrameProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4 py-8 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto shadow-[0_30px_120px_rgba(15,23,42,0.28)]">
        <button
          aria-label="모달 닫기"
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-600 transition hover:border-black hover:text-black"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export default ModalFrame;
