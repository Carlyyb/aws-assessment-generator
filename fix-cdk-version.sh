#!/bin/bash

# CDK版本修复脚本 (Linux/Mac)
# 解决CDK CLI和库版本不匹配问题

set -e

echo "🔧 CDK版本兼容性修复工具"
echo "============================="

# 检查当前CDK版本
echo "📋 检查当前CDK版本..."

# 获取aws-cdk-lib版本
CDK_LIB_VERSION=$(npm list aws-cdk-lib --depth=0 2>/dev/null | grep "aws-cdk-lib@" | sed 's/.*aws-cdk-lib@//' | cut -d' ' -f1)

# 获取aws-cdk版本
CDK_CLI_VERSION=$(npm list aws-cdk --depth=0 2>/dev/null | grep "aws-cdk@" | sed 's/.*aws-cdk@//' | cut -d' ' -f1)

echo "CDK Library版本: $CDK_LIB_VERSION"
echo "CDK CLI版本: $CDK_CLI_VERSION"

if [ -n "$CDK_LIB_VERSION" ] && [ -n "$CDK_CLI_VERSION" ]; then
    if [ "$CDK_LIB_VERSION" = "$CDK_CLI_VERSION" ]; then
        echo "✅ CDK版本已经匹配，无需修复"
        exit 0
    else
        echo "⚠️ 发现版本不匹配！"
        echo "这会导致 'Cloud assembly schema version mismatch' 错误"
        
        # 更新CDK CLI版本以匹配库版本
        echo "🔄 正在更新CDK CLI到版本 $CDK_LIB_VERSION..."
        npm install aws-cdk@$CDK_LIB_VERSION --save-dev
        
        echo "✅ CDK版本修复成功！"
        echo "现在CDK CLI和库版本都是: $CDK_LIB_VERSION"
    fi
else
    echo "❌ 无法检测CDK版本，请确保项目已安装CDK依赖"
    exit 1
fi

echo ""
echo "🎉 CDK版本兼容性问题已解决！"
echo "现在可以正常运行CDK命令了。"
