/* eslint-disable react-refresh/only-export-components */
import { useState, useContext } from 'react';
import { Container, Header, SpaceBetween, Button, Form, FormField, Tabs, Input, Alert } from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { changePasswordMutation } from '../graphql/mutations';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { getText } from '../i18n/lang';
import { ThemeSettings } from '../components/ThemeSettings';

const client = generateClient();

export default () => {
  const dispatchAlert = useContext(DispatchAlertContext);
  const [activeTabId, setActiveTabId] = useState('theme');
  
  // 密码修改相关状态
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // 语言固定为中文，无需从设置中加载语言或读取用户设置。

  // 不再提供语言设置，语言固定为中文。

  // 验证密码表单
  const validatePasswordForm = () => {
    const errors: Record<string, string> = {};

    if (!passwordForm.currentPassword) {
      errors.currentPassword = '请输入当前密码';
    }

    if (!passwordForm.newPassword) {
      errors.newPassword = '请输入新密码';
    } else if (passwordForm.newPassword.length < 8) {
      errors.newPassword = '密码长度至少8个字符';
    } else if (!/(?=.*\d)/.test(passwordForm.newPassword)) {
      errors.newPassword = '密码必须包含数字';
    }

    if (!passwordForm.confirmPassword) {
      errors.confirmPassword = '请确认新密码';
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致';
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      errors.newPassword = '新密码不能与当前密码相同';
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 处理密码修改
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePasswordForm()) return;

    setPasswordLoading(true);
    try {
      await client.graphql({
        query: changePasswordMutation,
        variables: {
          input: {
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword
          }
        }
      });

      dispatchAlert({
        type: AlertType.SUCCESS,
        content: '密码修改成功！'
      });

      // 清空表单
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setPasswordErrors({});

    } catch (err: unknown) {
      console.error('密码修改失败:', err);
      let message: string | undefined;
      if (typeof err === 'object' && err !== null) {
        const e = err as { errors?: Array<{ message?: string }> };
        message = e.errors?.[0]?.message;
      }
      dispatchAlert({
        type: AlertType.ERROR,
        content: message || '密码修改失败，请检查当前密码是否正确'
      });
    } finally {
      setPasswordLoading(false);
    }
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
            id: 'theme',
            label: getText('theme.title'),
            content: <ThemeSettings />
          },
          {
            id: 'password',
            label: '密码管理',
            content: (
              <form onSubmit={handlePasswordSubmit}>
                <Form
                  actions={
                    <SpaceBetween direction="horizontal" size="xs">
                      <Button 
                        formAction="none" 
                        variant="link"
                        onClick={() => {
                          setPasswordForm({
                            currentPassword: '',
                            newPassword: '',
                            confirmPassword: ''
                          });
                          setPasswordErrors({});
                        }}
                      >
                        取消
                      </Button>
                      <Button 
                        variant="primary"
                        loading={passwordLoading}
                        disabled={!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                      >
                        修改密码
                      </Button>
                    </SpaceBetween>
                  }
                >
                  <Container>
                    <SpaceBetween direction="vertical" size="l">
                      <Alert type="info">
                        为了账户安全，建议您定期更换密码。新密码应至少8位，包含数字。
                      </Alert>
                      
                      <FormField 
                        label="当前密码"
                        errorText={passwordErrors.currentPassword}
                      >
                        <Input
                          value={passwordForm.currentPassword}
                          onChange={({ detail }) => {
                            setPasswordForm(prev => ({ ...prev, currentPassword: detail.value }));
                            if (passwordErrors.currentPassword) {
                              setPasswordErrors(prev => ({ ...prev, currentPassword: '' }));
                            }
                          }}
                          placeholder="请输入当前密码"
                          type="password"
                        />
                      </FormField>

                      <FormField 
                        label="新密码"
                        description="至少8个字符，包含数字"
                        errorText={passwordErrors.newPassword}
                      >
                        <Input
                          value={passwordForm.newPassword}
                          onChange={({ detail }) => {
                            setPasswordForm(prev => ({ ...prev, newPassword: detail.value }));
                            if (passwordErrors.newPassword) {
                              setPasswordErrors(prev => ({ ...prev, newPassword: '' }));
                            }
                          }}
                          placeholder="请输入新密码"
                          type="password"
                        />
                      </FormField>

                      <FormField 
                        label="确认新密码"
                        errorText={passwordErrors.confirmPassword}
                      >
                        <Input
                          value={passwordForm.confirmPassword}
                          onChange={({ detail }) => {
                            setPasswordForm(prev => ({ ...prev, confirmPassword: detail.value }));
                            if (passwordErrors.confirmPassword) {
                              setPasswordErrors(prev => ({ ...prev, confirmPassword: '' }));
                            }
                          }}
                          placeholder="请再次输入新密码"
                          type="password"
                        />
                      </FormField>
                    </SpaceBetween>
                  </Container>
                </Form>
              </form>
            )
          }
        ]}
      />
    </Container>
  );
};
