import { AlertTriangle, BellRing, KeyRound, Lock, LogOut, User } from 'lucide-react';
import { useState } from 'react';

import PageHero from '../../components/common/PageHero';
import PixelGoose from '../../components/common/PixelGoose';

function SettingsPage() {
  const [tab, setTab] = useState('profile');

  return (
    <section className="space-y-8">
      <PageHero
        aside={
          <div className="border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-500">ACCOUNT</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight">송이</h2>
              </div>
              <PixelGoose mood="idle" size={76} />
            </div>
          </div>
        }
        description="프로필, 보안, 토큰, 알림 설정을 한곳에서 관리할 수 있습니다."
        eyebrow="SETTINGS"
        title="설정"
      />

      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border border-neutral-200 bg-white">
          {[
            { id: 'profile', label: '프로필', icon: User },
            { id: 'security', label: '보안', icon: Lock },
            { id: 'notify', label: '알림', icon: BellRing },
            { id: 'token', label: '토큰', icon: KeyRound },
            { id: 'danger', label: '계정', icon: AlertTriangle },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <button
                className={`flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left last:border-b-0 ${
                  tab === item.id ? 'border-l-2 border-l-black bg-[#F5F5F5] font-bold' : 'hover:bg-[#F5F5F5]'
                }`}
                key={item.id}
                onClick={() => setTab(item.id)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </aside>

        <main>
          {tab === 'profile' ? (
            <div className="space-y-5 border border-neutral-200 bg-white p-8">
              <div className="flex items-center gap-4">
                <div className="grid h-20 w-20 place-items-center bg-black text-2xl font-black text-white">SY</div>
                <button className="border border-neutral-300 px-3 py-1.5 text-sm" type="button">사진 변경</button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold tracking-[0.24em] text-neutral-500">이메일</span>
                  <input className="mt-1 block w-full border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm" defaultValue="songyi@ssafer.dev" disabled />
                </label>
                <label className="block">
                  <span className="text-xs font-bold tracking-[0.24em] text-neutral-500">닉네임</span>
                  <input className="mt-1 block w-full border border-neutral-300 px-3 py-2 text-sm" defaultValue="송이" />
                </label>
              </div>
              <button className="bg-black px-5 py-2.5 text-sm font-bold text-white" type="button">저장</button>
            </div>
          ) : null}

          {tab === 'security' ? (
            <div className="space-y-5 border border-neutral-200 bg-white p-8">
              <h2 className="text-xl font-black tracking-tight">비밀번호 변경</h2>
              {['현재 비밀번호', '새 비밀번호', '새 비밀번호 확인'].map((label) => (
                <label className="block" key={label}>
                  <span className="text-xs font-bold tracking-[0.24em] text-neutral-500">{label}</span>
                  <input className="mt-1 block w-full border border-neutral-300 px-3 py-2 text-sm" type="password" />
                </label>
              ))}
              <button className="bg-black px-5 py-2.5 text-sm font-bold text-white" type="button">비밀번호 변경</button>
            </div>
          ) : null}

          {tab === 'notify' ? (
            <div className="space-y-5 border border-neutral-200 bg-white p-8">
              <h2 className="text-xl font-black tracking-tight">알림 설정</h2>
              {[
                { label: '새 CRITICAL finding 발생 시', checked: true },
                { label: 'Agent OFFLINE 알림', checked: true },
                { label: '주간 리포트 (월요일)', checked: false },
                { label: '챌린지 리마인더', checked: false },
              ].map((item) => (
                <label className="flex items-center justify-between border-b border-neutral-100 pb-3" key={item.label}>
                  <span className="text-sm">{item.label}</span>
                  <input className="h-4 w-4 accent-black" defaultChecked={item.checked} type="checkbox" />
                </label>
              ))}
            </div>
          ) : null}

          {tab === 'token' ? (
            <div className="space-y-5 border border-neutral-200 bg-white p-8">
              <h2 className="text-xl font-black tracking-tight">CLI / Agent 토큰</h2>
              <p className="text-sm text-neutral-600">CLI와 Local Agent 연결 시 사용하는 토큰입니다.</p>
              <div className="flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                <span>ssafer_pat_xxxxxxxxxxxxxxxxxxxxxxxx</span>
                <span className="text-neutral-500">copy</span>
              </div>
              <div className="flex gap-3">
                <button className="bg-black px-4 py-2 text-sm font-bold text-white" type="button">재발급</button>
                <button className="border border-neutral-300 px-4 py-2 text-sm" type="button">폐기</button>
              </div>
            </div>
          ) : null}

          {tab === 'danger' ? (
            <div className="space-y-4 border-2 border-[#E63946] bg-white p-8">
              <h2 className="text-xl font-black tracking-tight text-[#E63946]">위험 영역</h2>
              <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
                <div>
                  <div className="font-bold">로그아웃</div>
                  <div className="mt-1 text-xs text-neutral-500">모든 기기에서 현재 세션을 종료합니다.</div>
                </div>
                <button className="inline-flex items-center gap-1.5 border border-neutral-300 px-4 py-2 text-sm" type="button">
                  <LogOut className="h-3.5 w-3.5" />
                  로그아웃
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
                <div>
                  <div className="font-bold text-[#E63946]">회원 탈퇴</div>
                  <div className="mt-1 text-xs text-neutral-500">계정은 INACTIVE 상태로 전환됩니다.</div>
                </div>
                <button className="bg-[#E63946] px-4 py-2 text-sm font-bold text-white" type="button">탈퇴</button>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </section>
  );
}

export default SettingsPage;
