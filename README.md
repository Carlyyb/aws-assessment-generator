
---

### 从0开始使用 Git 和 VSCode 克隆并预览项目

#### 第一步：安装 Git 和 VSCode
1. **安装 Git**  
   - 访问 [Git 官方网站](https://git-scm.com/)，下载并安装适合你操作系统的版本。
   
2. **安装 VSCode**  
   - 访问 [VSCode 官网](https://code.visualstudio.com/)，下载并安装 VSCode。

#### 第二步：配置 Git（第一次使用时需要配置）
1. 打开终端（Terminal）或 Git Bash（Windows 用户）。
2. 输入以下命令来配置你的 Git 用户名和邮箱：

   ```bash
   git config --global user.name "你的名字"
   git config --global user.email "你的邮箱@example.com"
   ```

   配置好后，Git 会知道你的身份，确保后续的提交都是你的。

#### 第三步：克隆项目
1. 打开 VSCode。
2. 点击 **终端 (Terminal)** > **新建终端 (New Terminal)**。
3. 在 VSCode 中的终端输入以下命令来克隆项目：

   ```bash
   git clone https://github.com/Carlyyb/aws-assessment-generator.git
   ```

   这会把仓库里的代码下载到你的本地计算机。

#### 第四步：打开项目
1. 克隆完成后，项目会出现在你终端所在的目录下。
2. 在 VSCode 中，点击 **文件 (File)** > **打开文件夹 (Open Folder)**，然后选择刚才克隆下来的项目文件夹（`aws-assessment-generator` 文件夹）。




Assessment Generator is a sample application generating assessment questions for a provided reference material and lecture note(s).

## Features Overview

Key features (Teacher)

- Course addition: Teacher can add a new course
- Assessment template creation: Teacher can define an assessment set with the number of questions for each level (easy, medium, hard)
- Manage knowledge base: Teacher can upload reference material for a pre-defined course
- Generate assessments: Teacher can generate assessments by using a predefined assessment template and course.
- **Log Management**: Admin users can view system logs, monitor performance metrics, and track errors in real-time through a dedicated dashboard.

Short clip depicting the teacher journey

https://github.com/aws-samples/assessment-generator/assets/5655093/d4b135a2-5b89-492e-8296-8038ac1b3c1d

Key features (Student)

- Assessments: Start and reviews assessment

Short clip depicting the student journey

https://github.com/aws-samples/assessment-generator/assets/5655093/706730e0-b167-4bd2-aa35-ce82e908a7aa

## Architecture

The architecture can be split into 4 key blocks:

- Front-end architecture
- Document ingestion architecture
- Assessment generator architecture
- **Logging and monitoring architecture**

Architecture diagrams depicting key components in those blocks are provided below:

![Front-end architecture](https://github.com/aws-samples/assessment-generator/blob/main/media/Arch-Front-End.png)

![Document ingestion architecture](https://github.com/aws-samples/assessment-generator/blob/main/media/Arch-Document-Ingestion.png)

![Assessment generator architecture](https://github.com/aws-samples/assessment-generator/blob/main/media/Arch-Assessment-Generator.png)

## Prerequisites

Ensure you have the following installed:

- Node and npm
- Docker
- CDK

Request model access on Amazon Bedrock for the following:

- Amazon Titan Embeddings G1 - Text
- Amazon Nova Lite

## Deployment

To deploy this project in your own AWS account, ensure your AWS region is set to the same region where you have Bedrock Model access.

### Standard Deployment
Run the following commands:

```bash
git clone git@github.com:aws-samples/assessment-generator.git
cd assessment-generator
npm ci
npx cdk bootstrap --qualifier gen-assess
npm run cdk deploy
```

### Deployment with Logging System
To deploy with the comprehensive logging and monitoring system:

**Windows PowerShell:**
```powershell
git clone git@github.com:aws-samples/assessment-generator.git
cd assessment-generator
npm ci
npx cdk bootstrap --qualifier gen-assess
.\deploy-logging.ps1
```

**Linux/Mac:**
```bash
git clone git@github.com:aws-samples/assessment-generator.git
cd assessment-generator
npm ci
npx cdk bootstrap --qualifier gen-assess
chmod +x deploy-logging.sh
./deploy-logging.sh
```

Or see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

After successfully deploying, you will be able to access the Frontend UI with the CloudFront URL in the CDK outputs.

### Post-Deployment Setup
Next:

1. Create an account for student using the frontend with "Create Account" tab and Role as "students"
2. Create an account for teacher using the frontend with "Create Account" tab and Role as "teachers"
3. For teacher journey: Login with the created teacher account
4. For student journey: Login with the created student account
5. **For log management**: Admin users can access log management through "Settings > Log Management" in the dashboard

### Log Management Features
- **Real-time Monitoring**: View system performance and health metrics
- **Error Tracking**: Monitor and analyze system errors and exceptions
- **Log Analytics**: Search and filter logs by timestamp, level, and service
- **Cost Optimization**: Automatic log retention with TTL to control storage costs

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
