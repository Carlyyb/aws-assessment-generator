/**
 * 前端时间工具函数 - 统一使用UTC+8（北京时间）
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * 获取当前UTC+8时间的ISO字符串
 * @returns 北京时间的ISO字符串
 */
export function getCurrentBeijingTime(): string {
  const now = new Date();
  // 转换为UTC+8时间
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString();
}

/**
 * 将UTC时间转换为北京时间
 * @param utcTime UTC时间字符串或Date对象
 * @returns 北京时间的Date对象
 */
export function utcToBeijingTime(utcTime: string | Date): Date {
  const date = typeof utcTime === 'string' ? new Date(utcTime) : utcTime;
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
}

/**
 * 将北京时间转换为UTC时间
 * @param beijingTime 北京时间字符串或Date对象
 * @returns UTC时间的Date对象
 */
export function beijingTimeToUtc(beijingTime: string | Date): Date {
  const date = typeof beijingTime === 'string' ? new Date(beijingTime) : beijingTime;
  return new Date(date.getTime() - 8 * 60 * 60 * 1000);
}

/**
 * 格式化北京时间为本地显示字符串
 * @param time 时间字符串或Date对象
 * @param options 格式化选项
 * @returns 格式化后的时间字符串
 */
export function formatBeijingTime(
  time: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai'
  }
): string {
  const date = typeof time === 'string' ? new Date(time) : time;
  return date.toLocaleString('zh-CN', options);
}

/**
 * 获取北京时间的日期部分（YYYY-MM-DD格式）
 * @param time 时间字符串或Date对象，如果不提供则使用当前时间
 * @returns YYYY-MM-DD格式的日期字符串
 */
export function getBeijingDateString(time?: string | Date): string {
  const date = time ? (typeof time === 'string' ? new Date(time) : time) : new Date();
  const beijingTime = utcToBeijingTime(date);
  return beijingTime.toISOString().split('T')[0];
}

/**
 * 获取北京时间的时间部分（HH:mm格式）
 * @param time 时间字符串或Date对象，如果不提供则使用当前时间
 * @returns HH:mm格式的时间字符串
 */
export function getBeijingTimeString(time?: string | Date): string {
  const date = time ? (typeof time === 'string' ? new Date(time) : time) : new Date();
  const beijingTime = utcToBeijingTime(date);
  return beijingTime.toISOString().substr(11, 5);
}

/**
 * 组合日期和时间为北京时间的ISO字符串
 * @param date 日期字符串（YYYY-MM-DD格式）
 * @param time 时间字符串（HH:mm格式）
 * @returns 北京时间的ISO字符串
 */
export function combineBeijingDateTime(date: string, time: string): string {
  const beijingDateTime = `${date}T${time}:00+08:00`;
  return new Date(beijingDateTime).toISOString();
}

/**
 * 创建带时区信息的时间戳（用于数据库存储）
 * @param time 时间字符串或Date对象，如果不提供则使用当前时间
 * @returns 带时区信息的ISO字符串
 */
export function createTimestamp(time?: string | Date): string {
  if (time) {
    const date = typeof time === 'string' ? new Date(time) : time;
    return date.toISOString();
  }
  return getCurrentBeijingTime();
}

/**
 * 比较两个时间（考虑时区）
 * @param time1 第一个时间
 * @param time2 第二个时间
 * @returns time1 - time2 的毫秒差值
 */
export function compareBeijingTime(time1: string | Date, time2: string | Date): number {
  const date1 = typeof time1 === 'string' ? new Date(time1) : time1;
  const date2 = typeof time2 === 'string' ? new Date(time2) : time2;
  return date1.getTime() - date2.getTime();
}

/**
 * 检查时间是否在指定范围内（北京时间）
 * @param timeToCheck 要检查的时间
 * @param startTime 开始时间
 * @param endTime 结束时间
 * @returns 是否在范围内
 */
export function isTimeInRange(
  timeToCheck: string | Date,
  startTime: string | Date,
  endTime: string | Date
): boolean {
  const check = typeof timeToCheck === 'string' ? new Date(timeToCheck) : timeToCheck;
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
  
  return check.getTime() >= start.getTime() && check.getTime() <= end.getTime();
}

/**
 * 格式化相对时间显示（如：今天、昨天、3天前）
 * @param time 要格式化的时间
 * @returns 相对时间字符串
 */
export function formatRelativeTime(time: string | Date): string {
  const date = typeof time === 'string' ? new Date(time) : time;
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
  
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  return formatBeijingTime(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai'
  });
}

/**
 * 格式化时间为本地字符串（考虑时区）
 * @param time 时间字符串或Date对象
 * @returns 本地化的时间字符串
 */
export function toLocaleDateString(time: string | Date): string {
  const date = typeof time === 'string' ? new Date(time) : time;
  return formatBeijingTime(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai'
  });
}
