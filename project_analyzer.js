const fs = require('fs');
const path = require('path');

class ProjectAnalyzer {
  constructor(srcPath = './ui/src') {
    this.srcPath = srcPath;
    this.textPatterns = [];
    this.fileStructure = {};
    this.extractedTexts = {};
  }

  // 扫描项目结构
  scanProjectStructure(dirPath = this.srcPath, relativePath = '') {
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const itemRelativePath = path.join(relativePath, item);
        
        if (fs.statSync(fullPath).isDirectory()) {
          // 跳过 node_modules, .git 等目录
          if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
            this.fileStructure[itemRelativePath] = 'directory';
            this.scanProjectStructure(fullPath, itemRelativePath);
          }
        } else if (item.match(/\.(tsx?|jsx?)$/)) {
          this.fileStructure[itemRelativePath] = 'file';
        }
      }
    } catch (error) {
      console.error(`扫描目录失败 ${dirPath}:`, error.message);
    }
  }

  // 提取单个文件中的英文文本
  extractTextsFromFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const texts = [];

      // 正则表达式匹配各种英文文本模式
      const patterns = [
        // JSX 中的文本内容 <div>Hello World</div>
        />([A-Za-z][^<>{]*[A-Za-z])</g,
        // 双引号字符串 "Hello World"
        /"([A-Za-z][^"]*[A-Za-z])"/g,
        // 单引号字符串 'Hello World'
        /'([A-Za-z][^']*[A-Za-z])'/g,
        // placeholder 属性
        /placeholder\s*=\s*["']([A-Za-z][^"']*[A-Za-z])["']/g,
        // title 属性
        /title\s*=\s*["']([A-Za-z][^"']*[A-Za-z])["']/g,
        // alt 属性
        /alt\s*=\s*["']([A-Za-z][^"']*[A-Za-z])["']/g,
        // aria-label 属性
        /aria-label\s*=\s*["']([A-Za-z][^"']*[A-Za-z])["']/g,
      ];

      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const text = match[1].trim();
          // 过滤掉不需要翻译的内容
          if (this.shouldTranslate(text)) {
            texts.push({
              text: text,
              line: content.substring(0, match.index).split('\n').length,
              context: this.getContext(content, match.index)
            });
          }
        }
      });

      return texts;
    } catch (error) {
      console.error(`读取文件失败 ${filePath}:`, error.message);
      return [];
    }
  }

  // 判断是否需要翻译
  shouldTranslate(text) {
    // 过滤条件
    const filters = [
      text.length < 2, // 太短
      /^[A-Z_][A-Z0-9_]*$/.test(text), // 常量格式
      /^\d+$/.test(text), // 纯数字
      /^[a-zA-Z]+\([^)]*\)$/.test(text), // 函数调用格式
      /^[a-z][a-zA-Z]*$/.test(text) && text.length < 4, // 短变量名
      /(className|onClick|onChange|onSubmit|href|src|id)/.test(text), // 属性名
      /^(div|span|button|input|form|img|a|p|h[1-6])$/.test(text), // HTML标签
      /^(px|%|rem|em|\d+)$/.test(text), // CSS值
    ];

    return !filters.some(condition => condition);
  }

  // 获取文本上下文
  getContext(content, index, contextLength = 50) {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(content.length, index + contextLength);
    return content.substring(start, end);
  }

  // 分析整个项目
  analyzeProject() {
    console.log('开始分析项目结构...');
    this.scanProjectStructure();
    
    console.log('\n=== 项目结构 ===');
    Object.keys(this.fileStructure).forEach(path => {
      console.log(`${this.fileStructure[path] === 'directory' ? '��' : '��'} ${path}`);
    });

    console.log('\n=== 开始提取英文文本 ===');
    const reactFiles = Object.keys(this.fileStructure).filter(path => 
      this.fileStructure[path] === 'file' && path.match(/\.(tsx?|jsx?)$/)
    );

    reactFiles.forEach(relativePath => {
      const fullPath = path.join(this.srcPath, relativePath);
      console.log(`\n分析文件: ${relativePath}`);
      
      const texts = this.extractTextsFromFile(fullPath);
      if (texts.length > 0) {
        this.extractedTexts[relativePath] = texts;
        console.log(`  找到 ${texts.length} 个英文文本:`);
        texts.forEach((item, index) => {
          console.log(`    ${index + 1}. "${item.text}" (行 ${item.line})`);
        });
      } else {
        console.log('  未找到需要翻译的英文文本');
      }
    });

    return {
      structure: this.fileStructure,
      texts: this.extractedTexts
    };
  }

  // 生成初始的 en.json 结构建议
  generateI18nStructure() {
    const structure = {};
    
    Object.keys(this.extractedTexts).forEach(filePath => {
      // 根据文件路径生成键名
      const pathParts = filePath.replace(/\.(tsx?|jsx?)$/, '').split('/');
      let current = structure;
      
      pathParts.forEach((part, index) => {
        if (index === pathParts.length - 1) {
          // 最后一部分，存储文本
          current[part] = {};
          this.extractedTexts[filePath].forEach((textItem, textIndex) => {
            const key = this.generateTextKey(textItem.text);
            current[part][key] = textItem.text;
          });
        } else {
          // 创建嵌套结构
          if (!current[part]) current[part] = {};
          current = current[part];
        }
      });
    });

    return structure;
  }

  // 为文本生成合适的键名
  generateTextKey(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 30); // 限制长度
  }
}

// 使用示例
const analyzer = new ProjectAnalyzer('./ui/src');
console.log('='.repeat(60));
console.log('React项目国际化文本分析工具');
console.log('='.repeat(60));

const result = analyzer.analyzeProject();

console.log('\n=== 建议的 en.json 结构 ===');
const i18nStructure = analyzer.generateI18nStructure();
console.log(JSON.stringify(i18nStructure, null, 2));

console.log('\n=== 分析完成 ===');
console.log(`共扫描 ${Object.keys(result.structure).filter(k => result.structure[k] === 'file').length} 个文件`);
console.log(`找到 ${Object.keys(result.texts).length} 个包含英文文本的文件`);

// 检查是否存在 getLangResource 函数
console.log('\n=== 检查现有国际化设置 ===');
try {
  const i18nPath = './ui/src/i18n';
  if (fs.existsSync(i18nPath)) {
    console.log('✅ i18n 目录已存在');
    const i18nFiles = fs.readdirSync(i18nPath);
    console.log('现有文件:', i18nFiles.join(', '));
  } else {
    console.log('❌ i18n 目录不存在，需要创建');
  }
} catch (error) {
  console.log('⚠️  检查 i18n 目录时出错:', error.message);
}
