# Assessment Generator 日志系统部署脚本 (Windows PowerShell版本)
# 此脚本用于在Windows环境下部署和配置日志管理系统

# 设置错误时停止执行
$ErrorActionPreference = "Stop"

Write-Host "🚀 开始部署 Assessment Generator 日志系统..." -ForegroundColor Green

# 检查必要的工具
Write-Host "📋 检查部署环境..." -ForegroundColor Yellow

# 检查AWS CLI
try {
    aws --version | Out-Null
    Write-Host "✅ AWS CLI 已安装" -ForegroundColor Green
} catch {
    Write-Host "❌ 需要安装 AWS CLI" -ForegroundColor Red
    Write-Host "请访问: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# 检查Node.js和npm
try {
    node --version | Out-Null
    npm --version | Out-Null
    Write-Host "✅ Node.js 和 npm 已安装" -ForegroundColor Green
} catch {
    Write-Host "❌ 需要安装 Node.js 和 npm" -ForegroundColor Red
    Write-Host "请访问: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# 检查AWS凭证
try {
    aws sts get-caller-identity | Out-Null
    Write-Host "✅ AWS 凭证配置正确" -ForegroundColor Green
} catch {
    Write-Host "❌ 请配置AWS凭证" -ForegroundColor Red
    Write-Host "运行: aws configure" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ 环境检查通过" -ForegroundColor Green

# 安装依赖
Write-Host "📦 安装项目依赖..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 项目依赖安装失败" -ForegroundColor Red
    exit 1
}

# 检查并修复CDK版本兼容性
Write-Host "🔄 检查CDK版本兼容性..." -ForegroundColor Yellow
$cdkVersion = npm list aws-cdk-lib --depth=0 2>$null | Select-String "aws-cdk-lib@" | ForEach-Object { ($_ -split "@")[1] }
$cliVersion = npm list aws-cdk --depth=0 2>$null | Select-String "aws-cdk@" | ForEach-Object { ($_ -split "@")[1] }

if ($cdkVersion -and $cliVersion -and $cdkVersion -ne $cliVersion) {
    Write-Host "⚠️ 检测到CDK版本不匹配: CLI=$cliVersion, Lib=$cdkVersion" -ForegroundColor Yellow
    Write-Host "🔧 正在更新CDK CLI版本..." -ForegroundColor Cyan
    npm install aws-cdk@$cdkVersion --save-dev
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ CDK版本更新失败" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ CDK版本已同步" -ForegroundColor Green
}

# 构建前端
Write-Host "🏗️ 构建前端代码..." -ForegroundColor Yellow
Set-Location ui
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 前端依赖安装失败" -ForegroundColor Red
    Set-Location ..
    exit 1
}

npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 前端构建失败" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

# CDK项目不需要单独构建，直接部署
Write-Host "☁️ 部署AWS资源..." -ForegroundColor Yellow

# Bootstrap CDK (如果需要)
Write-Host "🔧 初始化CDK环境..." -ForegroundColor Cyan
npx cdk bootstrap

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ CDK Bootstrap 失败" -ForegroundColor Red
    exit 1
}

# 部署所有栈
Write-Host "🚀 部署CloudFormation栈..." -ForegroundColor Cyan
npx cdk deploy --all --require-approval never

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ CDK 部署失败" -ForegroundColor Red
    exit 1
}

# 获取API端点
Write-Host "🔍 获取部署信息..." -ForegroundColor Yellow

