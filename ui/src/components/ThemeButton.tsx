import React from 'react';
import { Button } from '@cloudscape-design/components';
import { getText } from '../i18n/lang';

export const ThemeButton: React.FC = () => {
  return (
    <Button
      variant="normal"
      iconName="external"
      href="/user-settings"
    >
      {getText('theme.openSettings') || '主题设置'}
    </Button>
  );
};
