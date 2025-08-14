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
import './styles/high-contrast.css';
import './styles/cross-browser.css';
import './styles/theme.css';
import { I18nProvider } from '@cloudscape-design/components/i18n';
import messages from '@cloudscape-design/components/i18n/messages/all.en';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import type { WithAuthenticatorProps } from '@aws-amplify/ui-react';
import { withAuthenticator } from '@aws-amplify/ui-react';
import { routes as routesList } from './routes';
import { getText } from './i18n/lang';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ThemeButton } from './components/ThemeButton';
import { AlertType, DispatchAlertContext } from './contexts/alerts';
import { UserProfile, UserProfileContext } from './contexts/userProfile';
import { RoutesContext } from './contexts/routes';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { generateBreadcrumbs } from './utils/breadcrumbs';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Notifications } from '@mantine/notifications';

const LOCALE = 'en';

interface AppContentProps {
  userProfile: UserProfile;
  signOut?: () => void;
}

function AppContent({ userProfile, signOut }: AppContentProps) {
  const [alerts, setAlerts] = useState<FlashbarProps.MessageDefinition[]>([]);
  const [activeHref, setActiveHref] = useState(window.location.pathname);
  const { currentTheme } = useTheme();

  const dispatchAlert = (newAlert: FlashbarProps.MessageDefinition) => {
    const id = Date.now().toString();
    setAlerts([
      ...alerts,
      {
        content: newAlert.type === AlertType.SUCCESS ? getText('common.status.success') : getText('common.status.failed'),
        ...newAlert,
        id,
        dismissible: true,
        onDismiss: () => setAlerts((alerts) => alerts.filter((currentAlert) => currentAlert.id !== id)),
      },
    ]);
  };

  const routes = (routesList as any)[userProfile.group];
  const router = createBrowserRouter(routes);
  const [sideNavRoutes] = routes;

  router.subscribe(({ location }) => setActiveHref(location.pathname));

  return (
    <DispatchAlertContext.Provider value={dispatchAlert}>
      <UserProfileContext.Provider value={userProfile}>
        <RoutesContext.Provider value={routes}>
          <I18nProvider locale={LOCALE} messages={[messages]}>
            <Notifications />
            <div id="h">
              <TopNavigation
                identity={{
                  href: '#',
                  title: getText('common.brand'),
                }}
                utilities={[
                  {
                    type: 'button',
                    iconName: 'settings',
                    ariaLabel: getText('theme.title'),
                    onClick: () => {
                      // 这里会被 ThemeButton 组件接管
                    },
                  },
                  {
                    type: 'menu-dropdown',
                    text: `${getText(`common.role.${userProfile?.group}`)}: ${userProfile?.name}`,
                    description: `${getText('common.profile')}: ${getText(`common.role.${userProfile?.group}`)}`,
                    iconName: 'user-profile',
                    items: [{ id: 'signout', text: getText('common.action.sign_out') }],
                    onItemClick: ({ detail }) => {
                      if (detail.id === 'signout') signOut && signOut();
                    },
                  },
                ]}
              />
              {/* 自定义Logo显示区域 */}
              {currentTheme.logoUrl && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  left: '16px',
                  zIndex: 1000,
                }}>
                  <img 
                    src={currentTheme.logoUrl} 
                    alt={getText('common.brand')} 
                    className="app-logo"
                    style={{ maxHeight: '32px' }}
                  />
                </div>
              )}
            </div>
            <AppLayout
              headerSelector="#h"
              breadcrumbs={
                <BreadcrumbGroup
                  items={generateBreadcrumbs(activeHref)}
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
          </I18nProvider>
        </RoutesContext.Provider>
      </UserProfileContext.Provider>
    </DispatchAlertContext.Provider>
  );
}

export function App({ signOut, user }: WithAuthenticatorProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | undefined>();

  useEffect(() => {
    fetchAuthSession()
      .then((session) =>
        setUserProfile({
          ...user,
          group: (session.tokens?.idToken?.payload as any)['cognito:groups'][0],
          email: session.tokens?.idToken?.payload.email,
          name: session.tokens?.idToken?.payload.name,
        } as UserProfile),
      )
      .catch(() => console.error('Failed to fetch auth session'));
  }, []);

  if (!userProfile?.group) return null;

  return (
    <ThemeProvider userProfile={userProfile}>
      <AppContent userProfile={userProfile} signOut={signOut} />
    </ThemeProvider>
  );
}

export default withAuthenticator(App, {
  signUpAttributes: ['name'],
  formFields: {
    signUp: {
      "custom:role": {
        placeholder: 'Enter "teachers" or "students"',
        isRequired: true,
        label: 'Role:',
        pattern: "(teachers|students)"
      },
    },
  },
  components: {
    Header: () => {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h1 style={{ color: '#232f3e', margin: 0 }}>Gen Assess</h1>
          <p style={{ color: '#687078', margin: '10px 0 0 0' }}>智能评估系统 / Intelligent Assessment System</p>
          <LanguageSwitcher />
        </div>
      );
    }
  }
});
