import type { ChangeEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import AuthButton from './AuthButton';
import AuthField from './AuthField';
import AuthPanelHeading from './AuthPanelHeading';
import SignupEmailPanel from './SignupEmailPanel';

const meta = {
  title: 'Auth/Flows/SignupEmailPanel',
  component: SignupEmailPanel,
  tags: ['autodocs'],
  args: {
    email: '',
    onEmailChange: () => {},
    onVerificationStarted: () => {},
    onVerificationCodeSent: () => {},
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '회원가입 첫 단계 패널입니다. 이메일을 입력받고 인증 코드 발송을 시작합니다. 이미 가입된 이메일이나 요청 제한 같은 실패 상태는 모두 이메일 입력 아래 인라인으로 통일합니다.',
      },
    },
  },
} satisfies Meta<typeof SignupEmailPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [email, setEmail] = useState('');

    return (
      <div className="min-h-screen bg-[#f4f4f4] p-10">
        <div className="mx-auto max-w-[560px]">
          <SignupEmailPanel
            email={email}
            onEmailChange={setEmail}
            onVerificationCodeSent={() => {}}
            onVerificationStarted={() => {}}
          />
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: '기본 회원가입 첫 화면입니다. 사용자가 이메일을 입력하고 인증을 시작하는 단계입니다.',
      },
    },
  },
};

export const WithExistingEmailError: Story = {
  render: () => {
    const [email, setEmail] = useState('ssafer@example.com');

    return (
      <div className="min-h-screen bg-[#f4f4f4] p-10">
        <div className="mx-auto max-w-[560px]">
          <div>
            <AuthPanelHeading subtitle="Member" title="New" />

            <div className="mt-[clamp(2rem,5.6vh,3.5rem)] space-y-[clamp(0.875rem,2vh,1.25rem)]">
              <AuthField
                autoComplete="email"
                errorMessage="이미 가입된 이메일입니다."
                label="EMAIL ADDRESS"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                placeholder="Email Address"
                value={email}
              />
            </div>

            <div className="mt-[clamp(2.5rem,6vh,4.25rem)] space-y-[clamp(0.875rem,2vh,1.25rem)]">
              <AuthButton type="button">Continue</AuthButton>
              <p className="auth-body-text text-black">
                입력한 이메일로 회원가입 인증 코드를 보내드립니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: '`이미 가입된 이메일입니다.`를 인라인으로 보여주는 상태입니다.',
      },
    },
  },
};

export const WithRateLimitError: Story = {
  render: () => {
    const [email, setEmail] = useState('ssafer@example.com');

    return (
      <div className="min-h-screen bg-[#f4f4f4] p-10">
        <div className="mx-auto max-w-[560px]">
          <div>
            <AuthPanelHeading subtitle="Member" title="New" />

            <div className="mt-[clamp(2rem,5.6vh,3.5rem)] space-y-[clamp(0.875rem,2vh,1.25rem)]">
              <AuthField
                autoComplete="email"
                errorMessage="인증 번호 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
                label="EMAIL ADDRESS"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                placeholder="Email Address"
                value={email}
              />
            </div>

            <div className="mt-[clamp(2.5rem,6vh,4.25rem)] space-y-[clamp(0.875rem,2vh,1.25rem)]">
              <AuthButton type="button">Continue</AuthButton>
              <p className="auth-body-text text-black">
                입력한 이메일로 회원가입 인증 코드를 보내드립니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: '`인증 번호 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.`를 인라인으로 보여주는 상태입니다.',
      },
    },
  },
};
