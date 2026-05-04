import { useParams } from 'react-router-dom';

function ResultPage() {
  const { scanId } = useParams<{ scanId: string }>();

  return (
    <section className="space-y-4">
      <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">Results</p>
      <h2 className="text-3xl font-semibold text-white">Result Page</h2>
      <p className="text-sm leading-6 text-slate-400">
        스캔 결과 목록과 요약, 취약점 상세가 들어갈 페이지입니다. 현재 선택된 스캔 ID는{' '}
        <span className="text-slate-200">{scanId}</span> 입니다.
      </p>
    </section>
  );
}

export default ResultPage;
