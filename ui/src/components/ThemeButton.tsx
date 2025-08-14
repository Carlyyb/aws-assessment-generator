import React from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPalette } from '@tabler/icons-react';
import { ThemeCustomizer } from './ThemeCustomizer';
import { getText } from '../i18n/lang';

export const ThemeButton: React.FC = () => {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Tooltip label={getText('theme.title')}>
        <ActionIcon
          variant="outline"
          size="lg"
          onClick={open}
          style={{
            backgroundColor: 'var(--primary-color)',
            color: 'white',
            borderColor: 'var(--primary-color)',
          }}
        >
          <IconPalette size={18} />
        </ActionIcon>
      </Tooltip>
      
      <ThemeCustomizer opened={opened} onClose={close} />
    </>
  );
};
