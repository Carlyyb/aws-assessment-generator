import { useEffect, useState } from 'react';
import {
  AppLayout,
  BreadcrumbGroup,
  Flashbar,
  FlashbarProps,
  HelpPanel,
  SideNavigation,
  TopNavigation,
} from '@cloudscape-design/components';
import '@cloudscape-design/global-styles/index.css';
import './styles/high-contrast.css';
import './styles/cross-browser.css';
import './styles/theme.css';
import './styles/top-navigation.css';
import { I18nProvider } from '@cloudscape-design/components/i18n';
import messages from '@cloudscape-design/components/i18n/messages/all.en';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import type { WithAuthenticatorProps } from '@aws-amplify/ui-react';
import { AuthUser } from 'aws-amplify/auth';
import { routes as routesList } from './routes';
import PasswordReset from './pages/PasswordReset';
import { getText } from './i18n/lang';
import { ThemeButton } from './components/ThemeButton';
import { AlertType, DispatchAlertContext } from './contexts/alerts';
import { UserProfile, UserProfileContext } from './contexts/userProfile';
import { RoutesContext } from './contexts/routes';
import { BreadcrumbProvider, useBreadcrumb } from './contexts/breadcrumbs';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { generateBreadcrumbs } from './utils/breadcrumbs';
import { ErrorBoundary } from './components/ErrorBoundary';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Notifications } from '@mantine/notifications';
import { useAdminPermissions } from './utils/adminPermissions';
import { getAdminLevelDisplayName } from './utils/adminDisplayUtils';
import { AuthMonitor } from './components/AuthMonitor';
import PasswordChangeMonitor from './components/PasswordChangeMonitor';
import { useUserActivityTracker } from './hooks/useUserActivityTracker';
import AppWithAuth from './AppWithAuth';

const LOCALE = 'zh';

interface AppContentProps {
  userProfile: UserProfile;
  user?: AuthUser; // 修复类型
  signOut?: () => void;
}

