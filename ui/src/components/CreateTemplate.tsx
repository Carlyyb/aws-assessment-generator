/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
// 仅在模板创建页中展示允许的题型，移除 freeText 与 multiChoice
const assessTypes = getAssessTypeOptions().filter(
  (opt) => opt.value !== AssessType.freeTextAssessment && opt.value !== AssessType.multiChoiceAssessment
);
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

  // 验证总问题数是否等于三种难度问题数之和
  const validateQuestionNumbers = () => {
    if (totalQuestions && easyQuestions && mediumQuestions && hardQuestions) {
      const total = +totalQuestions;
      const easy = +easyQuestions;
      const medium = +mediumQuestions;
      const hard = +hardQuestions;
      const sum = easy + medium + hard;
      
      if (total !== sum) {
        return false;
      }
    }
    return true;
  };

  const isQuestionNumbersValid = validateQuestionNumbers();
  const isFormValid = name && docLang && assessType && taxonomy && totalQuestions && easyQuestions && mediumQuestions && hardQuestions && isQuestionNumbersValid;

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
        
        // 验证问题数总和
        if (!isQuestionNumbersValid) {
          dispatchAlert({ 
            type: AlertType.ERROR, 
            content: getText('teachers.settings.templates.validation_questions_sum_error') || '总问题数应该等于三种难度问题数之和'
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
              disabled={!isFormValid}
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
              {totalQuestions && easyQuestions && mediumQuestions && hardQuestions && !isQuestionNumbersValid && (
                <Box color="text-status-error" fontSize="body-s" textAlign="center">
                  {getText('teachers.settings.templates.validation_questions_sum_error') || '总问题数应该等于三种难度问题数之和'}
                </Box>
              )}
            </Box>
          </SpaceBetween>
        </Container>
      </Form>
    </form>
  );
};
