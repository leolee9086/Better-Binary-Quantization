import { describe, it, expect } from 'vitest';
import { BIT_COUNT_LOOKUP_TABLE } from '../../src/utils';

/**
 * 八位二值向量内积计算性能对比测试
 * 对比查表法和直接计算法的性能差异
 */

// 生成八位二值向量（每个字节表示8个二值位）
function generateBinaryVector(length: number): Uint8Array {
  const vector = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    // 随机生成0-255的字节值，每个字节表示8个二值位
    vector[i] = Math.floor(Math.random() * 256);
  }
  return vector;
}

// 生成稀疏的二值向量（大部分位为0）
function generateSparseBinaryVector(length: number, sparsity: number = 0.1): Uint8Array {
  const vector = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    if (Math.random() < sparsity) {
      vector[i] = Math.floor(Math.random() * 256);
    } else {
      vector[i] = 0;
    }
  }
  return vector;
}

// 生成密集的二值向量（大部分位为1）
function generateDenseBinaryVector(length: number, density: number = 0.9): Uint8Array {
  const vector = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    if (Math.random() < density) {
      vector[i] = Math.floor(Math.random() * 256);
    } else {
      vector[i] = 0;
    }
  }
  return vector;
}

// 将八位向量转换为二值向量（用于验证）
function unpackBinaryVector(packedVector: Uint8Array): Uint8Array {
  const unpacked = new Uint8Array(packedVector.length * 8);
  for (let i = 0; i < packedVector.length; i++) {
    const byte = packedVector[i]!;
    for (let bit = 0; bit < 8; bit++) {
      unpacked[i * 8 + bit] = (byte >> bit) & 1;
    }
  }
  return unpacked;
}

// 计算两个二值向量的内积（用于验证）
function computeBinaryDotProduct(a: Uint8Array, b: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i]! * b[i]!;
  }
  return sum;
}

/**
 * 查表法计算八位二值向量内积
 * 使用预计算的位计数查找表
 * @param a 第一个八位向量
 * @param b 第二个八位向量
 * @returns 内积结果
 */
function computeBinaryDotProductWithLookupTable(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) {
    throw new Error('向量长度不匹配');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    // 按位与操作，然后查表获取1的个数
    const bitwiseAnd = a[i]! & b[i]!;
    sum += BIT_COUNT_LOOKUP_TABLE[bitwiseAnd]!;
  }
  return sum;
}

/**
 * 直接计算八位二值向量内积
 * 将每个字节展开为8个位，然后计算内积
 * @param a 第一个八位向量
 * @param b 第二个八位向量
 * @returns 内积结果
 */
function computeBinaryDotProductDirect(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) {
    throw new Error('向量长度不匹配');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const byteA = a[i]!;
    const byteB = b[i]!;
    
    // 逐位计算内积
    for (let bit = 0; bit < 8; bit++) {
      const bitA = (byteA >> bit) & 1;
      const bitB = (byteB >> bit) & 1;
      sum += bitA * bitB;
    }
  }
  return sum;
}

/**
 * 优化的直接计算法
 * 使用位运算优化，减少循环次数
 * @param a 第一个八位向量
 * @param b 第二个八位向量
 * @returns 内积结果
 */
function computeBinaryDotProductOptimized(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) {
    throw new Error('向量长度不匹配');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const byteA = a[i]!;
    const byteB = b[i]!;
    
    // 使用位运算计算内积
    // 对于二值向量，内积等于按位与后1的个数
    const bitwiseAnd = byteA & byteB;
    
    // 手动计算位计数（不使用查找表）
    let count = 0;
    let temp = bitwiseAnd;
    while (temp > 0) {
      count += temp & 1;
      temp >>>= 1;
    }
    sum += count;
  }
  return sum;
}

/**
 * 使用SWAR算法的位计数
 * 更高效的位计数实现
 * @param n 8位整数
 * @returns 1的个数
 */
function bitCountSWAR(n: number): number {
  n = n >>> 0; // 转换为无符号32位整数
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  n = (n + (n >>> 4)) & 0x0F0F0F0F;
  n = n + (n >>> 8);
  n = n + (n >>> 16);
  return n & 0x3F;
}

/**
 * 使用SWAR算法的优化版本
 * @param a 第一个八位向量
 * @param b 第二个八位向量
 * @returns 内积结果
 */
function computeBinaryDotProductSWAR(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) {
    throw new Error('向量长度不匹配');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const bitwiseAnd = a[i]! & b[i]!;
    sum += bitCountSWAR(bitwiseAnd);
  }
  return sum;
}

/**
 * 向量化按位与算法 - 使用Uint32Array一次处理4个字节
 * 这是真正的向量化操作，避免了逐字节循环
 */
