# 选择性部署指南（加速版）

本项目支持按“子栈”精确部署，结合 hotswap 和前端直传，大幅缩短迭代时间。

- 顶层栈：GenAssessStack
- 子栈（NestedStack）：
  - AuthStack（鉴权：Cognito + 触发器）
  - DataStack（数据/API：AppSync + DynamoDB + Resolver + Lambda）
  - FrontendStack（前端：S3 + CloudFront）
  - LoggingStack（日志：日志表、聚合与查询 Lambda）
  - RagStack（RAG 知识库流水线）

推荐使用仓库根目录的脚本：`selective-deploy.ps1`

## 快速开始

交互式：

```powershell
./selective-deploy.ps1
```

根据菜单选择 Action（Diff/Deploy/Watch/FrontendUpload）和子栈后自动执行。

常用示例：

```powershell
# 只部署 DataStack（常规部署）
./selective-deploy.ps1 -Action Deploy -Stack DataStack

# 只部署 DataStack（仅改 Lambda 代码时，hotswap 极快）
./selective-deploy.ps1 -Action Deploy -Stack DataStack -Hotswap

# 仅预览变化（不部署）
./selective-deploy.ps1 -Action Diff -Stack DataStack

# 持续监听 + hotswap（开发期）
./selective-deploy.ps1 -Action Watch -Stack DataStack -Hotswap

# 前端静态资源直传（绕过 CFN，秒级发布）
./selective-deploy.ps1 -Action FrontendUpload
```

> 默认附带 `--require-approval never`。如需禁用该默认行为：追加 `-NoRequireApproval`。

## 参数说明

- `-Action`：Diff | Deploy | Watch | FrontendUpload
- `-Stack`：AuthStack | DataStack | FrontendStack | LoggingStack | RagStack | All（顶层栈）
- `-Hotswap`：在 Deploy/Watch 下启用 `--hotswap --hotswap-fallback`（仅修改 Lambda 代码/支持 hotswap 的变更时使用）
- `-Profile`：指定 AWS Profile（可选）
- `-Region`：指定区域（可选，脚本会设置 AWS_REGION/AWS_DEFAULT_REGION）
- `-NoRequireApproval`：移除 `--require-approval never`（可选）
- `-ExtraArgs`：传递给 cdk 的其他参数数组（可选）

## 常见场景与最佳实践

- 仅改 Lambda 代码（Data/Logging/Rag 子栈内）：
  - 优先用 hotswap，秒级下发。
  - 示例：`./selective-deploy.ps1 -Action Deploy -Stack DataStack -Hotswap`

- 修改 AppSync schema / resolver：
  - 只发 DataStack，需要 CloudFormation 更新。
  - 示例：`./selective-deploy.ps1 -Action Deploy -Stack DataStack`

- 仅改前端 UI：
  - 使用 FrontendUpload（调用 `quick-frontend-deploy.ps1`），绕过 CloudFormation。
  - 示例：`./selective-deploy.ps1 -Action FrontendUpload`

- 仅改 Cognito 配置/触发器：
  - 只发 AuthStack。
  - 示例：`./selective-deploy.ps1 -Action Deploy -Stack AuthStack`

- 仅改日志聚合/查询 Lambda：
  - 只发 LoggingStack；若仅 Lambda 代码，配合 `-Hotswap` 更快。

- 仅改 RAG 管道：
  - 只发 RagStack。

## 何时需要全量（All）

- 跨子栈的导出/引用变更（例如跨栈构造引用、SSM 参数新依赖）
- 基础设施大改（如 CloudFront 域名/DNS）

此时可分步骤部署多个子栈，尽量缩小范围；确实需要时再 `All`。

## 故障排查

- CDK 失败：先 `-Action Diff` 看差异与报错；必要时去 AWS 控制台的 CloudFormation 查看事件详情。
- Hotswap 未生效：说明变更不是纯代码或不被 hotswap 支持；改用常规 Deploy。
- 前端更新未生效：检查 CloudFront 缓存；`quick-frontend-deploy.ps1` 已包含必要的失效处理。

## 附：等价的原生命令

若不使用脚本，你也可以直接执行（示例）：

```powershell
# 仅部署数据层
npx cdk deploy "GenAssessStack/DataStack" --require-approval never

# 仅部署数据层（hotswap）
npx cdk deploy "GenAssessStack/DataStack" --hotswap --hotswap-fallback --require-approval never

# 仅预览差异
npx cdk diff "GenAssessStack/DataStack"

# 前端直传（不经 CFN）
./quick-frontend-deploy.ps1
```

---
如需将脚本扩展为“多环境/多账户”的预设菜单、或加入一键多栈顺序部署，请告知约束（账户、Region、命名规范），我可继续完善。
