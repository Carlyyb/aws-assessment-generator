import { useEffect, useRef, useCallback } from 'react';
import { generateClient } from 'aws-amplify/api';
import { updateUserActivityMutation } from '../graphql/mutations';
import { useAuthenticator } from '@aws-amplify/ui-react';

const client = generateClient();

/**
 * 用户活跃度跟踪 Hook
 * 每5分钟更新一次用户的最后活跃时间
 */
export const useUserActivityTracker = () => {
  const { user } = useAuthenticator();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);

  // 更新用户活跃状态
  const updateUserActivity = useCallback(async () => {
    if (!user?.username) {
      console.warn('用户未登录，跳过活跃度更新');
      return;
    }

    try {
      // 简化角色获取，使用默认角色或从用户名推断
      // 这里可以根据实际需求调整角色判断逻辑
      const role = 'students'; // 临时使用默认角色，后续可以优化

      const response = await client.graphql({
        query: updateUserActivityMutation,
        variables: {
          username: user.username,
          role: role
        }
      });

      // 处理响应结果
      if ('data' in response && response.data?.updateUserActivity) {
        const result = response.data.updateUserActivity;
        
        if (result.success) {
          //console.log('用户活跃度更新成功:', {
          //  username: user.username,
          //  lastLoginAt: result.lastLoginAt
          //});
        } else {
          console.warn('用户活跃度更新失败:', result);
        }
      }
    } catch (error) {
      console.error('更新用户活跃度时发生错误:', error);
    }
  }, [user]);

  // 页面可见性变化处理
  const handleVisibilityChange = useCallback(() => {
    isActiveRef.current = !document.hidden;
    
    if (isActiveRef.current) {
      // 页面变为可见时，立即更新一次活跃度
      updateUserActivity();
      
      // 重新启动定时器
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      intervalRef.current = setInterval(updateUserActivity, 5 * 60 * 1000); // 5分钟
    } else {
      // 页面隐藏时，清除定时器
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [updateUserActivity]);

  // 用户活动检测（鼠标移动、键盘输入等）
  const handleUserActivity = useCallback(() => {
    // 如果页面不可见，不处理用户活动
    if (!isActiveRef.current) return;
    
    // 这里可以添加防抖逻辑，避免过于频繁的更新
    // 现在暂时不做额外处理，依赖定时器
  }, []);

  useEffect(() => {
    if (!user?.username) return;

    // 初始化时立即更新一次
    updateUserActivity();

    // 启动定时器
    intervalRef.current = setInterval(updateUserActivity, 5 * 60 * 1000); // 5分钟

    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 监听用户活动（可选，用于后续扩展）
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });

    // 清理函数
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity);
      });
    };
  }, [user?.username, updateUserActivity, handleVisibilityChange, handleUserActivity]);

  // 手动触发活跃度更新（供外部调用）
  const triggerActivityUpdate = useCallback(() => {
    updateUserActivity();
  }, [updateUserActivity]);

  return {
    triggerActivityUpdate
  };
};
