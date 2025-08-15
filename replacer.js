const fs = require('fs');
const path = require('path');

class I18nTextReplacer {
  constructor(srcPath = './ui/src') {
    this.srcPath = srcPath;
    this.replacements = new Map();
    this.initializeReplacements();
  }

  initializeReplacements() {
    // 定义文本替换映射 - 只包含用户可见的UI文本
    const textMappings = {
      // 通用文本
      '"Loading list..."': 'getLangResource("common.loading")',
      '"Error"': 'getLangResource("common.error")',
      '"Cancel"': 'getLangResource("common.cancel")',
      '"Previous"': 'getLangResource("common.previous")',
      '"Next"': 'getLangResource("common.next")',
      '"Submit"': 'getLangResource("common.submit")',
      '"Finish"': 'getLangResource("common.finish")',
      '"Start"': 'getLangResource("common.start")',
      '"Review"': 'getLangResource("common.review")',
      '"optional"': 'getLangResource("common.optional")',
      '"Name"': 'getLangResource("common.name")',
      '"Course"': 'getLangResource("common.course")',
      '"Action"': 'getLangResource("common.action")',
      '"Score"': 'getLangResource("common.score")',
      '"Deadline"': 'getLangResource("common.deadline")',
      '"Status"': 'getLangResource("common.status")',
      '"Edit"': 'getLangResource("common.edit")',
      '"Publish"': 'getLangResource("common.publish")',
      '"Published"': 'getLangResource("common.published")',
      '"Points"': 'getLangResource("common.points")',
      '"point"': 'getLangResource("common.point")',
      '"Description"': 'getLangResource("common.description")',
      '"Choose files"': 'getLangResource("common.choose_files")',
      '"Choose file"': 'getLangResource("common.choose_file")',
      '"Drop files to upload"': 'getLangResource("common.drop_files_to_upload")',
      '"Drop file to upload"': 'getLangResource("common.drop_file_to_upload")',
      '"Show fewer files"': 'getLangResource("common.show_fewer_files")',
      '"Show more files"': 'getLangResource("common.show_more_files")',
      '"Find resources"': 'getLangResource("common.find_resources")',
      
      // 测试相关
      '"Answer"': 'getLangResource("assessment.answer")',
      '"Correct"': 'getLangResource("assessment.correct")',
      '"Incorrect"': 'getLangResource("assessment.incorrect")',
      '"Rubric"': 'getLangResource("assessment.rubric")',
      '"Explanation"': 'getLangResource("assessment.explanation")',
      '"weight"': 'getLangResource("assessment.weight")',
      '"answers"': 'getLangResource("assessment.answers")',
      '"Generate Assessment"': 'getLangResource("assessment.generate_assessment")',
      '"Failed to generate Assessment"': 'getLangResource("assessment.failed_to_generate")',
      
      // 页面标题
      '"HomePage"': 'getLangResource("pages.home.title")',
      '"My Performance Dashboard"': 'getLangResource("pages.dashboard.title")',
      '"Generate Dashboard"': 'getLangResource("pages.dashboard.generate_dashboard")',
      '"Dashboard"': 'getLangResource("pages.dashboard.dashboard")',
      '"Manage Knowledge Bases"': 'getLangResource("pages.knowledge_base.title")',
      '"Failed to create Knowledge Base"': 'getLangResource("pages.knowledge_base.failed_to_create")',
      '"Knowledge Base created successfully"': 'getLangResource("pages.knowledge_base.created_successfully")',
      '"Create New Template"': 'getLangResource("pages.templates.create_new")',
      '"Settings"': 'getLangResource("pages.settings.title")',
      
      // 模板页面
      '"Id"': 'getLangResource("pages.templates.id")',
      '"Lang"': 'getLangResource("pages.templates.lang")',
      '"Type"': 'getLangResource("pages.templates.type")',
      '"Taxonomy"': 'getLangResource("pages.templates.taxonomy")',
      '"Easy"': 'getLangResource("pages.templates.easy")',
      '"Medium"': 'getLangResource("pages.templates.medium")',
      '"Hard"': 'getLangResource("pages.templates.hard")',
      '"Total"': 'getLangResource("pages.templates.total")',
      '"Created At"': 'getLangResource("pages.templates.created_at")',
      
      // 学生页面
      '"Student Id"': 'getLangResource("pages.student.student_id")',
      '"First Name"': 'getLangResource("pages.student.first_name")',
      '"Last Name"': 'getLangResource("pages.student.last_name")',
      '"Dashboards"': 'getLangResource("pages.student.dashboards")',
      '"Lecture Date"': 'getLangResource("pages.student.lecture_date")',
      '"Updated At"': 'getLangResource("pages.student.updated_at")',
      '"Published successfully to students"': 'getLangResource("pages.student.published_successfully")',
      
      // 分类法
      '"Knowledge"': 'getLangResource("taxonomy.knowledge")',
      '"Comprehension"': 'getLangResource("taxonomy.comprehension")',
      '"Application"': 'getLangResource("taxonomy.application")',
      '"Analysis"': 'getLangResource("taxonomy.analysis")',
      '"Synthesis"': 'getLangResource("taxonomy.synthesis")',
      '"Evaluation"': 'getLangResource("taxonomy.evaluation")',
      
      // 日期格式
      '"YYYY/MM/DD"': 'getLangResource("date_format.yyyy_mm_dd")'
    };

    // JSX 文本内容 (在标签之间的文本)
    const jsxTextMappings = {
      '>Loading list...<': '>{ getLangResource("common.loading") }<',
      '>Error<': '>{ getLangResource("common.error") }<',
      '>Cancel<': '>{ getLangResource("common.cancel") }<',
      '>Previous<': '>{ getLangResource("common.previous") }<',
      '>Next<': '>{ getLangResource("common.next") }<',
      '>Submit<': '>{ getLangResource("common.submit") }<',
      '>Finish<': '>{ getLangResource("common.finish") }<',
      '>Start<': '>{ getLangResource("common.start") }<',
      '>Review<': '>{ getLangResource("common.review") }<',
      '>Name<': '>{ getLangResource("common.name") }<',
      '>Course<': '>{ getLangResource("common.course") }<',
      '>Action<': '>{ getLangResource("common.action") }<',
      '>Score<': '>{ getLangResource("common.score") }<',
      '>Deadline<': '>{ getLangResource("common.deadline") }<',
      '>Status<': '>{ getLangResource("common.status") }<',
      '>Edit<': '>{ getLangResource("common.edit") }<',
      '>Publish<': '>{ getLangResource("common.publish") }<',
      '>Published<': '>{ getLangResource("common.published") }<',
      '>Points<': '>{ getLangResource("common.points") }<',
      '>Description<': '>{ getLangResource("common.description") }<',
      '>Find resources<': '>{ getLangResource("common.find_resources") }<',
      
      '>Answer<': '>{ getLangResource("assessment.answer") }<',
      '>Correct<': '>{ getLangResource("assessment.correct") }<',
      '>Incorrect<': '>{ getLangResource("assessment.incorrect") }<',
      '>Rubric<': '>{ getLangResource("assessment.rubric") }<',
      '>Explanation<': '>{ getLangResource("assessment.explanation") }<',
      '>Generate Assessment<': '>{ getLangResource("assessment.generate_assessment") }<',
      
      '>HomePage<': '>{ getLangResource("pages.home.title") }<',
      '>My Performance Dashboard<': '>{ getLangResource("pages.dashboard.title") }<',
      '>Generate Dashboard<': '>{ getLangResource("pages.dashboard.generate_dashboard") }<',
      '>Dashboard<': '>{ getLangResource("pages.dashboard.dashboard") }<',
      '>Manage Knowledge Bases<': '>{ getLangResource("pages.knowledge_base.title") }<',
      '>Create New Template<': '>{ getLangResource("pages.templates.create_new") }<',
      '>Settings<': '>{ getLangResource("pages.settings.title") }<'
    };

    // 合并所有映射
    Object.entries(textMappings).forEach(([key, value]) => {
      this.replacements.set(key, value);
    });
    
    Object.entries(jsxTextMappings).forEach(([key, value]) => {
      this.replacements.set(key, value);
    });
  }

