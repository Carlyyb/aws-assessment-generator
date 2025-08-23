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
import './styles/logo.css';
import { I18nProvider } from '@cloudscape-design/components/i18n';
import messages from '@cloudscape-design/components/i18n/messages/all.en';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import type { WithAuthenticatorProps } from '@aws-amplify/ui-react';
import { withAuthenticator } from '@aws-amplify/ui-react';
import { routes as routesList } from './routes';
import PasswordReset from './pages/PasswordReset';
import { getText } from './i18n/lang';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ThemeButton } from './components/ThemeButton';
import { AlertType, DispatchAlertContext } from './contexts/alerts';
import { UserProfile, UserProfileContext } from './contexts/userProfile';
import { RoutesContext } from './contexts/routes';
import { BreadcrumbProvider, useBreadcrumb } from './contexts/breadcrumbs';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { generateBreadcrumbs } from './utils/breadcrumbs';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Notifications } from '@mantine/notifications';
import { useAdminPermissions } from './utils/adminPermissions';
import { getAdminLevelDisplayName } from './utils/adminDisplayUtils';
import { AuthMonitor } from './components/AuthMonitor';
import PasswordChangeMonitor from './components/PasswordChangeMonitor';

const LOCALE = 'zh';

interface AppContentProps {
  userProfile: UserProfile;
  signOut?: () => void;
}

function AppContent({ userProfile, signOut }: AppContentProps) {
  const [alerts, setAlerts] = useState<FlashbarProps.MessageDefinition[]>([]);
  const [activeHref, setActiveHref] = useState(window.location.pathname);
  const { currentTheme, globalLogo } = useTheme();
  const { adminInfo, error: adminError } = useAdminPermissions();
  const { getOverride } = useBreadcrumb();

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
                style={{
                  '--theme-primary-color': currentTheme.primaryColor,
                  '--theme-secondary-color': currentTheme.secondaryColor,
                  '--theme-background-color': currentTheme.backgroundColor,
                  '--theme-text-color': currentTheme.textColor,
                } as React.CSSProperties}
                data-theme={currentTheme.id === 'dark' ? 'dark' : 'light'}
                className="cloudscape-modern-theme"
              >
                <div id="h" style={{ position: 'relative' }} data-has-logo={globalLogo ? 'true' : 'false'}>
                  <TopNavigation
                    identity={{
                      href: '#',
                      title: '', // 删除标题文字，为logo留出空间
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
                  {/* 自定义Logo显示区域 */}
                  {(() => {
                    console.log('🔍 Logo Debug Info:', {
                      hasGlobalLogo: !!globalLogo,
                      globalLogoLength: globalLogo?.length,
                      globalLogoPreview: globalLogo?.substring(0, 50) + '...',
                      logoType: globalLogo?.startsWith('data:') ? 'base64' : 'url'
                    });
                    return null;
                  })()}
                  {globalLogo ? (
                    <div className="custom-logo-container">
                      <img 
                        src={globalLogo} 
                        alt={getText('common.brand')} 
                        className="custom-logo"
                        onLoad={() => console.log('✅ Logo loaded successfully')}
                        onError={(e) => console.error('❌ Logo failed to load:', e)}
                        style={{ 
                          border: '2px solid red', // 临时边框用于调试定位
                          backgroundColor: 'yellow' // 临时背景色用于调试
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ 
                      position: 'absolute', 
                      left: '16px', 
                      top: '10px', 
                      color: 'red', 
                      fontSize: '12px' 
                    }}>
                      No Logo
                    </div>
                  )}
                </div>
                <AppLayout
                headerSelector="#h"
                breadcrumbs={
                  <BreadcrumbGroup
                    items={generateBreadcrumbs(activeHref, getOverride)}
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
                  <HelpPanel header={<h2>{getText('common.help.overview')}</h2>}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                      <ThemeButton />
                    </div>
                    {getText('common.help.content')}
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
        const cognitoGroups = (session.tokens?.idToken?.payload as any)['cognito:groups'];
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
        <AppContent userProfile={userProfile} signOut={signOut} />
      </BreadcrumbProvider>
    </ThemeProvider>
  );
}

const AuthenticatedApp = withAuthenticator(App, {
  // 移除自注册功能
  hideSignUp: true,
  // 移除自注册属性配置
  formFields: {
    signIn: {
      username: {
        placeholder: '用户名或邮箱',
        label: '用户名:',
        isRequired: true
      },
      password: {
        placeholder: '密码',
        label: '密码:',
        isRequired: true
      }
    }
  },
  components: {
    Header: function AuthHeader() {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h1 style={{ color: '#0833b3ff', margin: 0 }}>Gen Assess</h1>
          <p style={{ color: '#024cd7e6', margin: '10px 0 0 0' }}>智能测试系统 / Intelligent Assessment System</p>
          <LanguageSwitcher />
        </div>
      );
    },
    SignIn: {
      Footer: function SignInFooter() {
        return (
          <div style={{ textAlign: 'center', marginTop: '20px', color: '#666' }}>
            <p>请使用管理员分配的账号登录</p>
            <p>如需账号请联系系统管理员</p>
            <p>
              <a 
                href="/reset-password" 
                style={{ color: '#0972d3', textDecoration: 'none' }}
                onMouseOver={(e) => (e.target as HTMLElement).style.textDecoration = 'underline'}
                onMouseOut={(e) => (e.target as HTMLElement).style.textDecoration = 'none'}
              >
                忘记密码？
              </a>
            </p>
          </div>
        );
      }
    }
  }
});

export default AuthenticatedApp;
