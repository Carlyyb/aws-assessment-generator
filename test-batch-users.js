// 测试批量用户创建功能
// PowerShell命令测试

const testData = [
  {
    name: "student1001",
    username: "student1001", 
    password: "12345678",
    role: "students",
    email: ""
  },
  {
    name: "student1002",
    username: "student1002",
    password: "12345678", 
    role: "students",
    email: ""
  }
];

console.log("测试数据:", JSON.stringify(testData, null, 2));
console.log("数据验证:");

testData.forEach((user, index) => {
  console.log(`用户 ${index + 1}:`);
  console.log(`  姓名: ${user.name} (长度: ${user.name.length})`);
  console.log(`  用户名: ${user.username} (格式检查: ${/^[a-zA-Z0-9._]{3,50}$/.test(user.username)})`);
  console.log(`  密码: ${user.password} (长度: ${user.password.length})`);
  console.log(`  角色: ${user.role}`);
  console.log(`  邮箱: "${user.email}" (为空)`);
});
