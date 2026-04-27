import { Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

import { SeverityBadge, StatusPill } from '../../components/common/Badge';
import MetricCard from '../../components/common/MetricCard';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import ApiEndpointList from '../../features/api-specs/components/ApiEndpointList';
import { projects } from '../../mocks/ssaferMockData';

function ProjectListPage() {
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard helper="O/G 접근 가능" label="Projects" value={projects.length} />
          <MetricCard helper="최근 24시간 기준" label="Active scans" tone="sky" value="2" />
          <MetricCard helper="게스트 워크스페이스" label="Guest projects" tone="green" value="1" />
        </div>

        <SectionPanel
          action={
            <button className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800" type="button">
              <Plus className="h-4 w-4" />
              프로젝트 생성
            </button>
          }
          description="프로젝트 생성, 목록 조회, 상세 진입을 담당합니다. 게스트와 로그인 사용자 모두 사용할 수 있는 O/G 영역입니다."
          eyebrow="Project index"
          title="프로젝트 목록"
        >
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-500">sample-app, payment-api, docker-lab</span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-slate-950 hover:bg-white"
                key={project.id}
                to={ROUTES.projectDetail.replace(':projectId', project.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <SeverityBadge value={project.risk} />
                  <StatusPill value={project.lastStatus} />
                </div>
                <h3 className="mt-5 text-xl font-black text-slate-950">{project.name}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">{project.owner}</p>
                <p className="mt-3 text-sm leading-6 text-slate-500">{project.description}</p>
                <p className="mt-4 text-sm font-bold text-slate-700">스캔 {project.scans}회</p>
              </Link>
            ))}
          </div>
        </SectionPanel>
      </div>

      <ApiEndpointList compact screenId="projects" />
    </div>
  );
}

export default ProjectListPage;
