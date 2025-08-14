# 快速部署指南

## 🚀 部署日志系统

### 方法1：使用Windows PowerShell部署脚本（推荐Windows用户）

```powershell
# 运行PowerShell部署脚本
.\deploy-logging.ps1
```

### 方法2：使用Linux/Mac Bash部署脚本

```bash
# 给脚本添加执行权限
chmod +x deploy-logging.sh

# 运行部署脚本
./deploy-logging.sh
```

### 方法3：手动部署（跨平台）

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

### 1. CDK版本兼容性错误
如果遇到 "Cloud assembly schema version mismatch" 错误，说明CDK CLI和库版本不匹配：

**Windows PowerShell 快速修复：**
```powershell
.\fix-cdk-version.ps1
```

**Linux/Mac 快速修复：**
```bash
chmod +x fix-cdk-version.sh
./fix-cdk-version.sh
```

**手动修复：**
```bash
# 检查版本
npm list aws-cdk aws-cdk-lib

# 更新CDK CLI版本以匹配库版本
npm install aws-cdk@$(npm list aws-cdk-lib --depth=0 | grep "aws-cdk-lib@" | sed 's/.*aws-cdk-lib@//' | cut -d' ' -f1) --save-dev
```

### 2. Windows PowerShell执行策略
如果PowerShell脚本无法执行，可能需要调整执行策略：
```powershell
# 查看当前执行策略
Get-ExecutionPolicy

# 临时允许执行脚本（推荐）
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

# 或者为当前用户永久设置
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. CDK Bootstrap 错误
如果首次使用CDK，可能需要先运行：
```bash
npx cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

### 3. 权限问题
确保AWS凭证有以下权限：
- CloudFormation
- Lambda
- DynamoDB
- CloudWatch
- S3

### 4. 构建错误
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
