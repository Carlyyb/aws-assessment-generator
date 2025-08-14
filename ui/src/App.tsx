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
import { I18nProvider } from '@cloudscape-design/components/i18n';
import messages from '@cloudscape-design/components/i18n/messages/all.en';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import type { WithAuthenticatorProps } from '@aws-amplify/ui-react';
import { withAuthenticator } from '@aws-amplify/ui-react';
import { routes as routesList } from './routes';
import { getText } from './i18n/lang';
import { AlertType, DispatchAlertContext } from './contexts/alerts';
import { UserProfile, UserProfileContext } from './contexts/userProfile';
import { RoutesContext } from './contexts/routes';
import { fetchAuthSession } from 'aws-amplify/auth';

const LOCALE = 'en';

export function App({ signOut, user }: WithAuthenticatorProps) {
  const [alerts, setAlerts] = useState<FlashbarProps.MessageDefinition[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | undefined>();
  const [activeHref, setActiveHref] = useState(window.location.pathname);

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
      .catch(() => dispatchAlert({ type: AlertType.ERROR }));
  }, []);

  if (!userProfile?.group) return null;

  const routes = (routesList as any)[userProfile.group];
  const router = createBrowserRouter(routes);
  const [sideNavRoutes] = routes;

  router.subscribe(({ location }) => setActiveHref(location.pathname));

  return (
    <DispatchAlertContext.Provider value={dispatchAlert}>
      <UserProfileContext.Provider value={userProfile}>
        <RoutesContext.Provider value={routes}>
          <I18nProvider locale={LOCALE} messages={[messages]}>
            <div id="h">
              <TopNavigation
                identity={{
                  href: '#',
                  title: getText('common.brand'),
                }}
                utilities={[
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
            </div>
            <AppLayout
              headerSelector="#h"
              breadcrumbs={
                <BreadcrumbGroup
                  items={[
                    { text: getText('common.breadcrumb.home'), href: '#' },
                    { text: getText('common.breadcrumb.service'), href: '#' },
                  ]}
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
                  items={sideNavRoutes.children.map(({ path, children }: any) => {
                    if (children) {
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
                  })}
                />
              }
              notifications={<Flashbar items={alerts}/>}
              toolsOpen={false}
          tools={<HelpPanel header={<h2>{getText('common.help.overview')}</h2>}>{getText('common.help.content')}</HelpPanel>}
              content={<RouterProvider router={router}/>}
            />
          </I18nProvider>
        </RoutesContext.Provider>
      </UserProfileContext.Provider>
    </DispatchAlertContext.Provider>
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
});
