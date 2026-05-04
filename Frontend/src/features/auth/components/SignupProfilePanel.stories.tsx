import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import type { SignupFormValues } from '../../../types/auth';
import { initialSignupFormValues } from '../utils/signup';
import SignupProfilePanel from './SignupProfilePanel';

const meta = {
  title: 'Auth/Flows/SignupProfilePanel',
  component: SignupProfilePanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '이메일 인증 이후 닉네임과 비밀번호를 마무리 입력하는 단계입니다. 닉네임 확인 버튼, 비밀번호 표시 토글, 비밀번호 확인 입력까지 포함하며 실제 회원가입 완료 직전 상태를 표현합니다.',
      },
    },
  },
} satisfies Meta<typeof SignupProfilePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    values: initialSignupFormValues,
    onBack: () => {},
    onChange: () => {},
    onCompleted: () => {},
  },
  render: () => {
    const [values, setValues] = useState<SignupFormValues>({
      ...initialSignupFormValues,
      email: 'ssafer@example.com',
    });

    const handleChange = <K extends keyof SignupFormValues>(
      field: K,
      value: SignupFormValues[K],
    ) => {
      setValues((current) => ({
        ...current,
        [field]: value,
      }));
    };

    return (
      <div className="min-h-screen bg-[#f4f4f4] p-10">
        <div className="mx-auto max-w-[560px]">
          <SignupProfilePanel
            onBack={() => {}}
            onChange={handleChange}
            onCompleted={() => {}}
            values={values}
          />
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          '닉네임 확인 버튼과 비밀번호 입력 규칙을 함께 보여주는 기본 프로필 설정 상태입니다.',
      },
    },
  },
};
