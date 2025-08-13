import { useEffect, useState, useContext } from 'react';
import { Container, Header, SpaceBetween, Button, Form, FormField, Box, Select, SelectProps } from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { AssessType, Taxonomy } from '../graphql/API';
import { Lang } from '../graphql/Lang';
import { getSettings } from '../graphql/queries';
import { upsertSettings } from '../graphql/mutations';
import { optionise } from '../helpers';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { setCurrentLang, getText } from '../i18n/lang';

const client = generateClient();

const langs = Object.values(Lang).map(optionise);
const assessTypes = Object.values(AssessType).map(optionise);
const taxonomies = Object.values(Taxonomy).map(optionise);

export default () => {
  const dispatchAlert = useContext(DispatchAlertContext);

  const [uiLang, setUiLang] = useState<SelectProps.Option | null>(null);
  const [docLang, setDocLang] = useState<SelectProps.Option | null>(null);
  const [assessType, setAssessType] = useState<SelectProps.Option | null>(null);
  const [taxonomy, setTaxonomy] = useState<SelectProps.Option | null>(null);

  useEffect(() => {
    client.graphql<any>({ query: getSettings }).then(({ data }) => {
      const settings = data.getSettings;
      if (!settings) return;
      setUiLang(optionise(settings.uiLang!));
      // 设置初始语言
      if (settings.uiLang) {
        setCurrentLang(settings.uiLang as Lang);
      }
      setDocLang(optionise(settings.docLang!));
      setAssessType(optionise(settings.assessType!));
    });
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        client
          .graphql<any>({
            query: upsertSettings,
            variables: { input: { uiLang: uiLang?.value as Lang, docLang: docLang?.value as Lang, assessType: assessType?.value as AssessType } },
          })
          .then(() => dispatchAlert({ type: AlertType.SUCCESS, content: getText('pages.settings.update_success') }))
          .catch(() => dispatchAlert({ type: AlertType.ERROR, content: getText('common.error') }));
      }}
    >
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button 
              formAction="none" 
              variant="link" 
              ariaLabel={getText('common.cancel')}
              >
              {getText('common.cancel')}
            </Button>
            <Button 
              variant="primary" 
              ariaLabel={getText('common.submit')}
              >
              {getText('common.submit')}
            </Button>
          </SpaceBetween>
        }
        header={<Header variant="h1">{getText('pages.settings.title')}</Header>}
      >
        <Container>
          <Box padding="xxxl">
            <SpaceBetween direction="horizontal" size="l">
              <FormField label={getText('pages.settings.ui_language')}>
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
              <FormField label={getText('pages.settings.doc_language')}>
                <Select options={langs} selectedOption={docLang} onChange={({ detail }) => setDocLang(detail.selectedOption)} />
              </FormField>
              <FormField label={getText('pages.settings.default_assessment_type')}>
                <Select options={assessTypes} selectedOption={assessType} onChange={({ detail }) => setAssessType(detail.selectedOption)} />
              </FormField>
              <FormField label={getText('pages.settings.default_taxonomy')}>
                <Select options={taxonomies} selectedOption={taxonomy} onChange={({ detail }) => setTaxonomy(detail.selectedOption)} />
              </FormField>
            </SpaceBetween>
          </Box>
        </Container>
      </Form>
    </form>
  );
};
