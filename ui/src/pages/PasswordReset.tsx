import React, { useState, useEffect, useContext } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  Button,
  Form,
  FormField,
  Input,
  Select,
  Box,
  Alert
} from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { requestPasswordResetMutation, confirmPasswordResetMutation } from '../graphql/mutations';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';

const client = generateClient();

interface ResetRequestFormData {
  identifier: string;
  resetMethod: 'email' | 'sms';
}

interface ResetConfirmFormData {
  identifier: string;
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}

const PasswordReset: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatchAlert = useContext(DispatchAlertContext);

  const [activeStep, setActiveStep] = useState<'request' | 'confirm'>('request');
  const [loading, setLoading] = useState(false);
  
  // 请求重置表单
  const [requestForm, setRequestForm] = useState<ResetRequestFormData>({
    identifier: '',
    resetMethod: 'email'
  });
  const [requestSent, setRequestSent] = useState(false);
  
  // 确认重置表单
  const [confirmForm, setConfirmForm] = useState<ResetConfirmFormData>({
    identifier: '',
    resetToken: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // 检查URL参数中是否有token
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setConfirmForm(prev => ({ ...prev, resetToken: token }));
      setActiveStep('confirm');
    }
  }, [searchParams]);

  // 验证请求表单
  const validateRequestForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!requestForm.identifier.trim()) {
      errors.identifier = '请输入用户名、邮箱或手机号';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 验证确认表单
  const validateConfirmForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!confirmForm.identifier.trim()) {
      errors.identifier = '请输入用户名、邮箱或手机号';
    }
    
    if (!confirmForm.resetToken.trim()) {
      errors.resetToken = '请输入重置令牌或验证码';
    }
    
    if (!confirmForm.newPassword) {
      errors.newPassword = '请输入新密码';
    } else if (confirmForm.newPassword.length < 8) {
      errors.newPassword = '密码长度至少8个字符';
    } else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(confirmForm.newPassword)) {
      errors.newPassword = '密码必须包含字母和数字';
    }
    
    if (!confirmForm.confirmPassword) {
      errors.confirmPassword = '请确认新密码';
    } else if (confirmForm.newPassword !== confirmForm.confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 处理重置请求
  const handlePasswordResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateRequestForm()) return;

    setLoading(true);
    try {
      await client.graphql({
        query: requestPasswordResetMutation,
        variables: {
          input: {
            identifier: requestForm.identifier,
            resetMethod: requestForm.resetMethod
          }
        }
      });

      setRequestSent(true);
      dispatchAlert({
        type: AlertType.SUCCESS,
        content: `密码重置${requestForm.resetMethod === 'email' ? '邮件' : '短信'}已发送，请查收`
      });

    } catch (error) {
      console.error('密码重置请求失败:', error);
      const errorMessage = error instanceof Error ? error.message : '密码重置请求失败，请稍后重试';
      dispatchAlert({
        type: AlertType.ERROR,
        content: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  // 处理重置确认
  const handlePasswordResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateConfirmForm()) return;

    setLoading(true);
    try {
      await client.graphql({
        query: confirmPasswordResetMutation,
        variables: {
          input: {
            identifier: confirmForm.identifier,
            resetToken: confirmForm.resetToken,
            newPassword: confirmForm.newPassword
          }
        }
      });

      dispatchAlert({
        type: AlertType.SUCCESS,
        content: '密码重置成功！请使用新密码登录'
      });

      // 跳转到登录页面
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error) {
      console.error('密码重置确认失败:', error);
      const errorMessage = error instanceof Error ? error.message : '密码重置失败，请检查重置令牌是否正确';
      dispatchAlert({
        type: AlertType.ERROR,
        content: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (activeStep === 'request') {
      setRequestForm(prev => ({ ...prev, [field]: value }));
    } else {
      setConfirmForm(prev => ({ ...prev, [field]: value }));
    }
    
    // 清除对应字段的验证错误
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // 请求重置步骤的内容
  const renderRequestStep = () => (
    <Container>
      <SpaceBetween direction="vertical" size="l">
        <Header variant="h1">忘记密码</Header>
        
        {requestSent ? (
          <Alert
            type="success"
            header="重置请求已发送"
            action={
              <Button onClick={() => setActiveStep('confirm')}>
                我已收到重置信息
              </Button>
            }
          >
            密码重置{requestForm.resetMethod === 'email' ? '邮件' : '短信'}已发送到您的{requestForm.resetMethod === 'email' ? '邮箱' : '手机'}。
            请查收并按照说明重置密码。如果没有收到，请检查垃圾邮件文件夹或稍后重试。
          </Alert>
        ) : (
          <form onSubmit={handlePasswordResetRequest}>
            <Form
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    variant="link"
                    onClick={() => navigate('/')}
                  >
                    返回登录
                  </Button>
                  <Button
                    variant="primary"
                    loading={loading}
                    disabled={!requestForm.identifier}
                  >
                    发送重置请求
                  </Button>
                </SpaceBetween>
              }
            >
              <SpaceBetween direction="vertical" size="m">
                <Alert>
                  请输入您的用户名、邮箱或手机号，我们将向您发送密码重置信息。
                </Alert>
                
                <FormField 
                  label="用户标识"
                  description="可以是用户名、邮箱地址或手机号"
                  errorText={validationErrors.identifier}
                >
                  <Input
                    value={requestForm.identifier}
                    onChange={({ detail }) => handleInputChange('identifier', detail.value)}
                    placeholder="请输入用户名、邮箱或手机号"
                  />
                </FormField>
                
                <FormField label="重置方式">
                  <Select
                    selectedOption={{ 
                      label: requestForm.resetMethod === 'email' ? '邮件' : '短信', 
                      value: requestForm.resetMethod 
                    }}
                    onChange={({ detail }) => handleInputChange('resetMethod', detail.selectedOption.value!)}
                    options={[
                      { label: '邮件', value: 'email' },
                      { label: '短信', value: 'sms' }
                    ]}
                  />
                </FormField>
              </SpaceBetween>
            </Form>
          </form>
        )}
      </SpaceBetween>
    </Container>
  );

  // 确认重置步骤的内容
  const renderConfirmStep = () => (
    <Container>
      <SpaceBetween direction="vertical" size="l">
        <Header variant="h1">设置新密码</Header>
        
        <form onSubmit={handlePasswordResetConfirm}>
          <Form
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="link"
                  onClick={() => {
                    setActiveStep('request');
                    setRequestSent(false);
                  }}
                >
                  返回上一步
                </Button>
                <Button
                  variant="primary"
                  loading={loading}
                  disabled={!confirmForm.identifier || !confirmForm.resetToken || !confirmForm.newPassword || !confirmForm.confirmPassword}
                >
                  重置密码
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween direction="vertical" size="m">
              <Alert>
                请输入重置信息和新密码。重置令牌或验证码的有效期为15分钟。
              </Alert>
              
              <FormField 
                label="用户标识"
                description="用户名、邮箱或手机号（与申请时相同）"
                errorText={validationErrors.identifier}
              >
                <Input
                  value={confirmForm.identifier}
                  onChange={({ detail }) => handleInputChange('identifier', detail.value)}
                  placeholder="请输入用户名、邮箱或手机号"
                />
              </FormField>
              
              <FormField 
                label="重置令牌/验证码"
                description="从邮件链接或短信中获取的重置信息"
                errorText={validationErrors.resetToken}
              >
                <Input
                  value={confirmForm.resetToken}
                  onChange={({ detail }) => handleInputChange('resetToken', detail.value)}
                  placeholder="请输入重置令牌或验证码"
                />
              </FormField>
              
              <FormField 
                label="新密码"
                description="至少8个字符，包含大小写字母、数字和特殊字符"
                errorText={validationErrors.newPassword}
              >
                <Input
                  value={confirmForm.newPassword}
                  onChange={({ detail }) => handleInputChange('newPassword', detail.value)}
                  placeholder="请输入新密码"
                  type="password"
                />
              </FormField>
              
              <FormField 
                label="确认新密码"
                errorText={validationErrors.confirmPassword}
              >
                <Input
                  value={confirmForm.confirmPassword}
                  onChange={({ detail }) => handleInputChange('confirmPassword', detail.value)}
                  placeholder="请再次输入新密码"
                  type="password"
                />
              </FormField>
            </SpaceBetween>
          </Form>
        </form>
      </SpaceBetween>
    </Container>
  );

  return (
    <Box padding="l">
      {activeStep === 'request' ? renderRequestStep() : renderConfirmStep()}
    </Box>
  );
};

export default PasswordReset;