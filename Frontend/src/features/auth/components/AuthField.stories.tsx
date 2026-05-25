import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ChangeEvent, ComponentProps } from 'react';
import { useState } from 'react';

import AuthField from './AuthField';

function InteractiveAuthField(args: ComponentProps<typeof AuthField>) {
  const [value, setValue] = useState('');

  return (
    <AuthField
      {...args}
      onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value)}
      value={value}
    />
  );
}

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
          '?몄쬆 ?붾㈃?먯꽌 ?ъ슜?섎뒗 湲곕낯 ?낅젰 而댄룷?뚰듃?낅땲?? `errorMessage`濡??몃씪???ㅻ쪟瑜? `helperText`濡?蹂댁“ ?ㅻ챸?? `trailing`?쇰줈 show 踰꾪듉?대굹 ?≪뀡 ?붿냼瑜?諛곗튂?⑸땲??',
      },
    },
  },
} satisfies Meta<typeof AuthField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args: ComponentProps<typeof AuthField>) => <InteractiveAuthField {...args} />,
  parameters: {
    docs: {
      description: {
        story: '湲곕낯 ?낅젰 ?곹깭?낅땲?? 媛???쇰컲?곸씤 ?띿뒪???낅젰 UI濡??ъ슜?⑸땲??',
      },
    },
  },
};

export const WithError: Story = {
  args: {
    errorMessage: '?대? 媛?낅맂 ?대찓?쇱엯?덈떎.',
    value: 'hello@example.com',
    onChange: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: '?ㅽ뙣 硫붿떆吏???좎뒪?멸? ?꾨땲???낅젰李?諛붾줈 ?꾨옒 ?몃씪?몄쑝濡??몄텧?섎뒗 ?⑦꽩???ъ슜?⑸땲??',
      },
    },
  },
};

export const WithHelper: Story = {
  args: {
    helperText: '?낅젰???대찓?쇰줈 ?몄쬆 肄붾뱶瑜?蹂대궡?쒕┰?덈떎.',
    value: '',
    onChange: () => {},
  },
  parameters: {
    docs: {
      description: {
        story: '?ъ슜?먭? ?ㅼ쓬 ?≪뀡???댄빐?댁빞 ????蹂댁“ 臾멸뎄瑜??④퍡 蹂댁뿬二쇰뒗 ?덉떆?낅땲??',
      },
    },
  },
};
