import { Check, Clock, RotateCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { StatusPill } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';

const steps = [
  { name: 'REQUESTED', desc: '스캔 요청이 접수되었습니다.', done: true },
  { name: 'RAW_UPLOADED', desc: '원본 파일 또는 수집 데이터가 저장되었습니다.', done: true },
  { name: 'NORMALIZED', desc: '분석에 맞는 형식으로 데이터 정리가 완료되었습니다.', done: true },
  { name: 'ANALYZING', desc: '취약점과 설정 리스크를 분석하고 있습니다.', done: false },
  { name: 'DONE', desc: '결과 정리와 후속 화면 연결이 완료됩니다.', done: false },
];

function ScanProgressPage() {
  const { scanId = 'scan-a36' } = useParams<{ scanId: string }>();

  return (
    <SectionPanel
      action={<StatusPill value="ANALYZING" />}
      description="현재 스캔이 어느 단계까지 진행되었는지 확인할 수 있습니다."
      eyebrow="Scan status"
      title={scanId}
    >
      <div className="space-y-5">
        {steps.map((step, index) => (
          <div className="flex gap-4" key={step.name}>
            <div
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
              }`}
            >
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
        결과 화면으로 이동
      </Link>
    </SectionPanel>
  );
}

export default ScanProgressPage;
