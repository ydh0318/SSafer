import { Check, Clock, RotateCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { StatusPill } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import ApiEndpointList from '../../features/api-specs/components/ApiEndpointList';

const steps = [
  { name: 'REQUESTED', desc: '스캔 요청 생성', done: true },
  { name: 'RAW_UPLOADED', desc: 'Raw 결과 업로드', done: true },
  { name: 'NORMALIZED', desc: '정규화 결과 저장', done: true },
  { name: 'ANALYZING', desc: '결과 요약 및 findings 생성', done: false },
  { name: 'DONE', desc: '결과 화면 이동 가능', done: false },
];

function ScanProgressPage() {
  const { scanId = 'scan-a36' } = useParams<{ scanId: string }>();

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <SectionPanel
        action={<StatusPill value="ANALYZING" />}
        description="사용자 조회 API와 내부 호출 API가 함께 걸리는 구간입니다. 화면에는 진행 상태를 보여주고, raw/normalized 저장은 내부 호출로 분리합니다."
        eyebrow="Scan status"
        title={scanId}
      >
        <div className="space-y-5">
          {steps.map((step, index) => (
            <div className="flex gap-4" key={step.name}>
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                {step.done ? <Check className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-black text-slate-950">
                  {index + 1}. {step.name}
                </p>
                <p className="mt-1 text-sm text-slate-500">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Link
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
          to={ROUTES.scanDetail.replace(':scanId', scanId)}
        >
          <RotateCw className="h-4 w-4" />
          결과 워크벤치 열기
        </Link>
      </SectionPanel>

      <ApiEndpointList compact screenId="scanProgress" />
    </div>
  );
}

export default ScanProgressPage;
