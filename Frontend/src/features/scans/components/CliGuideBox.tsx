import { useState } from 'react';
import { Copy, Check, Terminal, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

type Mode = 'AGENT' | 'CLI_UPLOAD';

interface CliGuideBoxProps {
  mode: Mode;
}

export default function CliGuideBox({ mode }: CliGuideBoxProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const isAgent = mode === 'AGENT';

  const commands = isAgent
    ? [
        { label: 'SSAfer 설치 (개발/검증)', cmd: 'cd CLI && python -m pip install -e .' },
        { label: '백엔드 인증 로그인', cmd: 'ssafer login' },
        { label: '에이전트 실행', cmd: 'ssafer agent' },
      ]
    : [
        { label: 'SSAfer 설치 (개발/검증)', cmd: 'cd CLI && python -m pip install -e .' },
        { label: '백엔드 인증 로그인', cmd: 'ssafer login' },
        { label: '스캔 실행 및 업로드', cmd: 'ssafer run --upload' },
      ];

  return (
    <div className="mt-1 border border-blue-200 bg-blue-50/50 p-5 rounded-md">
      <div className="flex items-center gap-2 mb-3">
        <Terminal className="w-5 h-5 text-blue-600" />
        <h4 className="font-bold text-blue-900 text-sm">
          {isAgent ? 'Local Agent 연동 가이드' : 'SSAfer CLI 스캔 가이드'}
        </h4>
      </div>

      <div className="bg-white border border-blue-100 rounded p-3 mb-4 flex items-start gap-2 text-sm text-neutral-700">
        <span className="text-xl">📂</span>
        <p className="mt-0.5 leading-relaxed">
          <strong className="font-bold">작업 위치:</strong>{' '}
          {isAgent
            ? '점검할 서버(EC2 등)에 SSH로 접속한 뒤, 프로젝트 코드가 위치한 디렉터리에서 터미널을 열어주세요.'
            : '점검할 코드가 위치한 프로젝트의 최상위 폴더(Root Directory)에서 터미널을 열어주세요.'}

        </p>
      </div>

      <div className="grid gap-3">
        {commands.map((item, idx) => (
          <div key={idx}>
            <div className="text-xs font-bold text-neutral-600 mb-1">{`Step ${idx + 1}. ${item.label}`}</div>
            <div className="flex items-center justify-between bg-black text-[#3DDC84] p-3 rounded text-xs font-mono">
              <span className="overflow-x-auto whitespace-nowrap scrollbar-hide mr-4">{item.cmd}</span>
              <button
                onClick={() => handleCopy(item.cmd, idx)}
                className="shrink-0 text-[10px] font-bold text-black bg-[#3DDC84] hover:bg-[#32b56c] px-2 py-1 rounded flex items-center gap-1 transition"
                type="button"
                aria-label={`${item.cmd} 복사`}
              >
                {copiedIndex === idx ? <><Check className="w-3 h-3" /> 복사됨</> : <><Copy className="w-3 h-3" /> 복사</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {isAgent && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 leading-relaxed">
          Agent가 <strong>ONLINE</strong> 상태일 때만 웹에서 스캔을 시작할 수 있습니다.
          웹 버튼을 누르면 Agent가 스캔과 업로드를 <strong>한 번에 처리</strong>합니다.
        </div>
      )}

      {/* Troubleshoot Accordion */}
      <div className="mt-4 pt-3 border-t border-blue-200/60">
        <button
          onClick={() => setShowTroubleshoot(!showTroubleshoot)}
          className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-800 transition"
          type="button"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          pip 명령어 오류가 발생하나요?
          {showTroubleshoot ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
        </button>

        {showTroubleshoot && (
          <div className="mt-2 text-xs text-neutral-600 leading-relaxed bg-white/50 p-3 rounded border border-blue-100">
            Ubuntu 24.04 등 일부 환경에서는 전역 pip 설치가 제한될 수 있습니다.<br />
            이 경우 아래 명령어로 가상 환경(venv)을 만들어 설치해 보세요.<br />
            <code className="bg-white border border-neutral-200 px-2 py-1.5 rounded text-neutral-800 mt-2 block font-mono">
              sudo apt install -y python3-venv<br />
              python3 -m venv ~/.ssafer-venv<br />
              source ~/.ssafer-venv/bin/activate<br />
              cd CLI && pip install -e .
            </code>
          </div>
        )}
      </div>
    </div>
  );
}