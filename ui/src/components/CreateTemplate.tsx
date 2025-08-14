import { useState, useContext } from 'react';
import { Container, SpaceBetween, Button, Form, FormField, Box, Input, Select, SelectProps } from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { createAssessTemplate } from '../graphql/mutations';
import { Lang, AssessType, Taxonomy } from '../graphql/API';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { optionise } from '../helpers';
import { getAssessTypeOptions, getTaxonomyOptions } from '../utils/enumTranslations';
import { getText } from '../i18n/lang';

const client = generateClient();

const langs = Object.values(Lang).map(optionise);
const assessTypes = getAssessTypeOptions();
const taxonomies = getTaxonomyOptions();

type CreateTemplateProps = {
  onSubmit: () => void;
  onCancel: () => void;
};

export default (props: CreateTemplateProps) => {
  const dispatchAlert = useContext(DispatchAlertContext);
  const { onSubmit, onCancel } = props;

  const [name, setName] = useState('');
  const [docLang, setDocLang] = useState<SelectProps.Option | null>(null);
  const [assessType, setAssessType] = useState<SelectProps.Option | null>(null);
  const [taxonomy, setTaxonomy] = useState<SelectProps.Option | null>(null);
  const [totalQuestions, setTotalQuestions] = useState('');
  const [easyQuestions, setEasyQuestions] = useState('');
  const [mediumQuestions, setMediumQuestions] = useState('');
  const [hardQuestions, setHardQuestions] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        
        // 验证所有必需字段
        if (!docLang?.value || !assessType?.value || !taxonomy?.value) {
          dispatchAlert({ 
            type: AlertType.ERROR, 
            content: getText('teachers.settings.templates.validation_error') 
          });
          return;
        }
        
        client
          .graphql<any>({
            query: createAssessTemplate,
            variables: {
              input: {
                name,
                docLang: docLang.value as Lang,
                assessType: assessType.value as AssessType,
                taxonomy: taxonomy.value as Taxonomy,
                totalQuestions: +totalQuestions,
                easyQuestions: +easyQuestions,
                mediumQuestions: +mediumQuestions,
                hardQuestions: +hardQuestions,
              },
            },
          })
          .then(() => {
            dispatchAlert({ type: AlertType.SUCCESS, content: getText('teachers.settings.templates.create_success') });
            onSubmit();
          })
          .catch((error) => {
            console.error('Error creating template:', error);
            dispatchAlert({ type: AlertType.ERROR });
            onCancel();
          });
      }}
    >
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button formAction="none" variant="link" onClick={onCancel}>
              {getText('common.actions.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!docLang || !assessType || !taxonomy || !totalQuestions || !easyQuestions || !mediumQuestions || !hardQuestions}
            >
              {getText('common.actions.submit')}
            </Button>
          </SpaceBetween>
        }
      >
        <Container>
          <SpaceBetween size="l" alignItems="center">
            <Box padding="xxxl">
              <SpaceBetween direction="horizontal" size="l">
                <FormField label={getText('teachers.settings.templates.name')}>
                  <Input value={name} onChange={({ detail }) => setName(detail.value)} />
                </FormField>
                <FormField label={getText('teachers.settings.templates.doc_lang')}>
                  <Select options={langs} selectedOption={docLang} onChange={({ detail }) => setDocLang(detail.selectedOption)} />
                </FormField>
                <FormField label={getText('teachers.settings.templates.assess_type')}>
                  <Select options={assessTypes} selectedOption={assessType} onChange={({ detail }) => setAssessType(detail.selectedOption)} />
                </FormField>
                <FormField label={getText('teachers.settings.templates.taxonomy')}>
                  <Select options={taxonomies} selectedOption={taxonomy} onChange={({ detail }) => setTaxonomy(detail.selectedOption)} />
                </FormField>
                <FormField label={getText('teachers.settings.templates.questions.total')}>
                  <Input value={totalQuestions} onChange={({ detail }) => setTotalQuestions(detail.value)} />
                </FormField>
                <FormField label={getText('teachers.settings.templates.questions.easy')}>
                  <Input value={easyQuestions} onChange={({ detail }) => setEasyQuestions(detail.value)} />
                </FormField>
                <FormField label={getText('teachers.settings.templates.questions.medium')}>
                  <Input value={mediumQuestions} onChange={({ detail }) => setMediumQuestions(detail.value)} />
                </FormField>
                <FormField label={getText('teachers.settings.templates.questions.hard')}>
                  <Input value={hardQuestions} onChange={({ detail }) => setHardQuestions(detail.value)} />
                </FormField>
              </SpaceBetween>
            </Box>
          </SpaceBetween>
        </Container>
      </Form>
    </form>
  );
};
