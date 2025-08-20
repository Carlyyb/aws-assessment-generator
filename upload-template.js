#!/usr/bin/env node

/**
 * S3上传脚本：将Template.xlsx上传到S3
 * 运行方式: node upload-template.js
 */

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// AWS配置（使用环境变量或AWS配置文件）
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-west-2'
});

// S3桶名（需要替换为实际的桶名）
const BUCKET_NAME = process.env.S3_BUCKET || 'your-s3-bucket-name';
const TEMPLATE_KEY = 'public/template/Template.xlsx';

async function uploadTemplate() {
  try {
    const templatePath = path.join(__dirname, 'Template.xlsx');
    
    if (!fs.existsSync(templatePath)) {
      console.error('Template.xlsx 文件不存在，请确保文件在项目根目录');
      process.exit(1);
    }

    const fileContent = fs.readFileSync(templatePath);
    
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: TEMPLATE_KEY,
      Body: fileContent,
      ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ACL: 'public-read' // 允许公共读取
    };

    console.log('正在上传 Template.xlsx 到 S3...');
    const result = await s3.upload(uploadParams).promise();
    
    console.log('上传成功！');
    console.log('文件URL:', result.Location);
    console.log('请将此URL更新到前端代码中');
    
  } catch (error) {
    console.error('上传失败:', error);
    process.exit(1);
  }
}

uploadTemplate();
