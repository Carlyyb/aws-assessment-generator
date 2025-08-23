import React, { useState, useEffect, useContext } from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  FormField,
  Input,
  Button,
  Alert
} from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { getCurrentUser } from '../graphql/queries';
import { changePasswordMutation } from '../graphql/mutations';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { signOut } from 'aws-amplify/auth';

const client = generateClient();

interface PasswordChangeFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface PasswordChangeMonitorProps {
  children: React.ReactNode;
}

const PasswordChangeMonitor: React.FC<PasswordChangeMonitorProps> = ({ children }) => {
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingUser, setCheckingUser] = useState(true);
  const [formData, setFormData] = useState<PasswordChangeFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  const dispatchAlert = useContext(DispatchAlertContext);

  // 检查用户是否需要修改密码
  useEffect(() => {
    const checkPasswordChangeRequired = async () => {
      try {
        const response = await client.graphql({
          query: getCurrentUser
        });
        
        const user = (response as any).data.getCurrentUser;
        if (user && user.needsPasswordChange) {
          setNeedsPasswordChange(true);
        }
      } catch (error) {
        console.warn('无法检查密码修改状态:', error);
      } finally {
        setCheckingUser(false);
      }
    };

    checkPasswordChangeRequired();
  }, []);

  // 验证表单
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.currentPassword) {
      errors.currentPassword = '请输入当前密码';
    }

    if (!formData.newPassword) {
      errors.newPassword = '请输入新密码';
    } else if (formData.newPassword.length < 8) {
      errors.newPassword = '密码长度至少8个字符';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>?])/.test(formData.newPassword)) {
      errors.newPassword = '密码必须包含大小写字母、数字和特殊字符';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = '请确认新密码';
    } else if (formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致';
    }

    if (formData.currentPassword === formData.newPassword) {
      errors.newPassword = '新密码不能与当前密码相同';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 处理密码修改
  const handlePasswordChange = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      await client.graphql({
        query: changePasswordMutation,
        variables: {
          input: {
            currentPassword: formData.currentPassword,
            newPassword: formData.newPassword
          }
        }
      });

      dispatchAlert({
        type: AlertType.SUCCESS,
        content: '密码修改成功！'
      });

      // 强制用户重新登录以应用新密码
      setTimeout(async () => {
        try {
          await signOut();
          window.location.reload();
        } catch (error) {
          console.error('登出失败:', error);
          window.location.reload();
        }
      }, 2000);

    } catch (error) {
      console.error('密码修改失败:', error);
      const errorMessage = error instanceof Error ? error.message : '密码修改失败，请检查当前密码是否正确';
      dispatchAlert({
        type: AlertType.ERROR,
        content: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  // 处理输入变化
  const handleInputChange = (field: keyof PasswordChangeFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // 清除对应字段的验证错误
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // 如果还在检查用户状态，显示加载中
  if (checkingUser) {
    return <div>正在验证用户状态...</div>;
  }

  // 如果不需要修改密码，直接渲染子组件
  if (!needsPasswordChange) {
    return <>{children}</>;
  }

  // 显示强制密码修改模态框
  return (
    <>
      <Modal
        onDismiss={() => {}} // 不允许关闭
        visible={true}
        closeAriaLabel=""
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                loading={loading}
                onClick={handlePasswordChange}
                disabled={!formData.currentPassword || !formData.newPassword || !formData.confirmPassword}
              >
                修改密码
              </Button>
            </SpaceBetween>
          </Box>
        }
        header="安全提醒 - 需要修改密码"
        size="medium"
      >
        <SpaceBetween direction="vertical" size="l">
          <Alert
            type="warning"
            header="需要修改密码"
          >
            出于安全考虑，您需要修改默认密码后才能继续使用系统。
          </Alert>

          <FormField 
            label="当前密码" 
            errorText={validationErrors.currentPassword}
          >
            <Input
              value={formData.currentPassword}
              onChange={({ detail }) => handleInputChange('currentPassword', detail.value)}
              placeholder="请输入当前密码"
              type="password"
            />
          </FormField>

          <FormField 
            label="新密码" 
            description="至少8个字符，包含大小写字母、数字和特殊字符"
            errorText={validationErrors.newPassword}
          >
            <Input
              value={formData.newPassword}
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
              value={formData.confirmPassword}
              onChange={({ detail }) => handleInputChange('confirmPassword', detail.value)}
              placeholder="请再次输入新密码"
              type="password"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
      
      {/* 背景内容（模糊显示） */}
      <div style={{ filter: 'blur(3px)', pointerEvents: 'none' }}>
        {children}
      </div>
    </>
  );
};

export default PasswordChangeMonitor;