import { motion } from 'framer-motion';
import { ClipboardList, History, Settings } from 'lucide-react';

export type ProjectDetailTab = 'recent' | 'history' | 'settings';

type ProjectDetailTabsProps = {
  active: ProjectDetailTab;
  onChange: (next: ProjectDetailTab) => void;
};

const TABS: Array<{ id: ProjectDetailTab; label: string; icon: typeof ClipboardList }> = [
  { id: 'recent', label: '최근 결과', icon: ClipboardList },
  { id: 'history', label: '스캔 이력', icon: History },
  { id: 'settings', label: '설정', icon: Settings },
];

function ProjectDetailTabs({ active, onChange }: ProjectDetailTabsProps) {
  return (
    <nav aria-label="프로젝트 상세 탭" className="border-b border-neutral-200/80">
      <div className="-mb-px flex gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;

          return (
            <button
              aria-current={isActive ? 'page' : undefined}
              className={`relative inline-flex items-center gap-2 px-4 py-3 text-sm font-bold transition-colors ${
                isActive ? 'text-[#0F0F0F]' : 'text-neutral-400 hover:text-neutral-700'
              }`}
              key={tab.id}
              onClick={() => onChange(tab.id)}
              type="button"
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {isActive ? (
                <motion.span
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-[#0F0F0F]"
                  layoutId="project-detail-tab-underline"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default ProjectDetailTabs;
