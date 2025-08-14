# Windows 部署快速指南

## 🪟 在Windows PowerShell中部署Assessment Generator日志系统

### 前置要求
确保已安装以下工具：
- [Node.js](https://nodejs.org/) (推荐LTS版本)
- [AWS CLI](https://aws.amazon.com/cli/)
- [Git](https://git-scm.com/)

### 🚀 快速部署

1. **配置AWS凭证**
```powershell
aws configure
# 输入您的AWS Access Key ID、Secret Access Key、Region等信息
```

2. **克隆项目**
```powershell
git clone https://github.com/Carlyyb/aws-assessment-generator.git
cd aws-assessment-generator
```

3. **检查PowerShell执行策略**
```powershell
# 查看当前策略
Get-ExecutionPolicy

# 如果显示"Restricted"，需要调整：
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

4. **运行部署脚本**
```powershell
.\deploy-logging.ps1
```

### 📋 部署过程说明

脚本会自动执行以下步骤：
1. ✅ 检查环境依赖（AWS CLI、Node.js）
2. ✅ 验证AWS凭证配置
3. 📦 安装项目依赖
4. 🏗️ 构建前端应用
5. ☁️ 部署AWS基础设施
6. 🔗 配置日志订阅
7. 📱 输出访问地址

### 🔧 故障排除

**问题1：PowerShell脚本无法执行**
```powershell
# 错误信息：无法加载文件 xxx.ps1，因为在此系统上禁止运行脚本
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

**问题2：AWS凭证未配置**
```powershell
# 重新配置AWS CLI
aws configure
# 或设置环境变量
$env:AWS_ACCESS_KEY_ID="your-key"
$env:AWS_SECRET_ACCESS_KEY="your-secret"
$env:AWS_DEFAULT_REGION="us-east-1"
```

**问题3：CDK Bootstrap失败**
```powershell
# 手动执行bootstrap
npx cdk bootstrap aws://你的账号ID/你的区域
```

**问题4：npm install失败**
```powershell
# 清理缓存重试
npm cache clean --force
npm install
```

### 🎯 部署后验证

1. **检查CloudFormation栈**
   - 登录AWS控制台
   - 进入CloudFormation服务
   - 查看`GenAssessStack`和`GenAssessStack-LoggingStack`状态

2. **访问应用**
   - 使用脚本输出的URL访问应用
   - 创建管理员账户
   - 导航到"设置" → "日志管理"

3. **测试日志功能**
   - 执行一些应用操作（创建课程、生成评估等）
   - 在日志管理页面查看是否有数据

### ⚡ Windows特定优化

**使用Windows Terminal（推荐）**
```powershell
# 安装Windows Terminal获得更好的体验
winget install Microsoft.WindowsTerminal
```

**PowerShell版本检查**
```powershell
# 检查PowerShell版本
$PSVersionTable.PSVersion
# 推荐使用PowerShell 5.1或更高版本
```

**网络代理设置（如需要）**
```powershell
# 如果在企业网络环境中
npm config set proxy http://proxy-server:port
npm config set https-proxy http://proxy-server:port
```

### 📞 获取帮助

如果遇到问题：
1. 查看详细的[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
2. 检查AWS CloudFormation事件日志
3. 查看PowerShell脚本的详细输出信息

---

💡 **提示**: 首次部署可能需要10-15分钟，请耐心等待。部署成功后，您将拥有一个完整的日志管理系统！
