/**
 * DynamoDB表信息快速查询工具
 * 提供项目中所有DynamoDB表的完整信息，方便开发时快速查阅
 */

const DYNAMODB_TABLES = {
  // 核心业务表
  ASSESSMENTS: {
    fullName: 'GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-AssessmentsTable6996196E-1JTSUQZSJTVXK',
    logicalName: 'AssessmentsTable',
    partitionKey: 'userId',
    sortKey: 'id',
    gsi: [{ indexName: 'id-only', partitionKey: 'id' }],
    size: '40.8KB',
    description: '存储教师创建的评估信息，包括名称、课程ID、上课时间、截止时间等'
  },
  
  STUDENT_ASSESSMENTS: {
    fullName: 'GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-StudentAssessmentsTable660FD085-1V5I0AC5JOLYG',
    logicalName: 'StudentAssessmentsTable',
    partitionKey: 'userId',
    sortKey: 'parentAssessId',
    gsi: [],
    size: '1.9KB',
    description: '存储学生参与评估的记录，包括答案、分数、提交状态等'
  },
  
  USERS: {
    fullName: 'GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-UsersTable9725E9C8-FMTN6J8BOV51',
    logicalName: 'UsersTable',
    partitionKey: 'id',
    sortKey: null,
    gsi: [],
    size: '6.7KB',
    description: '存储用户基础信息，如姓名、邮箱、角色等'
  },
  
  COURSES: {
    fullName: 'GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-CoursesTable3F79D98E-EE7ZIUBKYN6Z',
    logicalName: 'CoursesTable',
    partitionKey: 'id',
    sortKey: null,
    gsi: [],
    size: '541 字节',
    description: '存储课程信息，包括课程名称、描述等'
  },
  
  // 测试模板和分组表
  ASSESS_TEMPLATES: {
    fullName: 'GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-AssessTemplatesTableA1C1DEB9-5THS1TWF00HX',
    logicalName: 'AssessTemplatesTable',
    partitionKey: 'userId',
    sortKey: 'id',
    gsi: [],
    size: '510 字节',
    description: '存储评估测试模板配置，包括题目类型分布、难度设置等'
  },
  
  STUDENT_GROUPS: {
    fullName: 'GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-StudentGroupsTable6E685D02-RZJZNDKZ5ZGS',
    logicalName: 'StudentGroupsTable',
    partitionKey: 'id',
    sortKey: null,
    gsi: [],
    size: '142 字节',
    description: '存储学生分组信息，用于批量管理学生'
  },
  
  STUDENTS: {
    fullName: 'GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-StudentsTableDAB56938-UCCNGIGN4KAU',
    logicalName: 'StudentsTable',
    partitionKey: 'id',
    sortKey: null,
    gsi: [],
    size: '0 字节',
    description: '存储学生特定信息和扩展属性'
  },
  
  // 系统配置和知识库表
  SETTINGS: {
    fullName: 'GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-SettingsTable4DB0CCD0-1DEL1UGBAVD31',
    logicalName: 'SettingsTable',
    partitionKey: 'userId',
    sortKey: null,
    gsi: [],
    size: '102.9KB',
    description: '存储用户个性化设置和系统配置信息'
  },
  
  KNOWLEDGE_BASE: {
    fullName: 'GenAssessStack-RagStackNestedStackRagStackNestedStackResourceE632B76F-1XR4FTEXQQVSG-KBTable3C212AC0-W6SXBVRR4MSM',
    logicalName: 'KBTable',
    partitionKey: 'userId',
    sortKey: 'courseId',
    gsi: [],
    size: '2KB',
    description: '存储知识库元数据，关联RAG检索系统'
  },
  
  // 日志和监控表
  LOG_ANALYTICS: {
    fullName: 'GenAssessStack-LoggingStackNestedStackLoggingStackNestedStackResourceA0D8489D-1W2TYG83CSNAI-LogAnalyticsTable7C30A423-VNSBFMMHPC0B',
    logicalName: 'LogAnalyticsTable',
    partitionKey: 'logId',
    sortKey: 'timestamp',
    gsi: [],
    size: '0 字节',
    description: '存储系统操作日志，用于审计和分析'
  },
  
  SYSTEM_METRICS: {
    fullName: 'GenAssessStack-LoggingStackNestedStackLoggingStackNestedStackResourceA0D8489D-1W2TYG83CSNAI-SystemMetricsTable572C1AA7-1N6ENVCZSQ8PH',
    logicalName: 'SystemMetricsTable',
    partitionKey: 'metricKey',
    sortKey: 'timestamp',
    gsi: [],
    size: '0 字节',
    description: '存储系统性能指标和监控数据'
  }
};

