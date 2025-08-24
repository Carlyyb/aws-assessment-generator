import React from 'react';
import {
  ContentLayout,
  Header,
  SpaceBetween,
  Box,
  Button,
  ColumnLayout,
  ProgressBar,
  Badge,
  Alert,
} from '@cloudscape-design/components';
import { useTheme } from '../contexts/ThemeContext';

const ThemeDemo: React.FC = () => {
  const { currentTheme, availableThemes } = useTheme();

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="展示当前主题在各种组件中的应用效果"
        >
          主题演示
        </Header>
      }
    >
      <SpaceBetween size="l">
        <Alert
          statusIconAriaLabel="信息"
          header="当前主题信息"
        >
          正在使用主题: <strong>{currentTheme.name}</strong>
        </Alert>

        <ColumnLayout columns={3}>
          <Box>
            <Header variant="h3">主色演示</Header>
            <SpaceBetween size="m">
              <div
                style={{
                  width: '100%',
                  height: '60px',
                  backgroundColor: currentTheme.colors['color-background-button-primary-default'],
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold'
                }}
              >
                主要颜色
              </div>
              <Box variant="small">{currentTheme.colors['color-background-button-primary-default']}</Box>
            </SpaceBetween>
          </Box>

          <Box>
            <Header variant="h3">次色演示</Header>
            <SpaceBetween size="m">
              <div
                style={{
                  width: '100%',
                  height: '60px',
                  backgroundColor: currentTheme.colors['color-text-button-normal-default'],
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold'
                }}
              >
                次要颜色
              </div>
              <Box variant="small">{currentTheme.colors['color-text-button-normal-default']}</Box>
            </SpaceBetween>
          </Box>

          <Box>
            <Header variant="h3">背景色演示</Header>
            <SpaceBetween size="m">
              <div
                style={{
                  width: '100%',
                  height: '60px',
                  backgroundColor: currentTheme.colors['color-background-body-content'],
                  border: '2px solid ' + currentTheme.colors['color-border-divider-default'],
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: currentTheme.colors['color-text-body-default'],
                  fontWeight: 'bold'
                }}
              >
                背景颜色
              </div>
              <Box variant="small">{currentTheme.colors['color-background-body-content']}</Box>
            </SpaceBetween>
          </Box>
        </ColumnLayout>

        <Box>
          <Header variant="h2">按钮演示</Header>
          <SpaceBetween direction="horizontal" size="s">
            <Button variant="primary">主要按钮</Button>
            <Button>普通按钮</Button>
            <Button variant="link">链接按钮</Button>
          </SpaceBetween>
        </Box>

        <Box>
          <Header variant="h2">状态徽章演示</Header>
          <SpaceBetween direction="horizontal" size="s">
            <Badge color="green">成功</Badge>
            <Badge color="blue">进行中</Badge>
            <Badge color="red">错误</Badge>
            <Badge color="grey">待处理</Badge>
          </SpaceBetween>
        </Box>

        <Box>
          <Header variant="h2">进度条演示</Header>
          <SpaceBetween size="m">
            <ProgressBar value={85} additionalInfo="85%" description="任务进度" />
            <ProgressBar value={60} additionalInfo="60%" description="上传进度" />
            <ProgressBar value={25} additionalInfo="25%" description="处理进度" />
          </SpaceBetween>
        </Box>

        <Box>
          <Header variant="h2">可用主题</Header>
          <ColumnLayout columns={4}>
            {availableThemes.map(theme => (
              <Box key={theme.id} padding="s">
                <SpaceBetween size="xs">
                  <div
                    style={{
                      width: '100%',
                      height: '40px',
                      backgroundColor: theme.colors['color-background-button-primary-default'],
                      borderRadius: '4px',
                      border: theme.id === currentTheme.id ? `3px solid ${theme.colors['color-border-item-focused']}` : 'none'
                    }}
                  />
                  <Box variant="small" textAlign="center">
                    {theme.name}
                    {theme.id === currentTheme.id && <div style={{ color: '#037f0c', fontSize: '12px' }}>当前</div>}
                  </Box>
                </SpaceBetween>
              </Box>
            ))}
          </ColumnLayout>
        </Box>
      </SpaceBetween>
    </ContentLayout>
  );
};

export default ThemeDemo;
