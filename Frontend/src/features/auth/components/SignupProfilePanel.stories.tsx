import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import type { SignupFormValues } from '../../../types/auth';
import { initialSignupFormValues } from '../utils/signup';
import SignupProfilePanel from './SignupProfilePanel';

function SignupProfileExample() {
  const [values, setValues] = useState<SignupFormValues>({
    ...initialSignupFormValues,
    email: 'ssafer@example.com',
  });

  const handleChange = <K extends keyof SignupFormValues>(field: K, value: SignupFormValues[K]) => {
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
}

const meta = {
  title: 'Auth/Flows/SignupProfilePanel',
  component: SignupProfilePanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '?대찓???몄쬆 ?댄썑 ?됰꽕?꾧낵 鍮꾨?踰덊샇瑜?留덈Т由??낅젰?섎뒗 ?④퀎?낅땲?? ?됰꽕???뺤씤 踰꾪듉, 鍮꾨?踰덊샇 ?쒖떆 ?좉?, 鍮꾨?踰덊샇 ?뺤씤 ?낅젰源뚯? ?ы븿?섎ŉ ?ㅼ젣 ?뚯썝媛???꾨즺 吏곸쟾 ?곹깭瑜??쒗쁽?⑸땲??',
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
  render: () => <SignupProfileExample />,
  parameters: {
    docs: {
      description: {
        story:
          '?됰꽕???뺤씤 踰꾪듉怨?鍮꾨?踰덊샇 ?낅젰 洹쒖튃???④퍡 蹂댁뿬二쇰뒗 湲곕낯 ?꾨줈???ㅼ젙 ?곹깭?낅땲??',
      },
    },
  },
};
