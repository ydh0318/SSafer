import { ArrowRight, FolderGit2, RadioTower } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ROUTES } from '../../../constants/routes';
import type { ProjectSummary } from '../../../types/project';
import ProjectRiskBadge from './ProjectRiskBadge';
import ProjectStatusBadge from './ProjectStatusBadge';

type ProjectSummaryCardProps = {
  project: ProjectSummary;
};

function ProjectSummaryCard({ project }: ProjectSummaryCardProps) {
  const createdLabel = project.createdAt
    ? new Date(project.createdAt).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '생성일 미확인';

  return (
    <article className="border border-neutral-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center border border-neutral-200 bg-[#f5f5f5] text-black">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-500">{project.owner}</p>
              <h3 className="mt-1 text-2xl font-black tracking-tight text-black">{project.name}</h3>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-600">{project.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ProjectRiskBadge risk={project.risk} />
          <ProjectStatusBadge status={project.lastStatus} />
        </div>
      </div>

      <div className="mt-6 grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-3">
        <div className="bg-[#fafafa] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">기본 스캔 방식</p>
          <p className="mt-2 text-sm font-bold text-black">
            {project.defaultScanMode === 'AGENT' ? '로컬 에이전트 스캔' : '파일 업로드 스캔'}
          </p>
        </div>
        <div className="bg-[#fafafa] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">상태 추적</p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-black">
            <RadioTower className="h-4 w-4" />
            {project.monitorEnabled ? '활성화' : '비활성화'}
          </p>
        </div>
        <div className="bg-[#fafafa] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-500">생성일</p>
          <p className="mt-2 text-sm font-bold text-black">{createdLabel}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-7 text-neutral-500">
          프로젝트 상세에서 스캔 등록, 에이전트 상태 확인, 누적 스캔 이력을 이어서 볼 수 있습니다.
        </p>
        <Link
          className="inline-flex items-center gap-2 bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
          to={ROUTES.projectDetail.replace(':projectId', project.id)}
        >
          상세 보기
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

export default ProjectSummaryCard;
