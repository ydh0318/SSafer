import type { Meta, StoryObj } from '@storybook/react-vite';

import AuthShell from './AuthShell';

const meta = {
  title: 'Auth/Base/AuthShell',
  component: AuthShell,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof AuthShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SplitLayout: Story = {
  args: {
    left: <div className="rounded-xl border border-dashed border-slate-300 p-8">Left Panel</div>,
    right: <div className="rounded-xl border border-dashed border-slate-300 p-8">Right Panel</div>,
  },
};

export const SingleLayout: Story = {
  args: {
    left: <div className="rounded-xl border border-dashed border-slate-300 p-8">Single Panel</div>,
  },
};
