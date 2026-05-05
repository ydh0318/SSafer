import { Info, Trophy } from 'lucide-react';
import { useState } from 'react';

import PixelGoose from '../../components/common/PixelGoose';
import TypingBox from '../../components/common/TypingBox';
import SiteHeader from '../../components/layout/SiteHeader';
import { typingChallenges } from '../../mocks/ssaferShowcase';

function TypingGamePage() {
  const [active, setActive] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);

  const handleComplete = (challengeId: number) => {
    setCompleted((current) =>
      current.includes(challengeId) ? current : [...current, challengeId],
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-black">
      <SiteHeader showSessionBar={false} />

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.32em] text-neutral-500">
              <Trophy className="h-3 w-3" />
              security typing challenge
            </p>
            <h1 className="mt-3 text-5xl font-black tracking-tight">손에 익히는 안전한 한 줄.</h1>
            <p className="mt-3 max-w-2xl text-neutral-600">
              매일 5분, 자주 쓰는 안전한 설정을 직접 타이핑해보세요. 실수가 줄고 코드 리뷰가 빨라집니다.
            </p>
          </div>
          <div className="flex items-end gap-6">
            <PixelGoose mood="victory" size={110} />
            <div className="bg-black p-5 text-right text-white">
              <div className="text-xs font-bold tracking-[0.24em] text-[#3DDC84]">YOUR XP</div>
              <div className="mt-1 text-4xl font-black tracking-tight">125</div>
              <div className="mt-1 text-xs text-neutral-400">Lv.3 · Goose Apprentice</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div>
            <div className="border border-neutral-200 bg-white">
              <div className="border-b border-neutral-200 px-5 py-3 text-sm font-bold">오늘의 5문제</div>
              {typingChallenges.map((challenge, index) => {
                const isDone = completed.includes(challenge.id);
                const isActive = active === index;

                return (
                  <button
                    className={`flex w-full items-start gap-3 border-b border-neutral-100 p-4 text-left transition last:border-b-0 ${
                      isActive ? 'border-l-2 border-l-black bg-[#F5F5F5]' : 'hover:bg-[#F5F5F5]'
                    }`}
                    key={challenge.id}
                    onClick={() => setActive(index)}
                    type="button"
                  >
                    <div
                      className={`grid h-7 w-7 place-items-center text-xs font-bold ${
                        isDone
                          ? 'bg-[#3DDC84] text-black'
                          : isActive
                            ? 'bg-black text-white'
                            : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {isDone ? '✓' : index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold tracking-[0.24em] text-neutral-400">
                          {challenge.level}
                        </span>
                        <span className="text-[10px] text-neutral-400">+{challenge.xp} XP</span>
                      </div>
                      <div
                        className={`mt-1 text-sm font-bold ${
                          isDone ? 'line-through text-neutral-400' : ''
                        }`}
                      >
                        {challenge.title}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 border border-neutral-200 bg-white p-5">
              <div className="text-sm font-bold">스트릭 & 랭킹</div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-3xl">🔥</span>
                <span className="text-3xl font-black">7</span>
                <span className="text-sm text-neutral-500">일 연속</span>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1">
                {[1, 1, 1, 1, 1, 1, 1].map((value, index) => (
                  <div
                    className={value ? 'aspect-square bg-[#3DDC84]' : 'aspect-square bg-neutral-100'}
                    key={index}
                  />
                ))}
              </div>
              <div className="mt-4 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                <div className="flex justify-between">
                  <span>전체 랭킹</span>
                  <span className="font-bold text-black">#42</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>SSAFY 16기</span>
                  <span className="font-bold text-black">#7</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="border-2 border-black bg-white">
              <div className="flex items-center justify-between bg-black px-6 py-4 text-white">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold tracking-[0.24em] text-[#3DDC84]">
                    CHALLENGE {active + 1} / {typingChallenges.length}
                  </span>
                  <span className="bg-neutral-800 px-2 py-0.5 text-xs">
                    {typingChallenges[active].level} · +{typingChallenges[active].xp} XP
                  </span>
                </div>
                <PixelGoose mood="working" size={40} />
              </div>
              <div className="p-8">
                <h2 className="text-3xl font-black tracking-tight">{typingChallenges[active].title}</h2>
                <p className="mt-3 flex items-center gap-2 text-neutral-600">
                  <Info className="h-4 w-4" />
                  {typingChallenges[active].explain}
                </p>
                <div className="mt-8 text-xs font-bold uppercase tracking-[0.28em] text-neutral-500">
                  아래 코드를 그대로 따라쳐 주세요
                </div>
                <div className="mt-3">
                  <TypingBox
                    key={typingChallenges[active].id}
                    onComplete={() => handleComplete(typingChallenges[active].id)}
                    rewardLabel={`+${typingChallenges[active].xp} XP`}
                    snippet={typingChallenges[active].snippet}
                  />
                </div>
              </div>
            </div>

            <div className="theme-dark-soft-card mt-6 flex items-center gap-4 border border-[#FFE066] bg-[#FFF9DB] p-5">
              <PixelGoose mood="happy" size={52} />
              <div className="flex-1">
                <div className="text-sm font-bold">SSAFE의 응원</div>
                <p className="mt-1 text-sm text-neutral-700">
                  줄바꿈이 있는 문제도 이제 그대로 입력할 수 있습니다. 엔터를 치면 다음 줄로 자연스럽게 이어집니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TypingGamePage;
