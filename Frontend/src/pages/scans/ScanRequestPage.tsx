import { Radio, UploadCloud, Wifi } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { StatusPill, TokenBadge } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import ApiEndpointList from '../../features/api-specs/components/ApiEndpointList';

function ScanRequestPage() {
  const { projectId = 'p-101' } = useParams<{ projectId: string }>();
  const progressUrl = ROUTES.scanProgress.replace(':scanId', 'scan-a36');

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <RequestCard
            actionLabel="업로드 점검 요청"
            desc="Dockerfile, .env, docker-compose.yml을 업로드해 서버에서 점검합니다."
            icon={<UploadCloud className="h-8 w-8" />}
            tone="light"
            title="업로드 기반 점검"
            to={progressUrl}
          >
            <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
              Dockerfile · .env · docker-compose.yml
            </div>
          </RequestCard>

          <RequestCard
            actionLabel="에이전트 점검 요청"
            desc="설치형 agent가 WebSocket keepalive로 연결되고 미처리 task를 가져갑니다."
            icon={<Wifi className="h-8 w-8" />}
            tone="dark"
            title="에이전트 기반 점검"
            to={progressUrl}
          >
            <div className="rounded-lg bg-white/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold">Agent status</span>
                <StatusPill value="ONLINE" />
              </div>
              <p className="mt-3 break-all font-mono text-xs text-slate-300">/ws/v1/internal/agents/connect</p>
            </div>
          </RequestCard>
        </div>

        <SectionPanel description={`${projectId} 프로젝트에서 점검 요청이 어떤 API로 나뉘는지 보여줍니다.`} eyebrow="Request branches" title="스캔 요청 분기">
          <div className="grid gap-3 md:grid-cols-3">
            <Branch desc="POST /scans/upload" title="업로드" token="O/G" />
            <Branch desc="POST /scans/agent" title="Agent" token="O/G" />
            <Branch desc="task polling, raw upload" title="Internal" token="INTERNAL" />
          </div>
        </SectionPanel>
      </div>

      <ApiEndpointList compact screenId="scanRequest" />
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
    <section className={`rounded-lg p-6 shadow-sm md:p-8 ${dark ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-950'}`}>
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

function Branch({ title, desc, token }: { title: string; desc: string; token: 'O/G' | 'INTERNAL' }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-black text-slate-950">{title}</p>
        <TokenBadge value={token} />
      </div>
      <p className="mt-2 text-sm text-slate-500">{desc}</p>
    </div>
  );
}

export default ScanRequestPage;
