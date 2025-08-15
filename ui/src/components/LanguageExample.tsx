import React from 'react';
import { 
  Container, 
  Header, 
  SpaceBetween, 
  Box, 
  Button,
  StatusIndicator,
  Alert
} from '@cloudscape-design/components';
import { getText } from '../i18n/lang';

/**
 * 多语言使用示例组件
 * 展示如何在新组件中正确使用 getText 函数
 */
export const LanguageExample: React.FC = () => {
  
  // 基础用法：直接获取翻译文本
  const pageTitle = getText('teachers.settings.courses.dashboard.title');
  
  // 带有动态内容的翻译（使用字符串替换）
  const getSuccessMessage = (fileName: string) => {
    return getText('teachers.settings.knowledge_base_manager.upload.success')
      .replace('{count}', '1')
      .replace('{fileName}', fileName);
  };

  // 条件翻译
  const getStatusMessage = (isSuccess: boolean) => {
    return isSuccess 
      ? getText('common.status.success')
      : getText('common.status.failed');
  };

  // 状态指示器的多语言支持
  const getKnowledgeBaseStatus = (status: 'available' | 'missing' | 'loading') => {
    const statusMap = {
      available: {
        type: 'success' as const,
        text: getText('teachers.settings.knowledge_base_manager.status.available')
      },
      missing: {
        type: 'stopped' as const,
        text: getText('teachers.settings.knowledge_base_manager.status.missing')
      },
      loading: {
        type: 'loading' as const,
        text: getText('teachers.settings.knowledge_base_manager.status.checking')
      }
    };

    const config = statusMap[status];
    return <StatusIndicator type={config.type}>{config.text}</StatusIndicator>;
  };

  return (
    <Container header={<Header variant="h2">{pageTitle}</Header>}>
      <SpaceBetween size="l">
        
        {/* 基础翻译示例 */}
        <Box>
          <Header variant="h3">{getText('common.labels.description')}</Header>
          <p>{getText('teachers.settings.knowledge_base_manager.upload.description')}</p>
        </Box>

        {/* 动态内容示例 */}
        <Alert type="success">
          {getSuccessMessage('document.pdf')}
        </Alert>

        {/* 状态指示器示例 */}
        <SpaceBetween direction="horizontal" size="s">
          {getKnowledgeBaseStatus('available')}
          {getKnowledgeBaseStatus('missing')}
          {getKnowledgeBaseStatus('loading')}
        </SpaceBetween>

        {/* 按钮翻译示例 */}
        <SpaceBetween direction="horizontal" size="s">
          <Button variant="primary">
            {getText('teachers.settings.courses.dashboard.create_assessment')}
          </Button>
          <Button variant="normal">
            {getText('teachers.settings.courses.manage_knowledge_base')}
          </Button>
          <Button variant="link">
            {getText('common.actions.cancel')}
          </Button>
        </SpaceBetween>

        {/* 表格列头示例 */}
        <Box>
          <Header variant="h3">{getText('teachers.settings.courses.dashboard.course_list')}</Header>
          <ul>
            <li>{getText('teachers.settings.courses.dashboard.course_name')}</li>
            <li>{getText('teachers.settings.courses.dashboard.knowledge_base_status')}</li>
            <li>{getText('teachers.settings.courses.dashboard.last_activity')}</li>
            <li>{getText('teachers.settings.courses.dashboard.actions')}</li>
          </ul>
        </Box>

        {/* 条件消息示例 */}
        <Alert type="info">
          {getStatusMessage(true)}
        </Alert>
        <Alert type="error">
          {getStatusMessage(false)}
        </Alert>

      </SpaceBetween>
    </Container>
  );
};

export default LanguageExample;
