import { useEffect } from 'react';

import AppRouter from './app/router';
import { useUiStore } from './store/uiStore';

function App() {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.classList.remove('theme-light', 'theme-dark');
    body.classList.remove('theme-light', 'theme-dark');

    root.classList.add(`theme-${theme}`);
    body.classList.add(`theme-${theme}`);
  }, [theme]);

  return <AppRouter />;
}

export default App;
