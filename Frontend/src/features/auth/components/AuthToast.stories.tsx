import type { Meta, StoryObj } from '@storybook/react-vite';

import AuthToast from './AuthToast';

const meta = {
  title: 'Auth/Feedback/AuthToast',
  component: AuthToast,
  tags: ['autodocs'],
  args: {
    message: '회원가입이 완료되었습니다. 로그인해 주세요.',
    onClose: () => {},
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '성공 또는 안내성 알림에 사용하는 플로팅 토스트입니다. 현재 인증 UX 규칙상 실패 메시지는 토스트보다 인라인 오류를 우선 사용하고, 토스트는 주로 성공/안내 피드백에 사용합니다.',
      },
    },
  },
} satisfies Meta<typeof AuthToast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: {
    tone: 'success',
  },
  parameters: {
    docs: {
      description: {
        story: '회원가입 완료, 인증 코드 재전송 완료처럼 사용자가 다음 단계로 넘어갈 수 있을 때 사용하는 상태입니다.',
      },
    },
  },
};

export const Error: Story = {
  args: {
    tone: 'error',
    message: '인증 번호 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  },
  parameters: {
    docs: {
      description: {
        story: '디자인 비교용 에러 예시입니다. 실제 인증 플로우에서는 같은 메시지를 인라인으로 보여주는 쪽을 기본 규칙으로 사용합니다.',
      },
    },
  },
};

export const Info: Story = {
  args: {
    tone: 'info',
    message: '입력한 이메일로 인증 코드를 보냈습니다.',
  },
  parameters: {
    docs: {
      description: {
        story: '행동이 정상 처리되었음을 가볍게 알려주는 안내형 상태입니다.',
      },
    },
  },
};
