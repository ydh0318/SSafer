import { useEffect, useMemo, useRef, useState } from 'react';

export type TypingCommandLike = {
  id: number;
  xp: number;
};

type TypingStageLike<TCommand extends TypingCommandLike = TypingCommandLike> = {
  commands: TCommand[];
  order: number;
  summary: string;
  title: string;
};

function useTypingGameSession<TStage extends TypingStageLike>(stages: TStage[]) {
  const [stageIdx, setStageIdx] = useState(0);
  const [cmdIdx, setCmdIdx] = useState(0);
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState(0);
  const [showEnding, setShowEnding] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [eating, setEating] = useState(false);
  const [cpm, setCpm] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [stageStrokes, setStageStrokes] = useState(0);
  const [maxStageCpm, setMaxStageCpm] = useState(0);
  const [showStageReport, setShowStageReport] = useState(false);

  const stage = stages[stageIdx];
  const currentCommand = stage.commands[cmdIdx];
  const isCurrentDone = doneIds.has(currentCommand.id);
  const isLastCmd = cmdIdx === stage.commands.length - 1;
  const isLastStage = stageIdx === stages.length - 1;

  const totalXp = useMemo(
    () =>
      stages
        .flatMap((currentStage) => currentStage.commands)
        .filter((currentCommand) => doneIds.has(currentCommand.id))
        .reduce((sum, currentCommand) => sum + currentCommand.xp, 0),
    [doneIds, stages],
  );

  const progressCount = isCurrentDone ? cmdIdx + 1 : cmdIdx;
  const progressPercent = (progressCount / stage.commands.length) * 100;

  const handleDone = () => {
    setDoneIds((prev) => new Set([...prev, currentCommand.id]));
    setEating(true);
    window.setTimeout(() => setEating(false), 800);
  };

  const goNextCmd = () => {
    if (!isLastCmd) {
      setCmdIdx((current) => current + 1);
    }
  };

  const goNextStage = () => {
    if (!isLastStage) {
      setStageIdx((current) => current + 1);
      setCmdIdx(0);
    }
  };

  const handleEnterNext = () => {
    if (!isLastCmd) {
      goNextCmd();
      return;
    }

    if (!isLastStage) {
      setShowStageReport(true);
      return;
    }

    setShowEnding(true);
  };

  const closeStageReportAndGoNext = () => {
    setShowStageReport(false);
    setStageStrokes(0);
    setMaxStageCpm(0);
    goNextStage();
  };

  const jumpTo = (nextStageIdx: number, nextCmdIdx: number) => {
    setStageIdx(nextStageIdx);
    setCmdIdx(nextCmdIdx);
    setSidebarOpen(false);
  };

  const openSidebarForCurrentStage = () => {
    setSidebarOpen(true);
    setSidebarTab(stageIdx);
  };

  const handleTypeActivity = (currentCpm: number, typingStatus: boolean) => {
    setCpm(currentCpm);
    setMaxStageCpm((prev) => Math.max(prev, currentCpm));
    setIsTyping(typingStatus);
  };

  const handleStroke = () => {
    setStageStrokes((prev) => prev + 1);
  };

  const ctrlCount = useRef(0);
  const ctrlTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAutoPlay(false);
      }

      if (event.key === 'Control') {
        ctrlCount.current += 1;

        if (ctrlCount.current >= 3) {
          setAutoPlay(true);
          ctrlCount.current = 0;
        }

        if (ctrlTimeout.current) {
          clearTimeout(ctrlTimeout.current);
        }

        ctrlTimeout.current = setTimeout(() => {
          ctrlCount.current = 0;
        }, 1000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (ctrlTimeout.current) {
        clearTimeout(ctrlTimeout.current);
      }
    };
  }, []);

  return {
    autoPlay,
    closeStageReportAndGoNext,
    cmdIdx,
    cpm,
    doneIds,
    eating,
    goNextCmd,
    goNextStage,
    handleDone,
    handleEnterNext,
    handleStroke,
    handleTypeActivity,
    isCurrentDone,
    isLastCmd,
    isLastStage,
    isTyping,
    jumpTo,
    maxStageCpm,
    openSidebarForCurrentStage,
    progressPercent,
    setAutoPlay,
    setShowEnding,
    setSidebarOpen,
    setSidebarTab,
    showEnding,
    showStageReport,
    sidebarOpen,
    sidebarTab,
    stage,
    stageIdx,
    stageStrokes,
    totalXp,
  };
}

export default useTypingGameSession;
