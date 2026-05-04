import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ChangeEvent, ComponentProps } from 'react';
import { useState } from 'react';

import AuthField from './AuthField';

const meta = {
  title: 'Auth/Base/AuthField',
  component: AuthField,
  tags: ['autodocs'],
  args: {
    label: 'EMAIL ADDRESS',
    placeholder: 'Email Address',
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '인증 화면에서 사용하는 기본 입력 컴포넌트입니다. `errorMessage`로 인라인 오류를, `helperText`로 보조 설명을, `trailing`으로 show 버튼이나 액션 요소를 배치합니다.',
      },
    },
  },
} satisfies Meta<typeof AuthField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args: ComponentProps<typeof AuthField>) => {
    const [value, setValue] = useState('');

    return (
      <AuthField
        {...args}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value)}
        value={value}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story: '기본 입력 상태입니다. 가장 일반적인 텍스트 입력 UI로 사용합니다.',
      },
    },
  },
};

export const WithError: Story = {
  args: {
    errorMessage: '이미 가입된 이메일입니다.',
    value: 'hello@example.com',
    onChange: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: '실패 메시지는 토스트가 아니라 입력창 바로 아래 인라인으로 노출하는 패턴을 사용합니다.',
      },
    },
  },
};

export const WithHelper: Story = {
  args: {
    helperText: '입력한 이메일로 인증 코드를 보내드립니다.',
    value: '',
    onChange: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: '사용자가 다음 액션을 이해해야 할 때 보조 문구를 함께 보여주는 예시입니다.',
      },
    },
  },
};
