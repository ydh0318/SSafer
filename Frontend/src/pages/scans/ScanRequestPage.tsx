import { Radio, UploadCloud, Wifi } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { StatusPill } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';

function getProjectLabel(projectId: string | undefined) {
  if (!projectId || !/^\d+$/.test(projectId)) {
    return '선택한 프로젝트';
  }

  return `프로젝트 ${projectId}`;
}

function ScanRequestPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const projectLabel = getProjectLabel(projectId);
  const progressUrl = ROUTES.scanProgress.replace(':scanId', 'scan-a36');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <RequestCard
          actionLabel="업로드 스캔 시작"
          desc="Dockerfile, .env, docker-compose.yml 같은 핵심 파일을 업로드해 빠르게 점검할 수 있습니다."
          icon={<UploadCloud className="h-8 w-8" />}
          tone="light"
          title="파일 업로드 스캔"
          to={progressUrl}
        >
          <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
            Dockerfile / .env / docker-compose.yml
          </div>
        </RequestCard>

        <RequestCard
          actionLabel="에이전트 스캔 시작"
          desc="에이전트를 연결해 실행 중인 환경에서 점검 흐름을 진행할 수 있습니다."
          icon={<Wifi className="h-8 w-8" />}
          tone="dark"
          title="에이전트 스캔"
          to={progressUrl}
        >
          <div className="rounded-lg bg-white/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold">Agent status</span>
              <StatusPill value="ONLINE" />
            </div>
            <p className="mt-3 text-sm text-slate-300">
              연결된 에이전트가 있으면 자동 수집 흐름을 이어서 사용할 수 있습니다.
            </p>
          </div>
        </RequestCard>
      </div>

      <SectionPanel
        description={`${projectLabel}에서 사용할 스캔 요청 방식을 선택할 수 있습니다.`}
        eyebrow="Scan modes"
        title="스캔 요청 경로"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Branch desc="핵심 설정 파일을 업로드해 점검합니다." title="업로드" />
          <Branch desc="실행 환경과 연결된 에이전트를 통해 수집합니다." title="에이전트" />
          <Branch desc="프로젝트 상황에 맞는 방식으로 다음 단계를 이어갑니다." title="후속 처리" />
        </div>
      </SectionPanel>
    </div>
  );
}

function RequestCard({
  title,
  desc,
  icon,
  actionLabel,
  to,
  tone,
  children,
}: {
  title: string;
  desc: string;
  icon: ReactNode;
  actionLabel: string;
  to: string;
  tone: 'light' | 'dark';
  children: ReactNode;
}) {
  const dark = tone === 'dark';

  return (
    <section
      className={`rounded-lg p-6 shadow-sm md:p-8 ${dark ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-950'}`}
    >
      <div className={dark ? 'text-slate-300' : 'text-slate-500'}>{icon}</div>
      <h2 className="mt-5 text-2xl font-black">{title}</h2>
      <p className={`mt-2 text-sm leading-6 ${dark ? 'text-slate-300' : 'text-slate-500'}`}>{desc}</p>
      <div className="mt-6">{children}</div>
      <Link
        className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-black transition ${
          dark ? 'bg-white text-slate-950 hover:bg-slate-200' : 'bg-slate-950 text-white hover:bg-slate-800'
        }`}
        to={to}
      >
        <Radio className="h-4 w-4" />
        {actionLabel}
      </Link>
    </section>
  );
}

function Branch({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="font-black text-slate-950">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{desc}</p>
    </div>
  );
}

export default ScanRequestPage;