function AppContent({ userProfile, user, signOut }: AppContentProps) {
  const [alerts, setAlerts] = useState<FlashbarProps.MessageDefinition[]>([]);
  const [activeHref, setActiveHref] = useState(window.location.pathname);
  const { currentTheme, globalLogo } = useTheme();
  const { adminInfo, error: adminError } = useAdminPermissions();
  const { getOverride } = useBreadcrumb();
  
  // 启用用户活跃度跟踪
  useUserActivityTracker(user);

  // 检查路由是否有效
  const isValidRoute = (pathname: string): boolean => {
    // 定义有效的路由模式
    const validRoutes = [
      '/assessment',
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
  };

  // Debug logging for admin permissions
  useEffect(() => {
    if (adminError) {
      console.error('管理员权限检查错误');
    }
  }, [adminInfo, adminError]);

  const dispatchAlert = (newAlert: FlashbarProps.MessageDefinition) => {
    const id = Date.now().toString();
    
    // 创建新的 alert 对象
    const alert: FlashbarProps.MessageDefinition = {
      content: newAlert.type === AlertType.SUCCESS ? getText('common.status.success') : getText('common.status.failed'),
      ...newAlert,
      id,
      dismissible: true,
      onDismiss: () => setAlerts((currentAlerts: FlashbarProps.MessageDefinition[]) => 
        currentAlerts.filter((alert: FlashbarProps.MessageDefinition) => alert.id !== id)
      ),
    };

    // 添加新的 alert
    setAlerts((currentAlerts: FlashbarProps.MessageDefinition[]) => [...currentAlerts, alert]);

    // 30 秒后自动移除
    setTimeout(() => {
      setAlerts((currentAlerts: FlashbarProps.MessageDefinition[]) => 
        currentAlerts.filter((alert: FlashbarProps.MessageDefinition) => alert.id !== id)
      );
    }, 30000);
  };

  const routes = (routesList as any)[userProfile.group];
  
  // 确保routes存在，如果不存在则使用默认路由或显示错误
  let finalRoutes = routes;
  if (!routes || !Array.isArray(routes) || routes.length === 0) {
    console.error(`没有找到用户组 "${userProfile.group}" 的路由配置`);
    // 根据用户组提供默认路由
    finalRoutes = userProfile.group === 'students' 
      ? (routesList as any).students
      : (routesList as any).teachers;
    
    if (!finalRoutes) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>路由配置错误</h2>
          <p>用户组: {userProfile.group}</p>
          <p>请联系系统管理员</p>
        </div>
      );
    }
  }
  
  const router = createBrowserRouter(finalRoutes);
  const [sideNavRoutes] = finalRoutes;

  router.subscribe(({ location }) => setActiveHref(location.pathname));

  // 构建用户显示文本
  const getUserDisplayText = () => {
    const roleText = `${getText(`common.role.${userProfile?.group}`)}: ${userProfile?.name}`;
    
    // 只使用后端权限信息
    const adminLevelText = adminInfo?.isAdmin 
      ? ` (${getAdminLevelDisplayName(adminInfo.highestRole)})`
      : '';
    
    return roleText + adminLevelText;
  };

  // 构建用户描述文本
  const getUserDescription = () => {
    const baseDescription = `${getText('common.profile')}: ${getText(`common.role.${userProfile?.group}`)}`;
    
    // 只使用后端权限信息
    if (adminInfo?.isAdmin) {
      const adminLevel = getAdminLevelDisplayName(adminInfo.highestRole);
      return `${baseDescription} | ${getText('common.admin.permission_level')}: ${adminLevel}`;
    }
    
    return baseDescription;
  };

  return (
    <DispatchAlertContext.Provider value={dispatchAlert}>
      <AuthMonitor>
        <PasswordChangeMonitor>
          <UserProfileContext.Provider value={userProfile}>
            <RoutesContext.Provider value={routes}>
            <I18nProvider locale={LOCALE} messages={[messages]}>
              <Notifications />
              {/* 应用现代化Cloudscape主题样式到整个应用框架 */}
              <div 
                style={
                  Object.entries(currentTheme.colors || {}).reduce((acc: Record<string, string>, [token, value]) => {
                    acc[`--${token}`] = value;
                    return acc;
                  }, {})
                }
                data-theme={currentTheme.id}
                className="cloudscape-modern-theme"
              >
                <div id="h" style={{ 
                  position: 'relative',
                  zIndex: 1000,
                  backgroundColor: 'var(--color-background-top-navigation, #232f3e)',
                  borderBottom: '1px solid var(--color-border-divider-default, #e9ebed)'
                }} className="top-navigation-black-text">
                  <TopNavigation
                    identity={{
                      href: '#',
                      title: getText('common.brand'),
                      // 使用Cloudscape推荐的logo属性
                      logo: globalLogo ? { 
                        src: globalLogo, 
                        alt: getText('common.brand') 
                      } : undefined,
                    }}
                    utilities={[
                      {
                        type: 'menu-dropdown',
                        text: getUserDisplayText(),
                        description: getUserDescription(),
                        iconName: 'user-profile',
                        items: [{ id: 'signout', text: getText('common.action.sign_out') }],
                        onItemClick: ({ detail }) => {
                          if (detail.id === 'signout') signOut && signOut();
                        },
                      },
                    ]}
                  />
                </div>
                <AppLayout
                headerSelector="#h"
                // 应用主题色到AppLayout
                contentType="default"
                splitPanelOpen={false}
                breadcrumbs={
                  <BreadcrumbGroup
                    items={generateBreadcrumbs(activeHref, getOverride)}
                    onFollow={(e) => {
                      e.preventDefault();
                      // 验证路径是否有效
                      const targetPath = e.detail.href;
                      if (targetPath && isValidRoute(targetPath)) {
                        router.navigate(targetPath);
                      } else {
                        // 如果路径无效，重定向到首页
                        console.warn('Invalid breadcrumb path:', targetPath, 'redirecting to home');
                        router.navigate('/');
                      }
                    }}
                  />
                }
                navigationOpen={true}
                navigation={
                  <SideNavigation
                    activeHref={activeHref}
                    header={{
                      href: '/',
                      text: getText('common.brand'),
                    }}
                    onFollow={(e) => {
                      e.preventDefault();
                      router.navigate(e.detail.href);
                    }}
                    items={sideNavRoutes.children?.map(({ path, children }: any) => {
                      if (children && children.length > 0) {
                        return {
                          type: 'expandable-link-group',
                          text: getText(`common.nav.${path}`),
                          href: `/${path}`,
                          items: children.map(({ path: childPath }: any) => ({
                            type: 'link',
                            text: getText(`common.nav.${childPath}`),
                            href: `/${path}/${childPath}`,
                          })),
                        };
                      } else {
                        return { type: 'link', text: getText(`common.nav.${path}`), href: `/${path}` };
                      }
                    }) || []}
                  />
                }
                notifications={<Flashbar items={alerts}/>}
                toolsOpen={false}
                tools={
                  <HelpPanel 
                    header={<h2>{getText('common.help.overview')}</h2>}
                    footer={
                      <div style={{ 
                        padding: '12px 0', 
                        borderTop: '1px solid var(--border-color)',
                        marginTop: '16px' 
                      }}>
                        <small style={{ color: 'var(--text-secondary)' }}>
                          {getText('common.brand')} v1.0
                        </small>
                      </div>
                    }
                  >
                    <div style={{ 
                      display: 'flex', 
                      gap: '10px', 
                      marginBottom: '16px',
                      padding: '12px',
                      backgroundColor: 'var(--surface-color)',
                      borderRadius: 'var(--border-radius-medium)',
                      border: '1px solid var(--border-color)'
                    }}>
                      <ThemeButton />
                    </div>
                    <div style={{ 
                      color: 'var(--text-primary)',
                      lineHeight: '1.5'
                    }}>
                      {getText('common.help.content')}
                    </div>
                  </HelpPanel>
                }
                content={<RouterProvider router={router}/>}
                />
              </div>
          </I18nProvider>
        </RoutesContext.Provider>
      </UserProfileContext.Provider>
      </PasswordChangeMonitor>
      </AuthMonitor>
    </DispatchAlertContext.Provider>
  );
}