/**
 * 根据逻辑名称获取表信息
 * @param {string} logicalName - 表的逻辑名称（如：'AssessmentsTable'）
 * @returns {object|null} 表信息对象
 */
function getTableByLogicalName(logicalName) {
  for (const [key, table] of Object.entries(DYNAMODB_TABLES)) {
    if (table.logicalName === logicalName) {
      return { key, ...table };
    }
  }
  return null;
}

/**
 * 根据完整表名获取表信息
 * @param {string} fullName - 表的完整名称
 * @returns {object|null} 表信息对象
 */
function getTableByFullName(fullName) {
  for (const [key, table] of Object.entries(DYNAMODB_TABLES)) {
    if (table.fullName === fullName) {
      return { key, ...table };
    }
  }
  return null;
}

/**
 * 生成DynamoDB操作的Key对象
 * @param {string} tableKey - 表的键名（如：'ASSESSMENTS'）
 * @param {string} partitionValue - 分区键值
 * @param {string} sortValue - 排序键值（可选）
 * @returns {object} Key对象
 */
function generateKey(tableKey, partitionValue, sortValue = null) {
  const table = DYNAMODB_TABLES[tableKey];
  if (!table) {
    throw new Error(`未找到表: ${tableKey}`);
  }
  
  const key = {};
  key[table.partitionKey] = partitionValue;
  
  if (table.sortKey && sortValue) {
    key[table.sortKey] = sortValue;
  }
  
  return key;
}

/**
 * 打印所有表信息
 */
function printAllTables() {
  console.log('=== DynamoDB 表信息汇总 ===\n');
  
  for (const [key, table] of Object.entries(DYNAMODB_TABLES)) {
    console.log(`🔸 ${table.logicalName} (${key})`);
    console.log(`   完整名称: ${table.fullName}`);
    console.log(`   主键: ${table.partitionKey}${table.sortKey ? ' + ' + table.sortKey : ''}`);
    console.log(`   大小: ${table.size}`);
    console.log(`   描述: ${table.description}`);
    
    if (table.gsi.length > 0) {
      console.log(`   GSI: ${table.gsi.map(g => g.indexName).join(', ')}`);
    }
    
    console.log('');
  }
}

/**
 * 使用示例
 */
function examples() {
  console.log('=== 使用示例 ===\n');
  
  // 示例1: 获取Assessment表信息
  const assessTable = DYNAMODB_TABLES.ASSESSMENTS;
  console.log('1. 获取Assessment表完整名称:');
  console.log(`   ${assessTable.fullName}\n`);
  
  // 示例2: 生成Assessment表的Key
  console.log('2. 生成Assessment表的查询Key:');
  const assessKey = generateKey('ASSESSMENTS', 'user123', 'assessment456');
  console.log(`   ${JSON.stringify(assessKey)}\n`);
  
  // 示例3: 查找表信息
  console.log('3. 根据逻辑名称查找表:');
  const foundTable = getTableByLogicalName('UsersTable');
  console.log(`   找到表: ${foundTable ? foundTable.key : '未找到'}\n`);
}

// 导出函数和常量
module.exports = {
  DYNAMODB_TABLES,
  getTableByLogicalName,
  getTableByFullName,
  generateKey,
  printAllTables,
  examples
};

// 如果直接运行此文件，显示所有表信息
if (require.main === module) {
  printAllTables();
  examples();
}