try {
    $ApiUrl = aws cloudformation describe-stacks --stack-name GenAssessStack --query 'Stacks[0].Outputs[?OutputKey==`ApplicationUrl`].OutputValue' --output text

    if ($ApiUrl -and $ApiUrl -ne "None") {
        Write-Host "✅ 部署成功！" -ForegroundColor Green
        Write-Host "📱 应用访问地址: $ApiUrl" -ForegroundColor Cyan
        Write-Host "🔧 日志管理: $ApiUrl/settings/log-management" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️ 未能获取应用地址，请检查CloudFormation输出" -ForegroundColor Yellow
        
        # 尝试从所有栈获取输出
        Write-Host "📋 所有栈输出:" -ForegroundColor Yellow
        aws cloudformation describe-stacks --query 'Stacks[].{StackName:StackName,Outputs:Outputs[].{Key:OutputKey,Value:OutputValue}}' --output table
    }
} catch {
    Write-Host "⚠️ 获取部署信息时出错: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 设置日志订阅（为现有Lambda函数）
Write-Host "🔗 配置日志订阅..." -ForegroundColor Yellow

try {
    # 获取LogAggregator函数ARN
    $LogAggregatorArn = aws cloudformation describe-stacks --stack-name GenAssessStack-LoggingStack --query 'Stacks[0].Outputs[?OutputKey==`LogAggregatorFunctionArn`].OutputValue' --output text

    if ($LogAggregatorArn -and $LogAggregatorArn -ne "None") {
        Write-Host "📋 配置Lambda函数日志订阅..." -ForegroundColor Cyan
        
        # 为主要的Lambda函数设置日志订阅
        $LambdaFunctions = @(
            "gen-assess-stack-QuestionsGenerator",
            "gen-assess-stack-GradeAssessmentFn", 
            "gen-assess-stack-PublishFn"
        )
        
        foreach ($FunctionName in $LambdaFunctions) {
            $LogGroup = "/aws/lambda/$FunctionName"
            
            # 检查日志组是否存在
            try {
                $LogGroupExists = aws logs describe-log-groups --log-group-name-prefix $LogGroup --query 'logGroups[0].logGroupName' --output text 2>$null
                
                if ($LogGroupExists -eq $LogGroup) {
                    Write-Host "  ➤ 为 $FunctionName 配置日志订阅..." -ForegroundColor White
                    
                    # 创建订阅过滤器
                    try {
                        aws logs put-subscription-filter --log-group-name $LogGroup --filter-name "LogAggregatorSubscription" --filter-pattern "" --destination-arn $LogAggregatorArn 2>$null
                    } catch {
                        Write-Host "    ⚠️ 订阅可能已存在" -ForegroundColor Yellow
                    }
                    
                    # 给日志服务调用权限
                    try {
                        $Region = aws configure get region
                        $AccountId = aws sts get-caller-identity --query Account --output text
                        $SourceArn = "arn:aws:logs:${Region}:${AccountId}:log-group:${LogGroup}:*"
                        
                        aws lambda add-permission --function-name $LogAggregatorArn --statement-id "logs-invoke-$FunctionName" --action "lambda:InvokeFunction" --principal "logs.amazonaws.com" --source-arn $SourceArn 2>$null
                    } catch {
                        Write-Host "    ⚠️ 权限可能已存在" -ForegroundColor Yellow
                    }
                } else {
                    Write-Host "  ⚠️ 日志组 $LogGroup 不存在，跳过" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "  ⚠️ 检查日志组 $LogGroup 时出错，跳过" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "⚠️ 未找到LogAggregator函数，请检查部署状态" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ 配置日志订阅时出错: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 日志系统部署完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📚 使用指南:" -ForegroundColor Cyan
if ($ApiUrl) {
    Write-Host "  1. 访问应用: $ApiUrl" -ForegroundColor White
} else {
    Write-Host "  1. 访问应用: 请从CloudFormation输出中获取URL" -ForegroundColor White
}
Write-Host "  2. 以管理员身份登录" -ForegroundColor White
Write-Host "  3. 导航到 '设置' -> '日志管理'" -ForegroundColor White
Write-Host "  4. 开始监控系统日志和性能" -ForegroundColor White
Write-Host ""
Write-Host "🔧 配置说明:" -ForegroundColor Cyan
Write-Host "  - 日志数据保留期: 30天" -ForegroundColor White
Write-Host "  - 系统指标保留期: 90天" -ForegroundColor White
Write-Host "  - 告警阈值: 可在errorAlert.ts中调整" -ForegroundColor White
Write-Host ""
Write-Host "📖 详细文档: 请查看 DEPLOYMENT_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️ 注意: 日志管理功能只对管理员用户开放" -ForegroundColor Yellow

# 暂停以便查看输出
Write-Host ""
Write-Host "按任意键继续..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
