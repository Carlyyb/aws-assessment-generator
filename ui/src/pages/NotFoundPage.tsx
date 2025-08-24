import { useEffect } from 'react';
import { Box, Button, Container, Header, SpaceBetween } from '@cloudscape-design/components';
import { getText } from '../i18n/lang';
import { useNavigate } from 'react-router-dom';

/**
 * 404错误页面组件
 * 当用户访问不存在的路由时显示，并提供返回首页的选项
 */
export function NotFoundPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // 5秒后自动重定向到首页
    const timer = setTimeout(() => {
      navigate('/');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <Container>
      <SpaceBetween size="l">
        <Header variant="h1">404 - {getText('common.error.title')}</Header>
        
        <Box textAlign="center" padding="xl">
          <SpaceBetween size="m">
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚫</div>
            
            <p style={{ fontSize: '1.2rem', color: '#5f6b7a' }}>
              {getText('common.error.description')}
            </p>
            
            <p style={{ color: '#879596' }}>
              {getText('common.error.redirect')}
            </p>
            
            <Button 
              variant="primary" 
              onClick={() => navigate('/')}
            >
              {getText('common.error.goHome')}
            </Button>
          </SpaceBetween>
        </Box>
      </SpaceBetween>
    </Container>
  );
}