function computeBinaryDotProductVectorized(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) {
    throw new Error('向量长度不匹配');
  }
  
  let sum = 0;
  const length = a.length;
  
  // 使用Uint32Array视图来一次处理4个字节
  const uint32Length = Math.floor(length / 4);
  const remainder = length % 4;
  
  // 创建Uint32Array视图，共享同一块内存
  const a32 = new Uint32Array(a.buffer, a.byteOffset, uint32Length);
  const b32 = new Uint32Array(b.buffer, b.byteOffset, uint32Length);
  
  // 向量化处理：一次处理4个字节
  for (let i = 0; i < uint32Length; i++) {
    const bitwiseAnd32 = a32[i]! & b32[i]!;
    // 对32位结果进行位计数
    sum += bitCountSWAR(bitwiseAnd32);
  }
  
  // 处理剩余的字节（如果有的话）
  const startRemainder = uint32Length * 4;
  for (let i = startRemainder; i < length; i++) {
    const bitwiseAnd = a[i]! & b[i]!;
    sum += bitCountSWAR(bitwiseAnd);
  }
  
  return sum;
}

/**
 * 更激进的向量化算法 - 使用Uint32Array并优化位计数
 * 专门为32位整数优化的位计数算法
 */
function bitCount32Optimized(n: number): number {
  // 专门为32位整数优化的SWAR算法
  n = n >>> 0;
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  n = (n + (n >>> 4)) & 0x0F0F0F0F;
  n = n + (n >>> 8);
  n = n + (n >>> 16);
  return n & 0x3F;
}

/**
 * 超向量化算法 - 使用Uint32Array + 优化的位计数
 */
function computeBinaryDotProductUltraVectorized(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) {
    throw new Error('向量长度不匹配');
  }
  
  let sum = 0;
  const length = a.length;
  const uint32Length = Math.floor(length / 4);
  const remainder = length % 4;
  
  // 创建Uint32Array视图
  const a32 = new Uint32Array(a.buffer, a.byteOffset, uint32Length);
  const b32 = new Uint32Array(b.buffer, b.byteOffset, uint32Length);
  
  // 向量化处理
  for (let i = 0; i < uint32Length; i++) {
    const bitwiseAnd32 = a32[i]! & b32[i]!;
    sum += bitCount32Optimized(bitwiseAnd32);
  }
  
  // 处理剩余字节
  const startRemainder = uint32Length * 4;
  for (let i = startRemainder; i < length; i++) {
    const bitwiseAnd = a[i]! & b[i]!;
    sum += bitCountSWAR(bitwiseAnd);
  }
  
  return sum;
}

