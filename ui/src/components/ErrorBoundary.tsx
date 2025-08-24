import React, { Component, ReactNode } from 'react';
import { Alert, Box, Button, SpaceBetween } from '@cloudscape-design/components';
import { getText } from '../i18n/lang';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * 错误边界组件，用于捕获路由和其他React错误
 * 当捕获到错误时，自动重定向到首页
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 记录错误信息
    console.warn('ErrorBoundary caught an error:', error, errorInfo);
    
    // 如果是导航相关错误，自动重定向到首页
    if (error.message.includes('404') || error.message.includes('Not Found') || 
        window.location.pathname !== '/' && !this.isValidRoute(window.location.pathname)) {
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    }
  }

  // 检查路由是否有效
  private isValidRoute(pathname: string): boolean {
    // 定义有效的路由模式
    const validRoutes = [
      '/',
      '/assessments',
      '/assessments/find-assessments',
      '/assessments/create-assessments',
      '/edit-assessment/',
      '/assessment-results/',
      '/students',
      '/students/take-assessments',
      '/students/view-results',
      '/knowledge-base',
      '/knowledge-base/manage-knowledge-base',
      '/admin',
      '/admin/user-management',
      '/admin/system-settings'
    ];

    // 检查是否匹配任何有效路由
    return validRoutes.some(route => {
      if (route.endsWith('/')) {
        return pathname.startsWith(route);
      }
      return pathname === route || pathname.startsWith(route + '/');
    });
  }

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误UI
      return (
        <Box padding="l">
          <SpaceBetween size="m">
            <Alert type="error" header={getText('common.error.title')}>
              <p>{getText('common.error.description')}</p>
              <p>{getText('common.error.redirect')}</p>
            </Alert>
            <Button 
              variant="primary" 
              onClick={() => window.location.href = '/'}
            >
              {getText('common.error.goHome')}
            </Button>
          </SpaceBetween>
        </Box>
      );
    }

    return this.props.children;
  }
}
