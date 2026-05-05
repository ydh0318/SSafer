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
    : '정보 없음';

  return (
    <article className="rounded-[1.75rem] border border-[#e9e4d9] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#8b7f6a]">{project.owner}</p>
          <h3 className="mt-3 text-2xl font-black text-[#111111]">{project.name}</h3>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#62584a]">{project.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ProjectRiskBadge risk={project.risk} />
          <ProjectStatusBadge status={project.lastStatus} />
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-[1.25rem] bg-[#faf7f0] p-4 md:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b7f6a]">기본 스캔 방식</p>
          <p className="mt-2 text-sm font-semibold text-[#1f2937]">
            {project.defaultScanMode === 'AGENT' ? '로컬 에이전트 스캔' : '파일 업로드 스캔'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b7f6a]">모니터링</p>
          <p className="mt-2 text-sm font-semibold text-[#1f2937]">{project.monitorEnabled ? '사용' : '미사용'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b7f6a]">생성일</p>
          <p className="mt-2 text-sm font-semibold text-[#1f2937]">{createdLabel}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          className="inline-flex rounded-full bg-[#111111] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#262626]"
          to={ROUTES.projectDetail.replace(':projectId', project.id)}
        >
          프로젝트 상세 보기
        </Link>
        <span className="text-sm text-[#7b6f5d]">
          상세 페이지에서 스캔 요청, 에이전트 상태 확인, 결과 흐름 점검까지 이어서 진행할 수 있습니다.
        </span>
      </div>
    </article>
  );
}

export default ProjectSummaryCard;
