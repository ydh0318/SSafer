import { motion } from 'framer-motion';
import { ArrowUp, X } from 'lucide-react';
import { useRef } from 'react';

import { SCAN_UPLOAD_FILE_COUNT_LIMIT } from '../utils/uploadValidation';

type UploadDropZoneProps = {
  files: File[];
  onFilesChange: (files: File[] | null) => void;
  onFileLimitExceeded?: () => void;
  isDragOver: boolean;
  onDragStateChange: (next: boolean) => void;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileIdentity(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function getFileDisplayName(file: File) {
  return file.webkitRelativePath || file.name;
}

function formatFileModifiedTime(file: File) {
  if (!file.lastModified) return null;
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(file.lastModified));
}

function mergeFiles(currentFiles: File[], nextFiles: File[] | null) {
  if (!nextFiles || nextFiles.length === 0) return currentFiles;

  return [...currentFiles, ...nextFiles].filter((file, index, allFiles) => (
    allFiles.findIndex((candidate) => getFileIdentity(candidate) === getFileIdentity(file)) === index
  ));
}

function UploadDropZone({ files, onFilesChange, onFileLimitExceeded, isDragOver, onDragStateChange }: UploadDropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasFiles = files.length > 0;

  const updateFiles = (nextFiles: File[] | null, options: { append?: boolean } = {}) => {
    const mergedFiles = options.append ? mergeFiles(files, nextFiles) : nextFiles;

    if (mergedFiles && mergedFiles.length > SCAN_UPLOAD_FILE_COUNT_LIMIT) {
      onFileLimitExceeded?.();

      if (inputRef.current) {
        inputRef.current.value = '';
      }

      return;
    }

    onFilesChange(mergedFiles && mergedFiles.length > 0 ? mergedFiles : null);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const removeFileAt = (targetIndex: number) => {
    updateFiles(files.filter((_, index) => index !== targetIndex));
  };

  return (
    <div
      className={`group relative flex min-h-[420px] cursor-pointer flex-col items-center justify-center border-2 border-dashed px-8 py-16 text-center transition-all duration-300 landing-card-radius ${
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
        updateFiles(Array.from(event.dataTransfer.files), { append: true });
      }}
      role="button"
      tabIndex={0}
    >
      <input
        accept=".env,.yml,.yaml,Dockerfile,Containerfile,sshd_config,nginx.conf"
        className="sr-only"
        multiple
        onChange={(event) => updateFiles(Array.from(event.target.files ?? []), { append: true })}
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

      <div className="mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">허용 파일</span>
        {['.env', 'docker-compose.yml', 'Dockerfile', 'sshd_config', 'nginx.conf'].map((fileType) => (
          <span
            className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 font-mono text-[11px] font-bold text-black"
            key={fileType}
          >
            {fileType}
          </span>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">
        <span>
          최대 <span className="font-bold text-neutral-700">{SCAN_UPLOAD_FILE_COUNT_LIMIT}개</span>
        </span>
        <span className="text-neutral-300">·</span>
        <span>
          총 <span className="font-bold text-neutral-700">1MB</span> 이하
        </span>
        <span className="text-neutral-300">·</span>
        <span>추가 선택 시 목록에 누적</span>
      </div>

      {hasFiles ? (
        <div
          className="mt-10 flex w-full max-w-4xl flex-col gap-5 bg-[#111111] px-5 py-6 text-left text-sm text-white landing-inner-radius md:px-7 md:py-7"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">선택된 파일</p>
              <p className="mt-1 text-sm font-bold text-white">{files.length}/{SCAN_UPLOAD_FILE_COUNT_LIMIT}개 파일을 업로드합니다.</p>
              <p className="mt-1 text-xs text-neutral-400">같은 이름의 파일은 수정 시간과 크기를 함께 확인하세요.</p>
            </div>
            <button
              aria-label="선택한 파일 전체 비우기"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-white/40 hover:text-white"
              onClick={(event) => {
                event.stopPropagation();
                updateFiles(null);
              }}
              type="button"
            >
              <X className="h-3.5 w-3.5" />
              전체 비우기
            </button>
          </div>

          {files.map((file, index) => {
            const modifiedTime = formatFileModifiedTime(file);

            return (
              <div
                className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 rounded-sm bg-white/5 px-4 py-4 font-mono"
                key={getFileIdentity(file)}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[11px] font-black text-white">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] text-white" title={getFileDisplayName(file)}>
                    {getFileDisplayName(file)}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-neutral-400">
                    {modifiedTime ? `수정 ${modifiedTime} · ` : ''}{file.type || 'config file'}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-neutral-300">{formatFileSize(file.size)}</span>
                <button
                  aria-label={`${file.name} 파일 제거`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/10 hover:text-white"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeFileAt(index);
                  }}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default UploadDropZone;
