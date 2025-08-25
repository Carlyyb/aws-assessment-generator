import React, { useState } from 'react';
import { getCurrentUser, AuthUser } from 'aws-amplify/auth';
import { ThemeProvider } from './contexts/ThemeContext';
import { BreadcrumbProvider } from './contexts/breadcrumbs';
import { ErrorBoundary } from './components/ErrorBoundary';
import CustomAuthenticator from './components/CustomAuthenticator';
import { fetchAuthSession } from 'aws-amplify/auth';
import { UserProfile } from './contexts/userProfile';
import { App } from './App'; // 导入原有的App组件
import PasswordReset from './pages/PasswordReset';
//import type { WithAuthenticatorProps } from '@aws-amplify/ui-react';

export const AppWithAuth: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  // 检查用户认证状态
  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          
          // 获取用户会话信息
          const session = await fetchAuthSession();
          const cognitoGroups = (session.tokens?.idToken?.payload as Record<string, unknown>)['cognito:groups'];
          const userGroup = Array.isArray(cognitoGroups) && cognitoGroups.length > 0 
            ? cognitoGroups[0] 
            : 'students'; // 默认为学生组
          
          setUserProfile({
            ...currentUser,
            group: userGroup,
            email: session.tokens?.idToken?.payload.email,
            name: session.tokens?.idToken?.payload.preferred_username || session.tokens?.idToken?.payload.name,
          } as UserProfile);
        }
      } catch (error) {
        console.log('用户未登录');
        setUser(null);
        setUserProfile(undefined);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleSignOut = async () => {
    try {
      const { signOut } = await import('aws-amplify/auth');
      await signOut();
      setUser(null);
      setUserProfile(undefined);
      // 刷新页面以清除状态
      window.location.reload();
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  const handleLoginSuccess = async (authenticatedUser: AuthUser) => {
    console.log('登录成功，用户信息:', authenticatedUser);
    
    try {
      // 获取用户会话信息
      const session = await fetchAuthSession();
      const cognitoGroups = (session.tokens?.idToken?.payload as Record<string, unknown>)['cognito:groups'];
      const userGroup = Array.isArray(cognitoGroups) && cognitoGroups.length > 0 
        ? cognitoGroups[0] 
        : 'students'; // 默认为学生组
      
      const profile = {
        ...authenticatedUser,
        group: userGroup,
        email: session.tokens?.idToken?.payload.email,
        name: session.tokens?.idToken?.payload.preferred_username || session.tokens?.idToken?.payload.name,
      } as UserProfile;
      
      console.log('设置用户配置:', profile);
      setUser(authenticatedUser);
      setUserProfile(profile);
      
    } catch (error) {
      console.error('获取用户会话失败:', error);
      // 即使获取会话失败，也要设置基本用户信息
      const fallbackProfile = {
        ...authenticatedUser,
        group: 'students',
        email: authenticatedUser.signInDetails?.loginId || '',
        name: authenticatedUser.username || '',
      } as UserProfile;
      
      setUser(authenticatedUser);
      setUserProfile(fallbackProfile);
    }
  };

  // 检查当前路径是否是密码重置页面
  const isPasswordResetPage = window.location.pathname === '/reset-password';
  
  // 如果是密码重置页面，直接渲染不需要认证
  if (isPasswordResetPage) {
    return (
      <ThemeProvider userProfile={undefined}>
        <BreadcrumbProvider>
          <PasswordReset />
        </BreadcrumbProvider>
      </ThemeProvider>
    );
  }

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ color: 'white', fontSize: '18px' }}>加载中...</div>
      </div>
    );
  }

  // 如果用户未登录，显示自定义登录界面
  if (!user || !userProfile) {
    return <CustomAuthenticator onSuccess={handleLoginSuccess} />;
  }

  // 如果用户已登录，显示主应用程序
  const appProps = {
    signOut: handleSignOut,
    user: user
  };

  return (
    <ThemeProvider userProfile={userProfile}>
      <BreadcrumbProvider>
        <ErrorBoundary>
          <App {...appProps} />
        </ErrorBoundary>
      </BreadcrumbProvider>
    </ThemeProvider>
  );
};

export default AppWithAuth;
