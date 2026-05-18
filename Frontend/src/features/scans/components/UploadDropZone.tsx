import { motion } from 'framer-motion';
import { ArrowUp, X } from 'lucide-react';
import { useRef } from 'react';

type UploadDropZoneProps = {
  files: File[];
  onFilesChange: (files: File[] | null) => void;
  isDragOver: boolean;
  onDragStateChange: (next: boolean) => void;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function UploadDropZone({ files, onFilesChange, isDragOver, onDragStateChange }: UploadDropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasFiles = files.length > 0;

  return (
    <div
      className={`group relative flex min-h-[340px] cursor-pointer flex-col items-center justify-center border-2 border-dashed px-8 py-12 text-center transition-all duration-300 landing-card-radius ${
        isDragOver
          ? 'border-[#0F0F0F] bg-[#F7FFD9]'
          : 'border-neutral-300 bg-[#FAFAF7] hover:border-[#0F0F0F]/40'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragLeave={(event) => {
        event.preventDefault();
        onDragStateChange(false);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        onDragStateChange(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDragStateChange(false);
        onFilesChange(Array.from(event.dataTransfer.files));
      }}
      role="button"
      tabIndex={0}
    >
      <input
        accept=".env,.yml,.yaml,Dockerfile,Containerfile,sshd_config,nginx.conf"
        className="sr-only"
        multiple
        onChange={(event) => onFilesChange(Array.from(event.target.files ?? []))}
        ref={inputRef}
        type="file"
      />

      <motion.div
        animate={isDragOver ? { y: -8 } : { y: 0 }}
        className="inline-flex h-12 w-12 items-center justify-center bg-[#0F0F0F] landing-inner-radius text-white"
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
      >
        <ArrowUp className="h-6 w-6" />
      </motion.div>

      <h2 className="mt-6 text-xl font-black tracking-tight text-[#0F0F0F] md:text-2xl">
        파일을 여기에 드래그하거나 클릭해서 선택
      </h2>
      <p className="mt-2.5 max-w-md text-sm leading-relaxed text-neutral-500">
        docker-compose.yml, .env, Dockerfile, sshd_config 등 보안 설정이 들어있는 파일을 올려주세요.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">
        <span>최대 <span className="font-bold text-neutral-700">3개</span></span>
        <span className="text-neutral-300">·</span>
        <span>총 <span className="font-bold text-neutral-700">1MB</span> 이하</span>
        <span className="text-neutral-300">·</span>
        <span>분석 후 즉시 삭제</span>
      </div>

      {hasFiles ? (
        <div
          className="mt-8 flex w-full max-w-xl flex-col gap-3 bg-[#111111] px-4 py-3 text-left text-sm text-white landing-inner-radius"
          onClick={(event) => event.stopPropagation()}
        >
          {files.map((file) => (
            <div
              className="flex items-center justify-between gap-3 font-mono"
              key={`${file.name}-${file.size}-${file.lastModified}`}
            >
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-neutral-300">{formatFileSize(file.size)}</span>
            </div>
          ))}
          <button
            aria-label="선택한 파일 비우기"
            className="inline-flex items-center gap-2 self-end text-xs text-neutral-300 transition hover:text-white"
            onClick={(event) => {
              event.stopPropagation();
              onFilesChange(null);
            }}
            type="button"
          >
            <X className="h-4 w-4" />
            파일 비우기
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default UploadDropZone;
