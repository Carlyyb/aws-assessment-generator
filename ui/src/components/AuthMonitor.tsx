import React from 'react';

interface AuthMonitorProps {
  children: React.ReactNode;
}

export const AuthMonitor = ({ children }: AuthMonitorProps) => {
  // 移除所有自动登出和会话检测逻辑
  // 现在只是一个简单的包装器组件，允许用户在不同选项卡中
  // 使用不同账号而不会相互干扰
  
  return <>{children}</>;
};

export default AuthMonitor;
