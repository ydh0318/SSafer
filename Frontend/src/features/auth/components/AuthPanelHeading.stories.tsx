import type { Meta, StoryObj } from '@storybook/react-vite';

import AuthPanelHeading from './AuthPanelHeading';

const meta = {
  title: 'Auth/Base/AuthPanelHeading',
  component: AuthPanelHeading,
  tags: ['autodocs'],
  args: {
    title: 'Login',
    subtitle: 'SSAFER.io',
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '인증 화면 상단 타이틀 블록입니다. 로그인, 회원가입, 단계별 패널에서 동일한 위계를 유지하도록 사용합니다.',
      },
    },
  },
} satisfies Meta<typeof AuthPanelHeading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Signup: Story = {
  args: {
    title: 'New',
    subtitle: 'Member',
  },
};
