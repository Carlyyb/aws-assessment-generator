# CDK版本修复脚本 (Windows PowerShell)
# 解决CDK CLI和库版本不匹配问题

$ErrorActionPreference = "Stop"

Write-Host "🔧 CDK版本兼容性修复工具" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green

# 检查当前CDK版本
Write-Host "📋 检查当前CDK版本..." -ForegroundColor Yellow

try {
    # 获取aws-cdk-lib版本
    $cdkLibOutput = npm list aws-cdk-lib --depth=0 2>$null
    $cdkLibVersion = if ($cdkLibOutput -match "aws-cdk-lib@([\d\.]+)") { $matches[1] } else { $null }
    
    # 获取aws-cdk版本  
    $cdkCliOutput = npm list aws-cdk --depth=0 2>$null
    $cdkCliVersion = if ($cdkCliOutput -match "aws-cdk@([\d\.]+)") { $matches[1] } else { $null }
    
    Write-Host "CDK Library版本: $cdkLibVersion" -ForegroundColor Cyan
    Write-Host "CDK CLI版本: $cdkCliVersion" -ForegroundColor Cyan
    
    if ($cdkLibVersion -and $cdkCliVersion) {
        if ($cdkLibVersion -eq $cdkCliVersion) {
            Write-Host "✅ CDK版本已经匹配，无需修复" -ForegroundColor Green
            exit 0
        } else {
            Write-Host "⚠️ 发现版本不匹配！" -ForegroundColor Yellow
            Write-Host "这会导致 'Cloud assembly schema version mismatch' 错误" -ForegroundColor Yellow
            
            # 更新CDK CLI版本以匹配库版本
            Write-Host "🔄 正在更新CDK CLI到版本 $cdkLibVersion..." -ForegroundColor Cyan
            npm install aws-cdk@$cdkLibVersion --save-dev
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ CDK版本修复成功！" -ForegroundColor Green
                Write-Host "现在CDK CLI和库版本都是: $cdkLibVersion" -ForegroundColor Green
            } else {
                Write-Host "❌ CDK版本更新失败" -ForegroundColor Red
                exit 1
            }
        }
    } else {
        Write-Host "❌ 无法检测CDK版本，请确保项目已安装CDK依赖" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ 检查CDK版本时出错: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 CDK版本兼容性问题已解决！" -ForegroundColor Green
Write-Host "现在可以正常运行CDK命令了。" -ForegroundColor White
