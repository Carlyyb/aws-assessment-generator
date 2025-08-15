import { useEffect, useState, useContext } from 'react';
import { Container, Header, SpaceBetween, Button, Form, FormField, Box, Select, SelectProps, Tabs } from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { Lang } from '../graphql/Lang';
import { getSettings } from '../graphql/queries';
import { upsertSettings } from '../graphql/mutations';
import { optionise } from '../helpers';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { setCurrentLang, getText } from '../i18n/lang';
import { ThemeSettings } from '../components/ThemeSettings';

const client = generateClient();

const langs = Object.values(Lang).map(optionise);

export default () => {
  const dispatchAlert = useContext(DispatchAlertContext);
  const [activeTabId, setActiveTabId] = useState('general');
  const [uiLang, setUiLang] = useState<SelectProps.Option | null>(null);

  useEffect(() => {
    client.graphql<any>({ query: getSettings }).then(({ data }) => {
      const settings = data.getSettings;
      if (!settings) return;
      setUiLang(optionise(settings.uiLang!));
      // 设置初始语言
      if (settings.uiLang) {
        setCurrentLang(settings.uiLang as Lang);
      }
    });
  }, []);

  const handleLanguageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    client
      .graphql<any>({
        query: upsertSettings,
        variables: { 
          input: { 
            uiLang: uiLang?.value as Lang
          } 
        },
      })
      .then(() => dispatchAlert({ type: AlertType.SUCCESS, content: getText('common.settings.update_success') }))
      .catch((error) => {
        console.error('Settings update error:', error);
        dispatchAlert({ type: AlertType.ERROR, content: getText('common.status.error') });
      });
  };

  return (
    <Container
      header={<Header variant="h1">{getText('common.settings.title')}</Header>}
    >
      <Tabs
        activeTabId={activeTabId}
        onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
        tabs={[
          {
            id: 'general',
            label: getText('common.settings.title'),
            content: (
              <form onSubmit={handleLanguageSubmit}>
                <Form
                  actions={
                    <SpaceBetween direction="horizontal" size="xs">
                      <Button 
                        formAction="none" 
                        variant="link" 
                        ariaLabel={getText('common.actions.cancel')}
                        >
                        {getText('common.actions.cancel')}
                      </Button>
                      <Button 
                        variant="primary" 
                        ariaLabel={getText('common.actions.submit')}
                        >
                        {getText('common.actions.submit')}
                      </Button>
                    </SpaceBetween>
                  }
                >
                  <Container>
                    <Box padding="xxxl">
                      <SpaceBetween direction="horizontal" size="l">
                        <FormField label={getText('common.settings.ui_language')}>
                          <Select 
                            options={langs} 
                            selectedOption={uiLang} 
                            onChange={({ detail }) => {
                              setUiLang(detail.selectedOption);
                              // 设置新的语言
                              if (detail.selectedOption?.value) {
                                setCurrentLang(detail.selectedOption.value as Lang);
                              }
                            }} 
                          />
                        </FormField>
                      </SpaceBetween>
                    </Box>
                  </Container>
                </Form>
              </form>
            )
          },
          {
            id: 'theme',
            label: getText('theme.title'),
            content: <ThemeSettings />
          }
        ]}
      />
    </Container>
  );
};
