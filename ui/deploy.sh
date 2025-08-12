#!/bin/bash

# 确保我们在正确的目录
cd "$(dirname "$0")"

# 安装依赖
echo "Installing dependencies..."
npm install

# 构建前端
echo "Building frontend..."
npm run build

# 获取 AWS 资源信息
API_ENDPOINT=$(aws cloudformation describe-stacks --stack-name YourStackName --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name YourStackName --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name YourStackName --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)

# 替换环境变量
echo "Updating environment variables..."
sed -i "s|\${API_ENDPOINT}|$API_ENDPOINT|g" .env.production
sed -i "s|\${USER_POOL_ID}|$USER_POOL_ID|g" .env.production
sed -i "s|\${USER_POOL_CLIENT_ID}|$USER_POOL_CLIENT_ID|g" .env.production

# 部署到 S3
echo "Deploying to S3..."
aws s3 sync dist/ s3://your-bucket-name/ --delete

# 清理 CloudFront 缓存（如果使用了 CloudFront）
# aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"

echo "Deployment complete!"
