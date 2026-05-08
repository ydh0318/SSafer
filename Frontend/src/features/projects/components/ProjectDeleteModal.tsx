import { LoaderCircle, TriangleAlert } from 'lucide-react';

import ModalFrame from '../../../components/common/ModalFrame';

type ProjectDeleteModalProps = {
  errorMessage: string | null;
  isDeleting: boolean;
  projectName: string;
  onClose: () => void;
  onConfirm: () => void;
};

function ProjectDeleteModal({
  errorMessage,
  isDeleting,
  projectName,
  onClose,
  onConfirm,
}: ProjectDeleteModalProps) {
  return (
    <ModalFrame onClose={onClose}>
      <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white">
        <div className="border-b border-black/10 bg-[linear-gradient(135deg,#fff7e8_0%,#fffdf8_100%)] px-6 py-8 sm:px-8">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#fff0d6] text-[#8a4b00]">
            <TriangleAlert className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-[#161616]">프로젝트를 삭제할까요?</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-700 sm:text-base">
            <span className="font-black text-black">{projectName}</span> 프로젝트를 삭제하면 목록에서 바로 사라지고, 같은 화면에서 계속 작업할 수 없습니다.
          </p>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm leading-6 text-neutral-600">
            프로젝트 삭제는 되돌릴 수 없으니, 정말 더 이상 관리하지 않을 프로젝트인지 확인한 뒤 진행해주세요.
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="inline-flex h-11 items-center justify-center rounded-full border border-neutral-300 px-5 text-sm font-bold text-neutral-700 transition hover:border-black hover:text-black"
              onClick={onClose}
              type="button"
            >
              취소
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isDeleting}
              onClick={onConfirm}
              type="button"
            >
              {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              프로젝트 삭제
            </button>
          </div>
        </div>
      </div>
    </ModalFrame>
  );
}

export default ProjectDeleteModal;
