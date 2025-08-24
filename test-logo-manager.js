/**
 * Logo Manager 测试脚本
 * 用于验证S3-based Logo管理系统的功能
 */

import { logoManager } from '../ui/src/utils/logoManager';

async function testLogoManager() {
  console.log('🧪 开始测试 Logo Manager...');

  try {
    // 1. 检查当前logo状态
    console.log('\n1. 检查当前logo状态:');
    const hasLogo = await logoManager.hasCurrentLogo();
    console.log('  有当前logo:', hasLogo);

    if (hasLogo) {
      const logoInfo = await logoManager.getLogoInfo();
      console.log('  当前logo信息:', logoInfo);
      
      const logoUrl = await logoManager.getCurrentLogoUrl();
      console.log('  当前logo URL:', logoUrl.substring(0, 100) + '...');
    }

    // 2. 测试删除功能（如果有logo）
    if (hasLogo) {
      console.log('\n2. 测试删除当前logo:');
      await logoManager.deleteCurrentLogo();
      console.log('  ✅ Logo删除成功');
      
      const hasLogoAfterDelete = await logoManager.hasCurrentLogo();
      console.log('  删除后状态:', hasLogoAfterDelete);
    }

    // 3. 测试URL上传功能
    console.log('\n3. 测试从URL上传logo:');
    const testImageUrl = 'https://via.placeholder.com/200x50/0073bb/ffffff?text=TEST+LOGO';
    
    try {
      const uploadedUrl = await logoManager.uploadGlobalLogoFromUrl(testImageUrl);
      console.log('  ✅ URL上传成功:', uploadedUrl.substring(0, 100) + '...');
      
      // 验证上传后的状态
      const hasLogoAfterUpload = await logoManager.hasCurrentLogo();
      console.log('  上传后状态:', hasLogoAfterUpload);
      
      const logoInfoAfterUpload = await logoManager.getLogoInfo();
      console.log('  上传后logo信息:', logoInfoAfterUpload);
    } catch (uploadError) {
      console.error('  ❌ URL上传失败:', uploadError);
    }

    console.log('\n🎉 Logo Manager 测试完成!');

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 注释掉自动执行，因为这需要在有Amplify配置的环境中运行
// testLogoManager();

export { testLogoManager };
