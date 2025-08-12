import { useState, useContext } from 'react';
import { Container, SpaceBetween, Button, Form, FormField, Box, Input, Select, SelectProps } from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { createAssessTemplate } from '../graphql/mutations';
import { Lang, AssessType, Taxonomy } from '../graphql/API';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { optionise } from '../helpers';
import { getText } from '../i18n/lang';

const client = generateClient();

const langs = Object.values(Lang).map(optionise);
const assessTypes = Object.values(AssessType).map(optionise);
const taxonomies = Object.values(Taxonomy).map(optionise);

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
        client
          .graphql<any>({
            query: createAssessTemplate,
            variables: {
              input: {
                name,
                docLang: docLang?.value as Lang,
                assessType: assessType?.value as AssessType,
                taxonomy: taxonomy?.value as Taxonomy,
                totalQuestions: +totalQuestions,
                easyQuestions: +easyQuestions,
                mediumQuestions: +mediumQuestions,
                hardQuestions: +hardQuestions,
              },
            },
          })
          .then(() => {
            dispatchAlert({ type: AlertType.SUCCESS, content: getText('templates.create_success') });
            onSubmit();
          })
          .catch(() => {
            dispatchAlert({ type: AlertType.ERROR });
            onCancel();
          });
      }}
    >
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button formAction="none" variant="link" onClick={onCancel}>
              {getText('common.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!docLang || !assessType || !taxonomy || !totalQuestions || !easyQuestions || !mediumQuestions || !hardQuestions}
            >
              {getText('common.submit')}
            </Button>
          </SpaceBetween>
        }
      >
        <Container>
          <SpaceBetween size="l" alignItems="center">
            <Box padding="xxxl">
              <SpaceBetween direction="horizontal" size="l">
                <FormField label={getText('templates.name')}>
                  <Input value={name} onChange={({ detail }) => setName(detail.value)} />
                </FormField>
                <FormField label={getText('templates.docLang')}>
                  <Select options={langs} selectedOption={docLang} onChange={({ detail }) => setDocLang(detail.selectedOption)} />
                </FormField>
                <FormField label={getText('templates.assessType')}>
                  <Select options={assessTypes} selectedOption={assessType} onChange={({ detail }) => setAssessType(detail.selectedOption)} />
                </FormField>
                <FormField label={getText('templates.taxonomy')}>
                  <Select options={taxonomies} selectedOption={taxonomy} onChange={({ detail }) => setTaxonomy(detail.selectedOption)} />
                </FormField>
                <FormField label={getText('templates.total_questions')}>
                  <Input value={totalQuestions} onChange={({ detail }) => setTotalQuestions(detail.value)} />
                </FormField>
                <FormField label={getText('templates.easy_questions')}>
                  <Input value={easyQuestions} onChange={({ detail }) => setEasyQuestions(detail.value)} />
                </FormField>
                <FormField label={getText('templates.medium_questions')}>
                  <Input value={mediumQuestions} onChange={({ detail }) => setMediumQuestions(detail.value)} />
                </FormField>
                <FormField label={getText('templates.hard_questions')}>
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
