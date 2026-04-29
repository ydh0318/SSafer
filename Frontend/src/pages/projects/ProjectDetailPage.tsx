import { Edit3, Play, Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { SeverityBadge, StatusPill } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import ApiEndpointList from '../../features/api-specs/components/ApiEndpointList';
import { scans } from '../../mocks/ssaferMockData';
import { useProjectStore } from '../../store/projectStore';

function ProjectDetailPage() {
  const { projectId = 'p-101' } = useParams<{ projectId: string }>();
  const project = useProjectStore((state) => state.findProjectById(projectId));
  const projectScans = scans.filter((scan) => scan.project === project?.name);

  if (!project) {
    return (
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <SectionPanel
          description="프로젝트 생성 직후 이동했는데 데이터를 찾지 못한 경우, 목록 화면에서 다시 진입해 주세요."
          eyebrow="Missing project"
          title="프로젝트를 찾을 수 없습니다"
        >
          <Link
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            to={ROUTES.projects}
          >
            프로젝트 목록으로 이동
          </Link>
        </SectionPanel>
        <ApiEndpointList compact screenId="projectDetail" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
        <SectionPanel
          action={
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-400" type="button">
                <Edit3 className="h-4 w-4" />
                정보 수정
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
                스캔 요청
              </Link>
            </div>
          }
          description="프로젝트 단위로 스캔 이력과 위험도 상태를 묶어 관리하는 화면입니다."
          eyebrow={project.id}
          title={project.name}
        >
          <div className="flex flex-wrap gap-2">
            <SeverityBadge value={project.risk} />
            <StatusPill value={project.lastStatus} />
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">{project.description}</p>
        </SectionPanel>

        <div className="grid gap-4 lg:grid-cols-3">
          <OptionCard desc="monitorEnabled 상태에 따라 이상 이벤트 흐름을 확장할 수 있습니다." title="모니터링 설정" />
          <OptionCard desc={`${project.defaultScanMode} 모드가 기본 스캔 요청 모드로 저장됩니다.`} title="기본 스캔 모드" />
          <OptionCard desc="생성 직후에는 스캔이 없으며, 이후 요청 흐름과 자연스럽게 이어집니다." title="초기 상태" />
        </div>

        <SectionPanel
          description="프로젝트별 스캔 목록은 아직 mock 데이터를 사용하지만, 생성한 프로젝트도 동일한 레이아웃으로 표시됩니다."
          eyebrow="Scans"
          title="프로젝트 스캔 목록"
        >
          {projectScans.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
              아직 연결된 스캔이 없습니다. 스캔 요청 버튼으로 첫 번째 분석을 시작할 수 있습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {projectScans.map((scan) => (
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
          )}
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
