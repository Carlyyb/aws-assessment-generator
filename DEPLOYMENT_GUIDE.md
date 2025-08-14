# 快速部署指南

## 🚀 部署日志系统

### 方法1：使用部署脚本（推荐）

```bash
# 给脚本添加执行权限
chmod +x deploy-logging.sh

# 运行部署脚本
./deploy-logging.sh
```

### 方法2：手动部署

```bash
# 1. 安装根目录依赖
npm install

# 2. 构建前端
cd ui
npm install
npm run build
cd ..

# 3. 部署CDK（会自动编译TypeScript）
npx cdk bootstrap
npx cdk deploy --all --require-approval never
```

## 🔧 部署后配置

部署完成后，系统会自动输出访问地址。日志管理功能位于：
- **路径**: 设置 > 日志管理
- **URL**: `https://your-app-url/settings/log-management`

## ⚠️ 常见问题

### 1. CDK Bootstrap 错误
如果首次使用CDK，可能需要先运行：
```bash
npx cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

### 2. 权限问题
确保AWS凭证有以下权限：
- CloudFormation
- Lambda
- DynamoDB
- CloudWatch
- S3

### 3. 构建错误
如果遇到TypeScript错误，运行：
```bash
npm run build
```
查看具体错误信息。

## 📊 验证部署

1. **检查CloudFormation**: AWS控制台 > CloudFormation
2. **查看Lambda函数**: AWS控制台 > Lambda
3. **访问应用**: 使用输出的URL访问系统
4. **测试日志**: 触发几个操作，然后在日志管理页面查看数据

## 💰 成本预估

- **小型系统**: $8-15/月
- **中型系统**: $15-35/月  
- **大型系统**: $30-70/月

主要成本来源：DynamoDB存储、Lambda调用、CloudWatch日志

---

**注意**: 确保只有管理员用户才能访问日志管理功能。
