#!/bin/bash

# Assessment Generator 日志系统部署脚本
# 此脚本用于部署和配置日志管理系统

set -e

echo "🚀 开始部署 Assessment Generator 日志系统..."

# 检查必要的工具
echo "📋 检查部署环境..."
command -v aws >/dev/null 2>&1 || { echo "❌ 需要安装 AWS CLI"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ 需要安装 Node.js 和 npm"; exit 1; }

# 检查AWS凭证
aws sts get-caller-identity >/dev/null 2>&1 || { echo "❌ 请配置AWS凭证"; exit 1; }

echo "✅ 环境检查通过"

# 安装依赖
echo "📦 安装项目依赖..."
npm install

# 构建前端
echo "🏗️ 构建前端代码..."
cd ui
npm install
npm run build
cd ..

# CDK项目不需要单独构建，直接部署
echo "☁️ 部署AWS资源..."
npx cdk bootstrap
npx cdk deploy --all --require-approval never

# 获取API端点
echo "🔍 获取部署信息..."
API_URL=$(aws cloudformation describe-stacks \
  --stack-name GenAssessStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApplicationUrl`].OutputValue' \
  --output text)

if [ -n "$API_URL" ]; then
  echo "✅ 部署成功！"
  echo "📱 应用访问地址: $API_URL"
  echo "🔧 日志管理: $API_URL/settings/log-management"
else
  echo "⚠️ 未能获取应用地址，请检查CloudFormation输出"
fi

# 设置日志订阅（为现有Lambda函数）
echo "🔗 配置日志订阅..."

# 获取LogAggregator函数ARN
LOG_AGGREGATOR_ARN=$(aws cloudformation describe-stacks \
  --stack-name GenAssessStack-LoggingStack \
  --query 'Stacks[0].Outputs[?OutputKey==`LogAggregatorFunctionArn`].OutputValue' \
  --output text)

if [ -n "$LOG_AGGREGATOR_ARN" ]; then
  echo "📋 配置Lambda函数日志订阅..."
  
  # 为主要的Lambda函数设置日志订阅
  LAMBDA_FUNCTIONS=(
    "gen-assess-stack-QuestionsGenerator"
    "gen-assess-stack-GradeAssessmentFn"
    "gen-assess-stack-PublishFn"
  )
  
  for FUNCTION_NAME in "${LAMBDA_FUNCTIONS[@]}"; do
    LOG_GROUP="/aws/lambda/$FUNCTION_NAME"
    
    # 检查日志组是否存在
    if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --query 'logGroups[0].logGroupName' --output text 2>/dev/null | grep -q "$LOG_GROUP"; then
      echo "  ➤ 为 $FUNCTION_NAME 配置日志订阅..."
      
      # 创建订阅过滤器
      aws logs put-subscription-filter \
        --log-group-name "$LOG_GROUP" \
        --filter-name "LogAggregatorSubscription" \
        --filter-pattern "" \
        --destination-arn "$LOG_AGGREGATOR_ARN" 2>/dev/null || echo "    ⚠️ 订阅可能已存在"
      
      # 给日志服务调用权限
      aws lambda add-permission \
        --function-name "$LOG_AGGREGATOR_ARN" \
        --statement-id "logs-invoke-$FUNCTION_NAME" \
        --action "lambda:InvokeFunction" \
        --principal "logs.amazonaws.com" \
        --source-arn "arn:aws:logs:$(aws configure get region):$(aws sts get-caller-identity --query Account --output text):log-group:$LOG_GROUP:*" 2>/dev/null || echo "    ⚠️ 权限可能已存在"
    else
      echo "  ⚠️ 日志组 $LOG_GROUP 不存在，跳过"
    fi
  done
else
  echo "⚠️ 未找到LogAggregator函数，请检查部署状态"
fi

echo ""
echo "🎉 日志系统部署完成！"
echo ""
echo "📚 使用指南:"
echo "  1. 访问应用: $API_URL"
echo "  2. 以管理员身份登录"
echo "  3. 导航到 '设置' -> '日志管理'"
echo "  4. 开始监控系统日志和性能"
echo ""
echo "🔧 配置说明:"
echo "  - 日志数据保留期: 30天"
echo "  - 系统指标保留期: 90天"
echo "  - 告警阈值: 可在errorAlert.ts中调整"
echo ""
echo "📖 详细文档: 请查看 LOG_SYSTEM_README.md"
echo ""
echo "⚠️ 注意: 日志管理功能只对管理员用户开放"