export function App({ signOut, user }: WithAuthenticatorProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | undefined>();

  useEffect(() => {
    fetchAuthSession()
      .then((session) => {
        const cognitoGroups = (session.tokens?.idToken?.payload as Record<string, unknown>)['cognito:groups'];
        const userGroup = Array.isArray(cognitoGroups) && cognitoGroups.length > 0 
          ? cognitoGroups[0] 
          : 'students'; // 默认为学生组
        
        setUserProfile({
          ...user,
          group: userGroup,
          email: session.tokens?.idToken?.payload.email,
          name: session.tokens?.idToken?.payload.preferred_username || session.tokens?.idToken?.payload.name,
        } as UserProfile);
      })
      .catch((error) => {
        console.error('Failed to fetch auth session:', error);
        // 设置默认用户配置
        setUserProfile({
          ...user,
          group: 'students',
          email: user?.signInDetails?.loginId || '',
          name: user?.username || '',
        } as UserProfile);
      });
  }, [user]);

  // 检查当前路径是否是密码重置页面
  const isPasswordResetPage = window.location.pathname === '/reset-password';
  
  // 如果是密码重置页面，直接渲染不需要认证
  if (isPasswordResetPage) {
    return (
      <ThemeProvider userProfile={undefined}> {/* 修复类型错误 */}
        <BreadcrumbProvider>
          <PasswordReset />
        </BreadcrumbProvider>
      </ThemeProvider>
    );
  }

  if (!userProfile?.group) return null;

  return (
    <ThemeProvider userProfile={userProfile}>
      <BreadcrumbProvider>
        <ErrorBoundary>
          <AppContent userProfile={userProfile} user={user} signOut={signOut} />
        </ErrorBoundary>
      </BreadcrumbProvider>
    </ThemeProvider>
  );
}

export default AppWithAuth;
