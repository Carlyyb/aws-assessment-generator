// 认证组件的多语言配置
import { translations } from '@aws-amplify/ui-react';
import { I18n } from '@aws-amplify/core';

// 中文翻译
const zhTranslations = {
  'Sign In': '登录',
  'Sign Up': '注册',
  'Sign Out': '退出',
  'Forgot Password': '忘记密码',
  'Reset Password': '重置密码',
  'Change Password': '修改密码',
  'Confirm Sign Up': '确认注册',
  'Create Account': '创建账户',
  'Back to Sign In': '返回登录',
  'Send Code': '发送验证码',
  'Confirm': '确认',
  'Submit': '提交',
  'Skip': '跳过',
  'Resend Code': '重新发送验证码',
  'Username': '用户名',
  'Email': '邮箱',
  'Password': '密码',
  'Confirm Password': '确认密码',
  'Name': '姓名',
  'Enter your username': '请输入用户名',
  'Enter your email': '请输入邮箱',
  'Enter your password': '请输入密码',
  'Enter your name': '请输入姓名',
  'Enter your code': '请输入验证码',
  'Code': '验证码',
  'New Password': '新密码',
  'Loading...': '加载中...',
  'or': '或者',
  'Phone Number': '手机号码',
  'Enter your phone number': '请输入手机号码',
  'Verification Code': '验证码',
  'We sent a code to': '我们已向您发送验证码',
  'Lost your code?': '没有收到验证码？',
  'Account recovery': '账户恢复',
  'Reset your password': '重置您的密码',
  'Send reset code': '发送重置码',
  'Back to Sign In Page': '返回登录页面',
  'Enter "teachers" or "students"': '请输入 "teachers" 或 "students"',
  'Role:': '角色：',
  'Role': '角色',
  
  // 错误消息
  'Invalid email address format.': '邮箱格式不正确。',
  'Password must have at least 8 characters': '密码必须至少包含8个字符',
  'Username cannot be empty': '用户名不能为空',
  'Password cannot be empty': '密码不能为空',
  'Email cannot be empty': '邮箱不能为空',
  'Invalid verification code provided, please try again.': '验证码无效，请重试。',
  'User does not exist.': '用户不存在。',
  'Incorrect username or password.': '用户名或密码错误。',
  'User is not confirmed.': '用户未确认。',
  'Invalid password format.': '密码格式无效。',
  'An account with the given email already exists.': '该邮箱已注册。',
  'Username/client id combination not found.': '用户名/客户端ID组合未找到。',
  'Password attempts exceeded': '密码尝试次数超限',
  'Attempt limit exceeded, please try after some time.': '尝试次数超限，请稍后再试。',
  'Network error': '网络错误',
  'Something went wrong during Sign Up.': '注册过程中出现错误。',
  'Something went wrong during Sign In.': '登录过程中出现错误。',
};

// 英文翻译（使用默认的英文文本）
const enTranslations = translations.en;

export const authTranslations = {
  zh: {
    ...enTranslations,
    ...zhTranslations,
  },
  en: enTranslations,
};

// 配置 Amplify I18n
export function configureAuthI18n(language: 'zh' | 'en' = 'en') {
  I18n.putVocabulariesForLanguage(language, authTranslations[language]);
  I18n.setLanguage(language);
}
