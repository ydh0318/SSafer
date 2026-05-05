import { AlertTriangle, ArrowLeft, Check, ExternalLink, Send, Trophy, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import PixelGoose from '../../components/common/PixelGoose';
import TypingBox from '../../components/common/TypingBox';
import { ROUTES } from '../../constants/routes';
import { getShowcaseFinding, severityMeta, showcaseFindings } from '../../mocks/ssaferShowcase';

type FindingRouteState = {
  projectId?: string;
};

function FindingDetailPage() {
  const { scanId = '1001', findingId = '2001' } = useParams<{ scanId: string; findingId: string }>();
  const location = useLocation();
  const routeState = (location.state ?? {}) as FindingRouteState;
  const [view, setView] = useState<'explain' | 'fix' | 'apply' | 'references'>('explain');

  const finding = getShowcaseFinding(Number(findingId));
  const relatedFindings = useMemo(
    () => showcaseFindings.filter((item) => String(item.scanId) === String(scanId)),
    [scanId],
  );

  return (
    <section className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-black"
        state={routeState}
        to={ROUTES.resultDetail.replace(':scanId', scanId)}
      >
        <ArrowLeft className="h-4 w-4" />
        결과 목록
      </Link>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="border border-neutral-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="px-2 py-1 text-[10px] font-bold tracking-[0.24em]"
                  style={{
                    background: severityMeta[finding.severity].bg,
                    color: severityMeta[finding.severity].fg,
                  }}
                >
                  {finding.severity}
                </span>
                <span className="font-mono text-xs text-neutral-500">findingId #{finding.findingId}</span>
                <span className="font-mono text-xs text-neutral-500">{finding.ruleCode}</span>
                <span className="border border-neutral-300 px-2 py-0.5 text-xs">{finding.sourceType}</span>
                <span className="bg-neutral-100 px-2 py-0.5 text-xs">{finding.category}</span>
              </div>
              <select className="border border-neutral-300 bg-white px-3 py-1.5 text-xs">
                <option>OPEN</option>
                <option>IN_PROGRESS</option>
                <option>RESOLVED</option>
                <option>IGNORED</option>
              </select>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight">{finding.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-sm text-neutral-500">
              <span>
                {finding.filePath}
                {finding.lineNumber > 0 ? `:${finding.lineNumber}` : ''}
              </span>
              <span>scanId #{scanId}</span>
              <span>{finding.fingerprint}</span>
            </div>
          </div>

          <div className="mt-6 flex border-b border-neutral-300">
            {[
              { id: 'explain', label: '왜 위험한가', icon: AlertTriangle },
              { id: 'fix', label: '어떻게 고치나', icon: Wand2 },
              { id: 'apply', label: '적용', icon: Send },
              { id: 'references', label: '참고 자료', icon: ExternalLink },
            ].map((tab) => {
              const Icon = tab.icon;

              return (
                <button
                  className={`-mb-px flex items-center gap-2 border-b-2 px-5 py-3 ${
                    view === tab.id ? 'border-black font-bold' : 'border-transparent text-neutral-500 hover:text-black'
                  }`}
                  key={tab.id}
                  onClick={() => setView(tab.id as typeof view)}
                  type="button"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {view === 'explain' ? (
            <div className="mt-6 space-y-6">
              <div className="border border-neutral-200 bg-white p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">description</div>
                <p className="mt-3 leading-8 text-neutral-800">{finding.description}</p>
              </div>
              <div className="border border-neutral-200 bg-white p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">attack scenario</div>
                <p className="mt-3 leading-8 text-neutral-800">{finding.attackScenario}</p>
              </div>
              <div className="flex items-start gap-4 border border-[#FFE066] bg-[#FFF9DB] p-6">
                <PixelGoose mood="alert" size={60} />
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">SSAFE 코멘트</div>
                  <p className="mt-2 text-sm leading-7 text-neutral-800">
                    시크릿과 권한 관련 항목은 실제 악용까지 거리가 짧아서, 설명만 읽고 넘기기보다 바로 수정 우선순위에 올리는 편이 안전합니다.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {view === 'fix' ? (
            <div className="mt-6 space-y-6">
              <div className="border border-neutral-200 bg-white p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-neutral-500">remediation guide</div>
                <p className="mt-3 leading-8 text-neutral-800">{finding.remediationGuide}</p>
              </div>

              <div className="grid overflow-hidden border border-neutral-200 bg-white xl:grid-cols-2">
                <div>
                  <div className="border-b border-neutral-200 bg-[#FFE5E5] px-5 py-3 text-xs font-bold tracking-[0.24em] text-[#E63946]">BEFORE</div>
                  <pre className="overflow-x-auto bg-neutral-900 p-5 font-mono text-sm leading-7 text-neutral-100">{finding.before}</pre>
                </div>
                <div className="border-t border-neutral-200 xl:border-l xl:border-t-0">
                  <div className="border-b border-neutral-200 bg-[#E6F9EE] px-5 py-3 text-xs font-bold tracking-[0.24em] text-[#0A7C2E]">AFTER</div>
                  <pre className="overflow-x-auto bg-neutral-900 p-5 font-mono text-sm leading-7 text-neutral-100">{finding.after}</pre>
                </div>
              </div>

              <div className="border-2 border-black bg-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-[0.24em]">직접 타이핑해서 익히기</span>
                  </div>
                  <span className="text-xs text-neutral-500">+10 XP</span>
                </div>
                <p className="mt-3 text-sm text-neutral-600">
                  아래 안전한 버전을 손으로 직접 쳐보면 다음엔 더 빨리 고칠 수 있습니다.
                </p>
                <div className="mt-4">
                  <TypingBox snippet={finding.after.split('\n').slice(-2, -1)[0] ?? finding.after} />
                </div>
              </div>
            </div>
          ) : null}

          {view === 'apply' ? (
            <div className="mt-6 space-y-6">
              <div className="border-2 border-black bg-white p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Local Agent로 즉시 적용</h3>
                    <p className="mt-2 text-sm text-neutral-600">
                      백업 생성, 치환 적용, 검증, 결과 보고까지 한 번에 처리하는 흐름입니다.
                    </p>
                  </div>
                  <span className="bg-[#3DDC84] px-2 py-1 text-[10px] font-bold tracking-[0.24em] text-black">AGENT ONLINE</span>
                </div>
                <div className="mt-5 bg-[#F5F5F5] p-4 font-mono text-xs leading-7 text-neutral-700">
                  <div>1. Backup .env → .env.bak</div>
                  <div>2. Replace line {finding.lineNumber}: secure value injection</div>
                  <div>3. Verify syntax and restart-safe checks</div>
                  <div>4. Save patch result with approved user metadata</div>
                </div>
                <button className="mt-5 w-full bg-black py-3 text-sm font-bold tracking-wide text-white" type="button">
                  Agent에 패치 작업 전송
                </button>
              </div>

              <div className="bg-black p-6 text-white">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-[#3DDC84]">CLI로 직접 적용</div>
                <div className="mt-3 bg-neutral-900 p-4 font-mono text-sm">
                  <span className="text-neutral-500">$</span> ssafer apply --finding-id {finding.findingId}
                </div>
              </div>
            </div>
          ) : null}

          {view === 'references' ? (
            <div className="mt-6 space-y-3">
              {[
                { tag: 'OWASP', title: 'OWASP Secrets Management Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/' },
                { tag: 'BEST PRACTICE', title: '12 Factor App - Config', url: 'https://12factor.net/config' },
                { tag: 'REPORT', title: 'GitGuardian State of Secrets Sprawl', url: 'https://blog.gitguardian.com/' },
                { tag: 'AWS', title: 'AWS Secrets Manager 시작하기', url: 'https://docs.aws.amazon.com/' },
              ].map((reference) => (
                <a className="flex items-center justify-between border border-neutral-200 bg-white p-5 transition hover:border-black" href={reference.url} key={reference.title} rel="noreferrer" target="_blank">
                  <div>
                    <span className="bg-black px-2 py-0.5 text-[10px] font-bold tracking-[0.22em] text-white">{reference.tag}</span>
                    <div className="mt-2 font-bold">{reference.title}</div>
                    <div className="mt-1 font-mono text-xs text-neutral-500">{reference.url}</div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-neutral-400" />
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <aside className="sticky top-24 h-fit border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <span className="text-sm font-bold">이 스캔의 다른 finding</span>
            <span className="text-xs text-neutral-400">{relatedFindings.length}건</span>
          </div>
          <div>
            {relatedFindings.map((item) => {
              const active = item.findingId === finding.findingId;
              const dimmed = item.resolutionStatus === 'RESOLVED' || item.resolutionStatus === 'IGNORED';

              return (
                <Link
                  className={`block border-b border-neutral-100 p-3 last:border-b-0 hover:bg-[#F5F5F5] ${active ? 'border-l-2 border-l-black bg-[#F5F5F5]' : ''} ${dimmed ? 'opacity-50' : ''}`}
                  key={item.findingId}
                  state={routeState}
                  to={ROUTES.resultFindingDetail
                    .replace(':scanId', String(item.scanId))
                    .replace(':findingId', String(item.findingId))}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: severityMeta[item.severity].bg }} />
                    <span className="font-mono text-[10px] text-neutral-500">#{item.findingId}</span>
                    <span className="ml-auto text-[9px] tracking-[0.18em] text-neutral-400">{item.resolutionStatus}</span>
                  </div>
                  <div className={`mt-1 text-sm font-medium ${dimmed ? 'line-through' : ''}`}>{item.title}</div>
                </Link>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-3 text-xs">
            <button className="text-neutral-500" type="button">이전</button>
            <span className="text-neutral-400">1 / {relatedFindings.length}</span>
            <button className="font-bold" type="button">다음</button>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default FindingDetailPage;
