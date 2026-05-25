import type { Meta, StoryObj } from '@storybook/react-vite';
import { Eye } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useState } from 'react';

import AuthButton from './AuthButton';
import AuthField from './AuthField';
import AuthPanelHeading from './AuthPanelHeading';
import LoginPanel from './LoginPanel';

function CredentialErrorExample() {
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
              errorMessage="?대찓???먮뒗 鍮꾨?踰덊샇瑜??ㅼ떆 ?뺤씤??二쇱꽭??"
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
}

const meta = {
  title: 'Auth/Flows/LoginPanel',
  component: LoginPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '?대찓??鍮꾨?踰덊샇 濡쒓렇???뚮줈???⑤꼸?낅땲?? ?낅젰 寃利앷낵 鍮꾨?踰덊샇 ?쒖떆 ?좉????ы븿?섎ŉ, ?몄쬆 ?ㅽ뙣 ?쒖뿉??鍮꾨?踰덊샇 ?꾨뱶 ?꾨옒 ?몃씪???ㅻ쪟瑜??몄텧?⑸땲??',
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
        story: '湲곕낯 濡쒓렇???붾㈃?낅땲?? ?뺤긽 ?낅젰 ???곹깭???덉씠?꾩썐怨?媛꾧꺽???뺤씤?????덉뒿?덈떎.',
      },
    },
  },
};

export const WithCredentialError: Story = {
  render: () => <CredentialErrorExample />,
  parameters: {
    docs: {
      description: {
        story: '`?대찓???먮뒗 鍮꾨?踰덊샇瑜??ㅼ떆 ?뺤씤??二쇱꽭??` 硫붿떆吏瑜??낅젰 ?꾨뱶 ?꾨옒 ?몃씪?몄쑝濡?蹂댁뿬二쇰뒗 ?곹깭 ?덉떆?낅땲??',
      },
    },
  },
};
