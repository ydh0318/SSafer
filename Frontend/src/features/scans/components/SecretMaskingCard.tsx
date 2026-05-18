import { Lock } from 'lucide-react';

function SecretMaskingCard() {
  return (
    <div className="bg-[#0F0F0F] p-6 text-white landing-card-radius">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-[#D4FC64]" />
        <h3 className="text-base font-black tracking-tight">시크릿 자동 마스킹</h3>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-white/70">
        업로드된 파일의 민감 정보는 분석 서버로 보내기 전에 자동으로 마스킹됩니다. 원본은 서버에 저장되지 않음.
      </p>
      <ul className="mt-5 space-y-1.5 font-mono text-[12px] text-[#D4FC64]/90">
        <li>→ password, passwd, pwd</li>
        <li>→ api_key, token, secret</li>
        <li>→ private key 블록 전체</li>
        <li>→ AWS access key (AKIA...)</li>
      </ul>
    </div>
  );
}

export default SecretMaskingCard;
