import React, { useState, useEffect } from 'react';
import {
  SpaceBetween,
  Button,
  FormField,
  Input,
  Alert,
  Header,
  Grid,
  ContentLayout,
  Cards,
  Icon
} from '@cloudscape-design/components';
import { signIn, SignInInput, getCurrentUser, AuthUser } from 'aws-amplify/auth';
import { LanguageSwitcher } from './LanguageSwitcher';
import '../styles/login.css';

interface CustomAuthenticatorProps {
  onSuccess: (user: AuthUser) => void;
}

interface LoginFormData {
  username: string;
  password: string;
}

export const CustomAuthenticator: React.FC<CustomAuthenticatorProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // 设置页面背景为深蓝色
  useEffect(() => {
    const originalBodyStyle = document.body.style.background;
    const originalHtmlStyle = document.documentElement.style.background;
    
    document.body.style.background = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
    document.documentElement.style.background = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
    
    return () => {
      document.body.style.background = originalBodyStyle;
      document.documentElement.style.background = originalHtmlStyle;
    };
  }, []);

  // 检查是否已登录
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          onSuccess(user);
        }
      } catch (err) {
        // 用户未登录，继续显示登录界面
      }
    };
    checkAuth();
  }, [onSuccess]);

  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // 清除错误信息
    if (error) setError('');
  };

  const handleLogin = async () => {
    if (!formData.username || !formData.password) {
      setError('请填写用户名和密码');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const signInInput: SignInInput = {
        username: formData.username,
        password: formData.password
      };

      const { isSignedIn } = await signIn(signInInput);
      
      if (isSignedIn) {
        const user = await getCurrentUser();
        onSuccess(user);
      } else {
        // 处理需要额外步骤的情况
        setError('登录需要额外验证，请联系管理员');
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      
      // 处理不同类型的错误
      const errorName = err instanceof Error && 'name' in err ? (err as Error & { name: string }).name : '';
      
      switch (errorName) {
        case 'NotAuthorizedException':
          setError('用户名或密码错误');
          break;
        case 'UserNotConfirmedException':
          setError('账户未激活，请联系管理员');
          break;
        case 'UserNotFoundException':
          setError('用户不存在');
          break;
        case 'TooManyRequestsException':
          setError('登录尝试次数过多，请稍后再试');
          break;
        default:
          setError('登录失败，请稍后重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: { detail: { key: string } }) => {
    if (event.detail.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="custom-login-container">
      <div style={{ 
        width: '100%', 
        maxWidth: '450px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <ContentLayout
          headerVariant="high-contrast"
          header={
            <div className="logo-container">
              {/* Logo区域 */}
              <div className="logo-icon">
                <Icon
                  name="settings"
                  size="large"
                  variant="normal"
                />
              </div>
              
              {/* 标题 */}
              <h1 className="app-title">Gen Assess</h1>
              <p className="app-subtitle">智能测试系统 / Intelligent Assessment System</p>
              
              {/* 语言切换器 */}
              <div className="language-switcher-container">
                <LanguageSwitcher />
              </div>
            </div>
          }
        >
          {/* 登录卡片 */}
          <div className="login-card">
            <SpaceBetween size="l">
              {/* 登录表单标题 */}
              <Header
                variant="h2"
                description="请使用管理员分配的账号登录系统"
              >
                用户登录
              </Header>

              {/* 错误提示 */}
              {error && (
                <div className="error-alert">
                  <Alert type="error" dismissible onDismiss={() => setError('')}>
                    {error}
                  </Alert>
                </div>
              )}

              {/* 登录表单 */}
              <SpaceBetween size="m">
                <FormField
                  label="用户名"
                  description="输入您的用户名或邮箱地址"
                >
                  <Input
                    placeholder="请输入用户名或邮箱"
                    value={formData.username}
                    onChange={({ detail }) => handleInputChange('username', detail.value)}
                    onKeyDown={handleKeyPress}
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </FormField>

                <FormField
                  label="密码"
                  description="输入您的登录密码"
                >
                  <Input
                    type="password"
                    placeholder="请输入密码"
                    value={formData.password}
                    onChange={({ detail }) => handleInputChange('password', detail.value)}
                    onKeyDown={handleKeyPress}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </FormField>
              </SpaceBetween>

              {/* 登录按钮 */}
              <Button
                variant="primary"
                onClick={handleLogin}
                loading={isLoading}
                fullWidth
                iconAlign="right"
                iconName="arrow-right"
              >
                {isLoading ? '登录中...' : '登录'}
              </Button>

              {/* 辅助信息 */}
              <div className="login-footer">
                <p>如需账号请联系系统管理员</p>
              </div>

              {/* 系统信息卡片 */}
              <div className="system-features">
                <Cards
                  cardDefinition={{
                    header: () => '系统特色',
                    sections: [
                      {
                        content: () => (
                          <Grid gridDefinition={[
                            { colspan: 4 },
                            { colspan: 4 },
                            { colspan: 4 }
                          ]}>
                            <div className="feature-item">
                              <div className="feature-icon">
                                <Icon name="status-positive" size="normal" />
                              </div>
                              <div className="feature-text">智能分析</div>
                            </div>
                            <div className="feature-item">
                              <div className="feature-icon">
                                <Icon name="security" size="normal" />
                              </div>
                              <div className="feature-text">安全可靠</div>
                            </div>
                            <div className="feature-item">
                              <div className="feature-icon">
                                <Icon name="settings" size="normal" />
                              </div>
                              <div className="feature-text">简单易用</div>
                            </div>
                          </Grid>
                        )
                      }
                    ]
                  }}
                  items={[{}]}
                  variant="container"
                />
              </div>
            </SpaceBetween>
          </div>
        </ContentLayout>
      </div>
    </div>
  );
};

export default CustomAuthenticator;
