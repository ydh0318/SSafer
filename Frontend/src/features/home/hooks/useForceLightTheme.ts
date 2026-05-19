import { useEffect } from 'react';

import { useUiStore } from '../../../store/uiStore';

/**
 * 마운트 시 테마를 light로 강제, 언마운트 시 원래 테마로 복원.
 * 랜딩 페이지처럼 라이트 디자인 전용 페이지에서 사용.
 */
export function useForceLightTheme() {
  useEffect(() => {
    const previousTheme = useUiStore.getState().theme;
    if (previousTheme !== 'light') {
      useUiStore.getState().setTheme('light');
    }
    return () => {
      const currentTheme = useUiStore.getState().theme;
      if (previousTheme !== 'light' && currentTheme === 'light') {
        useUiStore.getState().setTheme(previousTheme);
      }
    };
  }, []);
}
