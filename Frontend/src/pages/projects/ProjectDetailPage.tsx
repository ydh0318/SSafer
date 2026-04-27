import { Edit3, Play, Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { SeverityBadge, StatusPill } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import ApiEndpointList from '../../features/api-specs/components/ApiEndpointList';
import { projects, scans } from '../../mocks/ssaferMockData';

function ProjectDetailPage() {
  const { projectId = 'p-101' } = useParams<{ projectId: string }>();
  const project = projects.find((item) => item.id === projectId) ?? projects[0];

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
        <SectionPanel
          action={
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-400" type="button">
                <Edit3 className="h-4 w-4" />
                수정
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-400" type="button">
                <Trash2 className="h-4 w-4" />
                삭제
              </button>
              <Link
                className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
                to={ROUTES.scanRequest.replace(':projectId', project.id)}
              >
                <Play className="h-4 w-4" />
                새 스캔
              </Link>
            </div>
          }
          description="프로젝트 상세 조회, 정보 수정, 삭제, 점검 옵션 조회가 이 화면에서 분기됩니다."
          eyebrow={project.id}
          title={project.name}
        >
          <div className="flex flex-wrap gap-2">
            <SeverityBadge value={project.risk} />
            <StatusPill value={project.lastStatus} />
          </div>
        </SectionPanel>

        <div className="grid gap-4 lg:grid-cols-3">
          <OptionCard desc=".env, token, password, private key" title="Secret 탐지" />
          <OptionCard desc="root user, healthcheck, latest tag" title="Dockerfile 검사" />
          <OptionCard desc="privileged, port, volume mount" title="Compose 검사" />
        </div>

        <SectionPanel description="프로젝트 기준으로 생성된 스캔 이력을 보여주고 결과 워크벤치로 이동합니다." eyebrow="Scans" title="프로젝트별 스캔 목록">
          <div className="space-y-3">
            {scans.map((scan) => (
              <Link
                className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 text-left transition hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
                key={scan.id}
                to={ROUTES.scanDetail.replace(':scanId', scan.id)}
              >
                <div>
                  <p className="font-mono text-sm font-black text-slate-950">{scan.id}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {scan.source} · {scan.scannedAt}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill value={scan.status} />
                  {scan.critical > 0 ? <SeverityBadge value="CRITICAL" /> : null}
                  {scan.high > 0 ? <SeverityBadge value="HIGH" /> : null}
                </div>
              </Link>
            ))}
          </div>
        </SectionPanel>
      </div>

      <ApiEndpointList compact screenId="projectDetail" />
    </div>
  );
}

function OptionCard({ title, desc }: { title: string; desc: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-black text-slate-950">{title}</h3>
        <StatusPill value="DONE" />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{desc}</p>
    </article>
  );
}

export default ProjectDetailPage;
