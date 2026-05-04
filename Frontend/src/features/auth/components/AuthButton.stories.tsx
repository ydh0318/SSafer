import type { Meta, StoryObj } from '@storybook/react-vite';

import AuthButton from './AuthButton';

const meta = {
  title: 'Auth/Base/AuthButton',
  component: AuthButton,
  tags: ['autodocs'],
  args: {
    children: 'Continue',
    isLoading: false,
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '인증 흐름 전반에서 공통으로 사용하는 버튼입니다. `primary`, `secondary`, `ghost` 변형을 지원하며, 제출 중에는 `isLoading`으로 스피너 상태를 표시합니다.',
      },
    },
  },
} satisfies Meta<typeof AuthButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Loading: Story = {
  args: {
    isLoading: true,
    children: 'Submitting',
  },
  parameters: {
    docs: {
      description: {
        story: 'API 요청 중 버튼을 비활성화하고 로딩 인디케이터를 보여주는 상태입니다.',
      },
    },
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Back',
  },
  parameters: {
    docs: {
      description: {
        story: '보조 액션이나 이전 단계 이동처럼 주 액션보다 덜 강조할 버튼에 사용합니다.',
      },
    },
  },
};
