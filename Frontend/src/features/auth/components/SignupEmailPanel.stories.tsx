import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ChangeEvent } from 'react';
import { useState } from 'react';

import AuthButton from './AuthButton';
import AuthField from './AuthField';
import AuthPanelHeading from './AuthPanelHeading';
import SignupEmailPanel from './SignupEmailPanel';

function DefaultSignupEmailExample() {
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
}

function ExistingEmailExample() {
  const [email, setEmail] = useState('ssafer@example.com');

  return (
    <div className="min-h-screen bg-[#f4f4f4] p-10">
      <div className="mx-auto max-w-[560px]">
        <div>
          <AuthPanelHeading subtitle="Member" title="New" />

          <div className="mt-[clamp(2rem,5.6vh,3.5rem)] space-y-[clamp(0.875rem,2vh,1.25rem)]">
            <AuthField
              autoComplete="email"
              errorMessage="?대? 媛?낅맂 ?대찓?쇱엯?덈떎."
              label="EMAIL ADDRESS"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
              placeholder="Email Address"
              value={email}
            />
          </div>

          <div className="mt-[clamp(2.5rem,6vh,4.25rem)] space-y-[clamp(0.875rem,2vh,1.25rem)]">
            <AuthButton type="button">Continue</AuthButton>
            <p className="auth-body-text text-black">
              ?낅젰???대찓?쇰줈 ?뚯썝媛???몄쬆 肄붾뱶瑜?蹂대궡?쒕┰?덈떎.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RateLimitExample() {
  const [email, setEmail] = useState('ssafer@example.com');

  return (
    <div className="min-h-screen bg-[#f4f4f4] p-10">
      <div className="mx-auto max-w-[560px]">
        <div>
          <AuthPanelHeading subtitle="Member" title="New" />

          <div className="mt-[clamp(2rem,5.6vh,3.5rem)] space-y-[clamp(0.875rem,2vh,1.25rem)]">
            <AuthField
              autoComplete="email"
              errorMessage="?몄쬆 踰덊샇 ?붿껌???덈Т 留롮뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??"
              label="EMAIL ADDRESS"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
              placeholder="Email Address"
              value={email}
            />
          </div>

          <div className="mt-[clamp(2.5rem,6vh,4.25rem)] space-y-[clamp(0.875rem,2vh,1.25rem)]">
            <AuthButton type="button">Continue</AuthButton>
            <p className="auth-body-text text-black">
              ?낅젰???대찓?쇰줈 ?뚯썝媛???몄쬆 肄붾뱶瑜?蹂대궡?쒕┰?덈떎.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
          '?뚯썝媛??泥??④퀎 ?⑤꼸?낅땲?? ?대찓?쇱쓣 ?낅젰諛쏄퀬 ?몄쬆 肄붾뱶 諛쒖넚???쒖옉?⑸땲?? ?대? 媛?낅맂 ?대찓?쇱씠???붿껌 ?쒗븳 媛숈? ?ㅽ뙣 ?곹깭??紐⑤몢 ?대찓???낅젰 ?꾨옒 ?몃씪?몄쑝濡??듭씪?⑸땲??',
      },
    },
  },
} satisfies Meta<typeof SignupEmailPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <DefaultSignupEmailExample />,
  parameters: {
    docs: {
      description: {
        story: '湲곕낯 ?뚯썝媛??泥??붾㈃?낅땲?? ?ъ슜?먭? ?대찓?쇱쓣 ?낅젰?섍퀬 ?몄쬆???쒖옉?섎뒗 ?④퀎?낅땲??',
      },
    },
  },
};

export const WithExistingEmailError: Story = {
  render: () => <ExistingEmailExample />,
  parameters: {
    docs: {
      description: {
        story: '`?대? 媛?낅맂 ?대찓?쇱엯?덈떎.`瑜??몃씪?몄쑝濡?蹂댁뿬二쇰뒗 ?곹깭?낅땲??',
      },
    },
  },
};

export const WithRateLimitError: Story = {
  render: () => <RateLimitExample />,
  parameters: {
    docs: {
      description: {
        story: '`?몄쬆 踰덊샇 ?붿껌???덈Т 留롮뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??`瑜??몃씪?몄쑝濡?蹂댁뿬二쇰뒗 ?곹깭?낅땲??',
      },
    },
  },
};
