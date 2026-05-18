import { ChevronDown, Info } from 'lucide-react';
import { useState } from 'react';

type ScanScopeInfoProps = {
  /** 처음 펼친 상태로 시작할지 여부 (기본 false: 접힘) */
  defaultOpen?: boolean;
};

const COVERED_ITEMS: Array<{ label: string; description: string }> = [
  {
    label: 'Dockerfile',
    description: 'root 사용자, HEALTHCHECK 누락, 패키지 설치 옵션 등',
  },
  {
    label: 'docker-compose',
    description: 'DB 포트 노출, 시크릿 하드코딩, privileged 모드, 네트워크 설정 등',
  },
  {
    label: '.env 파일',
    description: '평문 시크릿 노출',
  },
  {
    label: '서버 설정',
    description: 'SSH, 방화벽, Docker 포트 — server-audit 스캔 시',
  },
];

const NOT_COVERED_ITEMS = ['Kubernetes', 'Terraform', 'CI/CD 파이프라인', '애플리케이션 소스코드'];

function ScanScopeInfo({ defaultOpen = false }: ScanScopeInfoProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section
      aria-label="탐지 범위 안내"
      className="overflow-hidden border border-sky-200 bg-sky-50/50 landing-card-radius"
    >
      <button
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-sky-50"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="flex items-center gap-2.5">
          <Info className="h-4 w-4 text-sky-600" />
          <span className="text-sm font-bold text-sky-900">탐지 범위 안내</span>
          <span className="hidden text-xs text-sky-700/80 sm:inline">
            결과가 0건이라도 "이 범위 안에서 0건"임을 알려드립니다
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-sky-600 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen ? (
        <div className="space-y-4 border-t border-sky-200 px-5 py-5 text-sm leading-relaxed">
          <div>
            <p className="font-bold text-sky-900">SSafer가 검사하는 항목</p>
            <ul className="mt-2 space-y-1.5">
              {COVERED_ITEMS.map((item) => (
                <li className="flex flex-wrap items-baseline gap-1.5" key={item.label}>
                  <span className="font-mono text-xs font-bold text-sky-700">→ {item.label}</span>
                  <span className="text-xs text-sky-900/80">{item.description}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-sky-200/70 pt-4">
            <p className="text-xs text-sky-900/80">
              <span className="font-bold">탐지 대상이 아닌 것:</span>{' '}
              {NOT_COVERED_ITEMS.join(' · ')}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ScanScopeInfo;
