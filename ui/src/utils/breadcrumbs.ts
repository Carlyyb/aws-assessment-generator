import { getText } from '../i18n/lang';

export interface BreadcrumbItem {
  text: string;
  href: string;
}

/**
 * 根据当前路径生成面包屑导航项
 */
export function generateBreadcrumbs(pathname: string, getOverride?: (path: string) => string | null): BreadcrumbItem[] {
  // 确保总是返回至少包含首页的数组
  const breadcrumbs: BreadcrumbItem[] = [
    { text: getText('common.breadcrumb.home'), href: '/' }
  ];

  // 安全检查 pathname
  if (!pathname || typeof pathname !== 'string') {
    return breadcrumbs;
  }

  // 特殊处理编辑测试页面，让其面包屑路径为：首页 > 查找测试 > 测试名
  if (pathname.startsWith('/edit-assessment/')) {
    // 添加查找测试页面到面包屑
    breadcrumbs.push({
      text: getText('common.nav.find-assessments'),
      href: '/assessments/find-assessments'
    });
    const testName = getText('teachers.assessments.edit.current');
    breadcrumbs.push({
      text: testName,
      href: pathname
    });
    return breadcrumbs;
  }

  // 移除开头的斜杠并分割路径
  const pathSegments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  
  if (pathSegments.length === 0) {
    // 在首页时只显示首页
    return breadcrumbs;
  }

  let currentPath = '';
  
  try {
    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      
      // 安全检查 segment
      if (!segment || typeof segment !== 'string') {
        continue;
      }
      
      currentPath += `/${segment}`;
      
      // 跳过动态路由参数（如 :id）
      if (segment.match(/^[a-f0-9-]{36}$/) || segment.match(/^\d+$/)) {
        // 这是一个 ID 参数，显示为具体的内容标识
        const overrideTitle = getOverride?.(currentPath);
        const displayName = overrideTitle || getSegmentDisplayName(segment, pathSegments, i);
        breadcrumbs.push({
          text: displayName,
          href: currentPath
        });
      } else {
        // 普通路径段
        const overrideTitle = getOverride?.(currentPath);
        const displayName = overrideTitle || getNavigationText(segment);
        breadcrumbs.push({
          text: displayName,
          href: currentPath
        });
      }
    }
  } catch (error) {
    console.warn('Error generating breadcrumbs:', error);
    // 如果出现错误，至少返回首页
    return breadcrumbs;
  }

  return breadcrumbs;
}

/**
 * 获取路径段的显示名称
 */
function getNavigationText(segment: string): string {
  // 处理特殊路径
  switch (segment) {
    case 'edit-assessment':
      // 编辑测试页面应该显示为"查找测试"而不是"编辑测试"
      return getText('common.nav.find-assessments');
    case 'assessment':
      return getText('students.assessment.title');
    case 'review':
      return getText('students.review.title');
    default:
      // 尝试从导航翻译中获取
      const navKey = `common.nav.${segment}`;
      const navText = getText(navKey);
      
      // 如果翻译存在且不等于键名，返回翻译；否则使用格式化的段名
      if (navText && navText !== navKey) {
        return navText;
      }
      
      // 格式化段名：将连字符替换为空格，首字母大写
      return segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
  }
}

/**
 * 获取动态参数的显示名称
 */
function getSegmentDisplayName(segment: string, pathSegments: string[], index: number): string {
  // 安全检查
  if (!pathSegments || !Array.isArray(pathSegments) || index <= 0) {
    return `#${segment.substring(0, 8)}...`;
  }
  
  const previousSegment = pathSegments[index - 1];
  
  if (!previousSegment) {
    return `#${segment.substring(0, 8)}...`;
  }
  
  switch (previousSegment) {
    case 'assessment':
      return getText('students.assessment.current');
    case 'edit-assessment':
      return getText('teachers.assessments.edit.current');
    case 'review':
      return getText('students.review.current');
    default:
      return `#${segment.substring(0, 8)}...`; // 显示 ID 的前8位
  }
}

/**
 * 检查当前路径是否为指定的页面
 */
export function isCurrentPage(pathname: string, pagePath: string): boolean {
  return pathname === pagePath || pathname.startsWith(`${pagePath}/`);
}