describe('八位二值向量内积计算性能对比', () => {
  const testSizes = [100, 1000, 10000, 100000];
  const iterations = 1000; // 每个测试重复次数

  it('应该正确计算内积', () => {
    const a = generateBinaryVector(10);
    const b = generateBinaryVector(10);
    
    // 展开为二值向量进行验证
    const unpackedA = unpackBinaryVector(a);
    const unpackedB = unpackBinaryVector(b);
    const expected = computeBinaryDotProduct(unpackedA, unpackedB);
    
    // 测试六种方法的结果一致性
    const result1 = computeBinaryDotProductWithLookupTable(a, b);
    const result2 = computeBinaryDotProductDirect(a, b);
    const result3 = computeBinaryDotProductOptimized(a, b);
    const result4 = computeBinaryDotProductSWAR(a, b);
    const result5 = computeBinaryDotProductVectorized(a, b);
    const result6 = computeBinaryDotProductUltraVectorized(a, b);
    
    expect(result1).toBe(expected);
    expect(result2).toBe(expected);
    expect(result3).toBe(expected);
    expect(result4).toBe(expected);
    expect(result5).toBe(expected);
    expect(result6).toBe(expected);
  });

  it('性能对比测试', () => {
    console.log('\n=== 八位二值向量内积计算性能对比 ===');
    console.log('向量大小\t查表法(ms)\t直接计算(ms)\t优化计算(ms)\tSWAR算法(ms)\t向量化(ms)\t超向量化(ms)\t查表法加速比');
    
    for (const size of testSizes) {
      const a = generateBinaryVector(size);
      const b = generateBinaryVector(size);
      
      // 预热
      for (let i = 0; i < 100; i++) {
        computeBinaryDotProductWithLookupTable(a, b);
        computeBinaryDotProductDirect(a, b);
        computeBinaryDotProductOptimized(a, b);
        computeBinaryDotProductSWAR(a, b);
        computeBinaryDotProductVectorized(a, b);
        computeBinaryDotProductUltraVectorized(a, b);
      }
      
      // 测试查表法
      const start1 = performance.now();
      for (let i = 0; i < iterations; i++) {
        computeBinaryDotProductWithLookupTable(a, b);
      }
      const time1 = performance.now() - start1;
      
      // 测试直接计算法
      const start2 = performance.now();
      for (let i = 0; i < iterations; i++) {
        computeBinaryDotProductDirect(a, b);
      }
      const time2 = performance.now() - start2;
      
      // 测试优化计算法
      const start3 = performance.now();
      for (let i = 0; i < iterations; i++) {
        computeBinaryDotProductOptimized(a, b);
      }
      const time3 = performance.now() - start3;
      
      // 测试SWAR算法
      const start4 = performance.now();
      for (let i = 0; i < iterations; i++) {
        computeBinaryDotProductSWAR(a, b);
      }
      const time4 = performance.now() - start4;
      
      // 测试向量化算法
      const start5 = performance.now();
      for (let i = 0; i < iterations; i++) {
        computeBinaryDotProductVectorized(a, b);
      }
      const time5 = performance.now() - start5;
      
      // 测试超向量化算法
      const start6 = performance.now();
      for (let i = 0; i < iterations; i++) {
        computeBinaryDotProductUltraVectorized(a, b);
      }
      const time6 = performance.now() - start6;
      
      const speedup1 = time2 / time1;
      const speedup2 = time2 / time3;
      const speedup3 = time2 / time4;
      const speedup4 = time2 / time5;
      const speedup5 = time2 / time6;
      
      console.log(`${size}\t\t${time1.toFixed(2)}\t\t${time2.toFixed(2)}\t\t${time3.toFixed(2)}\t\t${time4.toFixed(2)}\t\t${time5.toFixed(2)}\t\t${time6.toFixed(2)}\t\t${speedup1.toFixed(2)}x`);
      
      // 验证结果一致性
      const result1 = computeBinaryDotProductWithLookupTable(a, b);
      const result2 = computeBinaryDotProductDirect(a, b);
      const result3 = computeBinaryDotProductOptimized(a, b);
      const result4 = computeBinaryDotProductSWAR(a, b);
      const result5 = computeBinaryDotProductVectorized(a, b);
      const result6 = computeBinaryDotProductUltraVectorized(a, b);
      
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
      expect(result3).toBe(result4);
      expect(result4).toBe(result5);
      expect(result5).toBe(result6);
    }
    
    console.log('\n=== 性能分析总结 ===');
    console.log('1. 查表法：使用预计算的位计数查找表，内存访问开销小');
    console.log('2. 直接计算法：逐位展开计算，循环开销大');
    console.log('3. 优化计算法：使用位运算，但仍有循环开销');
    console.log('4. SWAR算法：使用并行位运算，通常是最优选择');
    console.log('5. 向量化算法：使用Uint32Array一次处理4个字节，减少循环次数');
    console.log('6. 超向量化算法：向量化 + 优化的位计数，理论上最快');
  });

  it('不同数据分布下的性能测试', () => {
    console.log('\n=== 不同数据分布下的性能测试 ===');
    const size = 10000;
    const iterations = 500;
    
    // 测试稀疏数据
    console.log('\n稀疏数据测试（10%非零位）：');
    const sparseA = generateSparseBinaryVector(size, 0.1);
    const sparseB = generateSparseBinaryVector(size, 0.1);
    
    const sparseTime1 = measureTime(() => computeBinaryDotProductWithLookupTable(sparseA, sparseB), iterations);
    const sparseTime2 = measureTime(() => computeBinaryDotProductDirect(sparseA, sparseB), iterations);
    const sparseTime3 = measureTime(() => computeBinaryDotProductOptimized(sparseA, sparseB), iterations);
    const sparseTime4 = measureTime(() => computeBinaryDotProductSWAR(sparseA, sparseB), iterations);
    const sparseTime5 = measureTime(() => computeBinaryDotProductVectorized(sparseA, sparseB), iterations);
    const sparseTime6 = measureTime(() => computeBinaryDotProductUltraVectorized(sparseA, sparseB), iterations);
    
    console.log(`查表法: ${sparseTime1.toFixed(2)}ms`);
    console.log(`直接计算: ${sparseTime2.toFixed(2)}ms`);
    console.log(`优化计算: ${sparseTime3.toFixed(2)}ms`);
    console.log(`SWAR算法: ${sparseTime4.toFixed(2)}ms`);
    console.log(`向量化算法: ${sparseTime5.toFixed(2)}ms`);
    console.log(`超向量化算法: ${sparseTime6.toFixed(2)}ms`);
    
    // 测试密集数据
    console.log('\n密集数据测试（90%非零位）：');
    const denseA = generateDenseBinaryVector(size, 0.9);
    const denseB = generateDenseBinaryVector(size, 0.9);
    
    const denseTime1 = measureTime(() => computeBinaryDotProductWithLookupTable(denseA, denseB), iterations);
    const denseTime2 = measureTime(() => computeBinaryDotProductDirect(denseA, denseB), iterations);
    const denseTime3 = measureTime(() => computeBinaryDotProductOptimized(denseA, denseB), iterations);
    const denseTime4 = measureTime(() => computeBinaryDotProductSWAR(denseA, denseB), iterations);
    const denseTime5 = measureTime(() => computeBinaryDotProductVectorized(denseA, denseB), iterations);
    const denseTime6 = measureTime(() => computeBinaryDotProductUltraVectorized(denseA, denseB), iterations);
    
    console.log(`查表法: ${denseTime1.toFixed(2)}ms`);
    console.log(`直接计算: ${denseTime2.toFixed(2)}ms`);
    console.log(`优化计算: ${denseTime3.toFixed(2)}ms`);
    console.log(`SWAR算法: ${denseTime4.toFixed(2)}ms`);
    console.log(`向量化算法: ${denseTime5.toFixed(2)}ms`);
    console.log(`超向量化算法: ${denseTime6.toFixed(2)}ms`);
    
    // 测试随机数据
    console.log('\n随机数据测试：');
    const randomA = generateBinaryVector(size);
    const randomB = generateBinaryVector(size);
    
    const randomTime1 = measureTime(() => computeBinaryDotProductWithLookupTable(randomA, randomB), iterations);
    const randomTime2 = measureTime(() => computeBinaryDotProductDirect(randomA, randomB), iterations);
    const randomTime3 = measureTime(() => computeBinaryDotProductOptimized(randomA, randomB), iterations);
    const randomTime4 = measureTime(() => computeBinaryDotProductSWAR(randomA, randomB), iterations);
    const randomTime5 = measureTime(() => computeBinaryDotProductVectorized(randomA, randomB), iterations);
    const randomTime6 = measureTime(() => computeBinaryDotProductUltraVectorized(randomA, randomB), iterations);
    
    console.log(`查表法: ${randomTime1.toFixed(2)}ms`);
    console.log(`直接计算: ${randomTime2.toFixed(2)}ms`);
    console.log(`优化计算: ${randomTime3.toFixed(2)}ms`);
    console.log(`SWAR算法: ${randomTime4.toFixed(2)}ms`);
    console.log(`向量化算法: ${randomTime5.toFixed(2)}ms`);
    console.log(`超向量化算法: ${randomTime6.toFixed(2)}ms`);
  });

  it('内存使用分析', () => {
    console.log('\n=== 内存使用分析 ===');
    console.log('查找表大小：', BIT_COUNT_LOOKUP_TABLE.length, '字节');
    console.log('查找表内存占用：', (BIT_COUNT_LOOKUP_TABLE.length / 1024).toFixed(2), 'KB');
    
    // 测试不同大小的内存使用
    const testSize = 10000;
    const a = generateBinaryVector(testSize);
    const b = generateBinaryVector(testSize);
    
    // 测量内存使用（近似）- 仅在支持的环境中
    let memoryInfo = '';
    let result: number;
    
    if ('memory' in performance && performance.memory) {
      const before = (performance as any).memory.usedJSHeapSize || 0;
      result = computeBinaryDotProductWithLookupTable(a, b);
      const after = (performance as any).memory.usedJSHeapSize || 0;
      memoryInfo = `单次计算内存增量：${((after - before) / 1024).toFixed(2)} KB`;
    } else {
      result = computeBinaryDotProductWithLookupTable(a, b);
      memoryInfo = '内存使用信息不可用（当前环境不支持performance.memory）';
    }
    
    console.log(memoryInfo);
    console.log('计算结果：', result);
  });

  it('算法复杂度分析', () => {
    console.log('\n=== 算法复杂度分析 ===');
    console.log('查表法：O(n)，其中n是向量字节数');
    console.log('直接计算法：O(8n)，需要逐位展开');
    console.log('优化计算法：O(n)，但每个字节需要位计数计算');
    console.log('SWAR算法：O(n)，使用并行位运算');
    console.log('向量化算法：O(n/4)，一次处理4个字节，循环次数减少75%');
    console.log('超向量化算法：O(n/4)，向量化 + 优化的位计数');
    console.log('空间复杂度：查表法需要256字节的查找表');
    
    // 测试不同大小的性能趋势
    const sizes = [100, 500, 1000, 2000, 5000];
    const results = [];
    
    for (const size of sizes) {
      const a = generateBinaryVector(size);
      const b = generateBinaryVector(size);
      
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        computeBinaryDotProductWithLookupTable(a, b);
      }
      const time = performance.now() - start;
      
      results.push({ size, time });
    }
    
    console.log('\n性能趋势：');
    for (const result of results) {
      console.log(`向量大小 ${result.size}: ${result.time.toFixed(2)}ms`);
    }
  });
});

// 辅助函数：测量函数执行时间
function measureTime(fn: () => void, iterations: number): number {
  // 预热
  for (let i = 0; i < 50; i++) {
    fn();
  }
  
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  return performance.now() - start;
}
