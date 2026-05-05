import { Moon, Sun } from 'lucide-react';

import { useUiStore } from '../../store/uiStore';

type ThemeToggleButtonProps = {
  className?: string;
};

function ThemeToggleButton({ className = '' }: ThemeToggleButtonProps) {
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  const isLight = theme === 'light';
  const Icon = isLight ? Moon : Sun;
  const label = isLight ? '다크모드' : '라이트모드';

  return (
    <button
      aria-label={label}
      className={`site-header-link theme-toggle-button inline-flex items-center justify-center px-3 py-2 text-neutral-700 transition hover:text-black ${className}`.trim()}
      onClick={toggleTheme}
      type="button"
    >
      <Icon className="h-4 w-4" strokeWidth={2.1} />
    </button>
  );
}

export default ThemeToggleButton;
