import { BookOpen, GitBranch, KeyRound, LogOut, Mail, UserRound, UserX } from 'lucide-react';
import type { ReactNode } from 'react';

import SectionPanel from '../../components/common/SectionPanel';
import ApiEndpointList from '../../features/api-specs/components/ApiEndpointList';

function SettingsPage() {
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <SectionPanel description="사용자 설정 조회/수정, 비밀번호 변경, 소셜 계정 연결, 로그아웃, 회원 탈퇴, 상세 가이드를 묶어 보여줍니다." eyebrow="Settings" title="설정 / 가이드">
        <div className="grid gap-4 lg:grid-cols-2">
          <SettingsBlock icon={<UserRound className="h-5 w-5" />} items={['사용자 설정 조회', '사용자 설정 수정']} title="프로필" />
          <SettingsBlock icon={<KeyRound className="h-5 w-5" />} items={['비밀번호 변경', '로그아웃', '회원 탈퇴']} title="보안" />
          <SettingsBlock icon={<GitBranch className="h-5 w-5" />} items={['Google 소셜 계정 연결/해제', 'Github 소셜 계정 연결/해제']} title="소셜 계정" />
          <SettingsBlock icon={<BookOpen className="h-5 w-5" />} items={['상세 사용 가이드 조회', 'CLI 설치 안내', '에이전트 연결 가이드']} title="가이드" />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-400" type="button">
            <Mail className="h-4 w-4" />
            이메일 설정
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-400" type="button">
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-700" type="button">
            <UserX className="h-4 w-4" />
            회원 탈퇴
          </button>
        </div>
      </SectionPanel>

      <ApiEndpointList compact screenId="settings" />
    </div>
  );
}

function SettingsBlock({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <article className="rounded-lg border border-slate-200 p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700">{icon}</div>
        <h3 className="font-black text-slate-950">{title}</h3>
      </div>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600" key={item}>
            {item}
          </p>
        ))}
      </div>
    </article>
  );
}

export default SettingsPage;
