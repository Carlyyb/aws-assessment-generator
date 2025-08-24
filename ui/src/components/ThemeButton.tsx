import React from 'react';
import { Button } from '@cloudscape-design/components';

export const ThemeButton: React.FC = () => {
  return (
    <Button
      variant="normal"
      iconName="external"
      href="/user-settings"
    >
      {'主题设置'}
    </Button>
  );
};
