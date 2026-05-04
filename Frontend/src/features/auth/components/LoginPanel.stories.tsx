import type { ChangeEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Eye } from 'lucide-react';
import { useState } from 'react';

import AuthButton from './AuthButton';
import AuthField from './AuthField';
import AuthPanelHeading from './AuthPanelHeading';
import LoginPanel from './LoginPanel';

const meta = {
  title: 'Auth/Flows/LoginPanel',
  component: LoginPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '이메일/비밀번호 로그인 플로우 패널입니다. 입력 검증과 비밀번호 표시 토글을 포함하며, 인증 실패 시에는 비밀번호 필드 아래 인라인 오류를 노출합니다.',
      },
    },
  },
} satisfies Meta<typeof LoginPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="min-h-screen bg-[#f4f4f4] p-10">
      <div className="mx-auto max-w-[560px]">
        <LoginPanel />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '기본 로그인 화면입니다. 정상 입력 전 상태의 레이아웃과 간격을 확인할 수 있습니다.',
      },
    },
  },
};

export const WithCredentialError: Story = {
  render: () => {
    const [email, setEmail] = useState('ssafer@example.com');
    const [password, setPassword] = useState('wrong-password');

    return (
      <div className="min-h-screen bg-[#f4f4f4] p-10">
        <div className="mx-auto max-w-[560px]">
          <div>
            <AuthPanelHeading subtitle="SSAFER.io" title="Login" />

            <div className="mt-[clamp(2rem,5.6vh,3.5rem)] space-y-[clamp(0.875rem,2vh,1.25rem)]">
              <AuthField
                autoComplete="email"
                label="EMAIL ADDRESS"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                placeholder="Email Address"
                value={email}
              />
              <AuthField
                autoComplete="current-password"
                errorMessage="이메일 또는 비밀번호를 다시 확인해 주세요."
                label="PASSWORD"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
                placeholder="Password"
                trailing={
                  <span className="auth-body-text inline-flex items-center gap-1 text-[#c3c3c3]">
                    <Eye className="h-4 w-4" />
                    show
                  </span>
                }
                type="password"
                value={password}
              />
            </div>

            <div className="mt-[clamp(2.5rem,6vh,4.25rem)]">
              <AuthButton type="button">Login</AuthButton>
            </div>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: '`이메일 또는 비밀번호를 다시 확인해 주세요.` 메시지를 입력 필드 아래 인라인으로 보여주는 상태 예시입니다.',
      },
    },
  },
};
