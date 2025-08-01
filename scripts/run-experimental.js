#!/usr/bin/env node

/**
 * 实验性测试运行脚本
 * 一次仅允许运行一个实验性测试，避免干扰
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 实验性测试文件列表
const EXPERIMENTAL_TESTS = {
  'binary-dot-product': 'tests/experimental/binary-dot-product-visualization.test.ts',
  '1bit-4bit-bottleneck': 'tests/experimental/1bit-4bit-bottleneck.test.ts',
  '4bit-lookup-table': 'tests/experimental/4bit-lookup-table-optimization.test.ts',
  '4bit-lookup-table-v2': 'tests/experimental/4bit-lookup-table-optimization-v2.test.ts',
  '8bit-lookup-table': 'tests/experimental/8bit-lookup-table-optimization.test.ts',
  '4bit-inline-lookup': 'tests/experimental/4bit-inline-lookup-table.test.ts',
  '4bit-direct-lookup': 'tests/experimental/4bit-direct-lookup-table.test.ts',
  'ultimate-optimization': 'tests/experimental/ultimate-optimization.test.ts',
  'debug-ultimate': 'tests/experimental/debug-ultimate.test.ts',
  'stitched-batch-scoring': 'tests/experimental/stitched-batch-scoring.test.ts',
  // 可以在这里添加更多实验性测试
};

function printUsage() {
  console.log('实验性测试运行器');
  console.log('');
  console.log('用法: node scripts/run-experimental.js <测试名称>');
  console.log('');
  console.log('可用的实验性测试:');
  Object.keys(EXPERIMENTAL_TESTS).forEach(name => {
    console.log(`  ${name} - ${EXPERIMENTAL_TESTS[name]}`);
  });
  console.log('');
  console.log('示例:');
  console.log('  node scripts/run-experimental.js binary-dot-product');
}

function runTest(testName) {
  const testPath = EXPERIMENTAL_TESTS[testName];
  
  if (!testPath) {
    console.error(`❌ 未知的测试名称: ${testName}`);
    printUsage();
    process.exit(1);
  }
  
  const fullPath = path.resolve(testPath);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ 测试文件不存在: ${fullPath}`);
    process.exit(1);
  }
  
  console.log(`🧪 运行实验性测试: ${testName}`);
  console.log(`📁 文件路径: ${testPath}`);
  console.log('');
  
  try {
    // 使用vitest运行单个测试文件，使用专门的实验性配置文件
    const command = `npx vitest run "${fullPath}" --config vitest.experimental.config.ts --reporter=verbose`;
    console.log(`🚀 执行命令: ${command}`);
    console.log('');
    
    execSync(command, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log('');
    console.log('✅ 实验性测试完成');
    
  } catch (error) {
    console.error('');
    console.error('❌ 实验性测试失败');
    process.exit(1);
  }
}

// 主程序
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ 请指定要运行的测试名称');
    printUsage();
    process.exit(1);
  }
  
  if (args.length > 1) {
    console.error('❌ 一次只能运行一个实验性测试');
    printUsage();
    process.exit(1);
  }
  
  const testName = args[0];
  runTest(testName);
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { runTest, EXPERIMENTAL_TESTS }; 