  // 检查文件是否需要添加 getLangResource import
  needsImportUpdate(content) {
    // 检查是否已经存在 import 语句
    const hasExistingImport = content.includes('import { getLangResource }');
    const hasI18nUtilsImport = content.includes('from "../i18n/utils"') || content.includes("from '../i18n/utils'");
    
    // 检查是否会有新的 getLangResource 调用
    let willHaveReplacements = false;
    for (const [oldText] of this.replacements) {
      if (content.includes(oldText)) {
        willHaveReplacements = true;
        break;
      }
    }
    
    return willHaveReplacements && (!hasExistingImport || !hasI18nUtilsImport);
  }

  // 添加 import 语句
  addImportStatement(content, filePath) {
    const relativePath = path.relative(path.dirname(filePath), path.join(this.srcPath, 'i18n', 'utils')).replace(/\\/g, '/');
    const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
    
    // 查找是否已有其他 import 语句
    const lines = content.split('\n');
    let insertIndex = 0;
    
    // 找到最后一个 import 语句的位置
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        insertIndex = i + 1;
      } else if (lines[i].trim() === '' || lines[i].trim().startsWith('//')) {
        continue;
      } else {
        break;
      }
    }
    
    const importStatement = `import { getLangResource } from "${importPath}";`;
    lines.splice(insertIndex, 0, importStatement);
    
    return lines.join('\n');
  }

  // 替换文件中的文本
  replaceTextInFile(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let hasChanges = false;
      const changes = [];

      // 执行文本替换
      for (const [oldText, newText] of this.replacements) {
        if (content.includes(oldText)) {
          const beforeCount = (content.match(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
          content = content.replace(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newText);
          if (beforeCount > 0) {
            hasChanges = true;
            changes.push(`  ${oldText} → ${newText} (${beforeCount} 次)`);
          }
        }
      }

      // 如果有替换，检查是否需要添加 import
      if (hasChanges && this.needsImportUpdate(content)) {
        content = this.addImportStatement(content, filePath);
        changes.unshift('  + 添加 getLangResource import');
      }

      if (hasChanges) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ 已更新: ${filePath}`);
        changes.forEach(change => console.log(change));
      }

      return hasChanges;
    } catch (error) {
      console.error(`❌ 处理文件失败 ${filePath}:`, error.message);
      return false;
    }
  }

  // 预览将要进行的更改
  previewChanges(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const changes = [];

      for (const [oldText, newText] of this.replacements) {
        if (content.includes(oldText)) {
          const count = (content.match(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
          changes.push({
            old: oldText,
            new: newText,
            count: count
          });
        }
      }

      if (changes.length > 0 && this.needsImportUpdate(content)) {
        const relativePath = path.relative(path.dirname(filePath), path.join(this.srcPath, 'i18n', 'utils')).replace(/\\/g, '/');
        const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
        changes.unshift({
          old: '(添加 import)',
          new: `import { getLangResource } from "${importPath}";`,
          count: 1
        });
      }

      return changes;
    } catch (error) {
      console.error(`预览文件失败 ${filePath}:`, error.message);
      return [];
    }
  }

  // 处理整个项目
  processProject(preview = false) {
    const targetFiles = [
      'components/AssessmentCard.tsx',
      'components/FileUpload.tsx',
      'pages/CreateAssessment.tsx',
      'pages/StudentAssessments.tsx',
      'pages/Templates.tsx',
      'pages/HomePage.tsx',
      'pages/ManageKnowledgeBases.tsx',
      'pages/MyDashboard.tsx',
      'pages/ReviewAssessment.tsx',
      'pages/Section.tsx',
      'pages/StudentAssessment.tsx',
      'pages/FindStudent.tsx',
      'pages/GenerateAssessment.tsx'
    ];

    let totalChanges = 0;
    const summary = [];

    console.log(preview ? '\n=== 预览更改 ===' : '\n=== 开始替换文本 ===');

    targetFiles.forEach(relativePath => {
      const fullPath = path.join(this.srcPath, relativePath);
      
      if (fs.existsSync(fullPath)) {
        if (preview) {
          const changes = this.previewChanges(fullPath);
          if (changes.length > 0) {
            console.log(`\n�� ${relativePath}:`);
            changes.forEach(change => {
              console.log(`  ${change.old} → ${change.new} (${change.count} 次)`);
            });
            totalChanges += changes.length;
            summary.push({ file: relativePath, changes: changes.length });
          }
        } else {
          if (this.replaceTextInFile(fullPath)) {
            totalChanges++;
          }
        }
      } else {
        console.log(`⚠️  文件不存在: ${relativePath}`);
      }
    });

    console.log(`\n=== ${preview ? '预览' : '替换'}完成 ===`);
    if (preview) {
      console.log(`预计影响 ${summary.length} 个文件，总共 ${totalChanges} 项更改`);
      if (totalChanges > 0) {
        console.log('\n运行 node text_replacer.js --replace 来执行实际替换');
      }
    } else {
      console.log(`已更新 ${totalChanges} 个文件`);
    }
  }
}

// 使用脚本
const replacer = new I18nTextReplacer('./ui/src');

// 检查命令行参数
const args = process.argv.slice(2);
const shouldReplace = args.includes('--replace');

if (shouldReplace) {
  console.log('开始执行文本替换...');
  replacer.processProject(false);
} else {
  console.log('预览模式 - 显示将要进行的更改');
  console.log('使用 --replace 参数来执行实际替换');
  replacer.processProject(true);
}

