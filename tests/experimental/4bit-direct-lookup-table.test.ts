import { describe, it, expect } from 'vitest';

/**
 * 4位直接查表优化算法
 * 直接将向量视为数字进行查表，避免位打包的类型转换开销
 */

describe('4位直接查表优化算法', () => {
  
  /**
   * 预计算的4位二进制向量点积查表（直接版本）
   * 直接使用4位二进制数作为索引，避免位打包
   * 表大小：16 x 16 = 256 个条目
   */
  const DIRECT_4BIT_LOOKUP_TABLE = new Uint8Array([
    // 0b0000 行 (0)
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    // 0b0001 行 (1)
    0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1,
    // 0b0010 行 (2)
    0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1,
    // 0b0011 行 (3)
    0, 1, 1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 0, 1, 1, 2,
    // 0b0100 行 (4)
    0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1,
    // 0b0101 行 (5)
    0, 1, 0, 1, 1, 2, 1, 2, 0, 1, 0, 1, 1, 2, 1, 2,
    // 0b0110 行 (6)
    0, 0, 1, 1, 1, 1, 2, 2, 0, 0, 1, 1, 1, 1, 2, 2,
    // 0b0111 行 (7)
    0, 1, 1, 2, 1, 2, 2, 3, 0, 1, 1, 2, 1, 2, 2, 3,
    // 0b1000 行 (8)
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1,
    // 0b1001 行 (9)
    0, 1, 0, 1, 0, 1, 0, 1, 1, 2, 1, 2, 1, 2, 1, 2,
    // 0b1010 行 (10)
    0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 2, 2, 1, 1, 2, 2,
    // 0b1011 行 (11)
    0, 1, 1, 2, 0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3,
    // 0b1100 行 (12)
    0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2,
    // 0b1101 行 (13)
    0, 1, 0, 1, 1, 2, 1, 2, 1, 2, 1, 2, 2, 3, 2, 3,
    // 0b1110 行 (14)
    0, 0, 1, 1, 1, 1, 2, 2, 1, 1, 2, 2, 2, 2, 3, 3,
    // 0b1111 行 (15)
    0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4
  ]);
  
  /**
   * 将4位二进制向量直接转换为数字索引
   * 避免位打包，直接使用向量值作为索引
   */
  function vectorToIndex(vector: Uint8Array, start: number): number {
    // 直接使用向量值，假设每个元素都是0或1
    return vector[start]! * 8 + vector[start + 1]! * 4 + vector[start + 2]! * 2 + vector[start + 3]!;
  }
  
  /**
   * 使用直接查表的4位分组点积计算
   */
  function compute4BitDirectDotProduct(
    queryVector: Uint8Array,
    targetVector: Uint8Array
  ): number {
    const length = Math.max(queryVector.length, targetVector.length);
    const paddedLength = Math.ceil(length / 4) * 4;
    
    let totalDotProduct = 0;
    const numGroups = paddedLength / 4;
    
    for (let group = 0; group < numGroups; group++) {
      const groupStart = group * 4;
      
      // 直接使用向量值作为索引，避免位打包
      const queryIndex = vectorToIndex(queryVector, groupStart);
      const targetIndex = vectorToIndex(targetVector, groupStart);
      
      // 直接查表获取点积
      totalDotProduct += DIRECT_4BIT_LOOKUP_TABLE[queryIndex * 16 + targetIndex]!;
    }
    
    return totalDotProduct;
  }
  
  /**
   * 优化的直接查表版本（避免函数调用开销）
   */
  function compute4BitDirectDotProductOptimized(
    queryVector: Uint8Array,
    targetVector: Uint8Array
  ): number {
    const length = Math.max(queryVector.length, targetVector.length);
    const paddedLength = Math.ceil(length / 4) * 4;
    
    let totalDotProduct = 0;
    const numGroups = paddedLength / 4;
    
    for (let group = 0; group < numGroups; group++) {
      const groupStart = group * 4;
      
      // 内联索引计算，避免函数调用
      const q0 = groupStart < queryVector.length ? queryVector[groupStart]! : 0;
      const q1 = groupStart + 1 < queryVector.length ? queryVector[groupStart + 1]! : 0;
      const q2 = groupStart + 2 < queryVector.length ? queryVector[groupStart + 2]! : 0;
      const q3 = groupStart + 3 < queryVector.length ? queryVector[groupStart + 3]! : 0;
      
      const t0 = groupStart < targetVector.length ? targetVector[groupStart]! : 0;
      const t1 = groupStart + 1 < targetVector.length ? targetVector[groupStart + 1]! : 0;
      const t2 = groupStart + 2 < targetVector.length ? targetVector[groupStart + 2]! : 0;
      const t3 = groupStart + 3 < targetVector.length ? targetVector[groupStart + 3]! : 0;
      
      const queryIndex = q0 * 8 + q1 * 4 + q2 * 2 + q3;
      const targetIndex = t0 * 8 + t1 * 4 + t2 * 2 + t3;
      
      // 直接查表获取点积
      totalDotProduct += DIRECT_4BIT_LOOKUP_TABLE[queryIndex * 16 + targetIndex]!;
    }
    
    return totalDotProduct;
  }
  
  /**
   * 批量4位直接查表点积计算
   */
  function computeBatch4BitDirectDotProduct(
    queryVector: Uint8Array,
    targetVectors: Uint8Array[]
  ): number[] {
    const results = new Array(targetVectors.length);
    
    for (let vecIndex = 0; vecIndex < targetVectors.length; vecIndex++) {
      results[vecIndex] = compute4BitDirectDotProductOptimized(
        queryVector,
        targetVectors[vecIndex]!
      );
    }
    
    return results;
  }
  
  /**
   * 传统逐位点积计算（用于对比）
   */
  function computeTraditionalDotProduct(queryVector: Uint8Array, targetVector: Uint8Array): number {
    const length = Math.max(queryVector.length, targetVector.length);
    let dotProduct = 0;
    
    for (let i = 0; i < length; i++) {
      const queryBit = i < queryVector.length ? queryVector[i]! : 0;
      const targetBit = i < targetVector.length ? targetVector[i]! : 0;
      dotProduct += queryBit * targetBit;
    }
    
    return dotProduct;
  }
  
  /**
   * 创建测试向量
   */
  function createTestVectors(dimension: number): { query: Uint8Array; target: Uint8Array } {
    const query = new Uint8Array(dimension);
    const target = new Uint8Array(dimension);
    
    for (let i = 0; i < dimension; i++) {
      query[i] = Math.random() > 0.5 ? 1 : 0;
      target[i] = Math.random() > 0.5 ? 1 : 0;
    }
    
    return { query, target };
  }
  
  it('验证直接查表的正确性', () => {
    console.log('=== 直接查表验证 ===');
    console.log('查表大小:', DIRECT_4BIT_LOOKUP_TABLE.length, '个条目');
    
    // 验证一些特殊情况
    const testCases = [
      { a: [0, 0, 0, 0], b: [0, 0, 0, 0], expected: 0 },
      { a: [1, 1, 1, 1], b: [1, 1, 1, 1], expected: 4 },
      { a: [1, 0, 1, 0], b: [1, 0, 1, 0], expected: 2 },
      { a: [1, 0, 1, 0], b: [0, 1, 0, 1], expected: 0 },
      { a: [1, 1, 0, 0], b: [0, 0, 1, 1], expected: 0 },
      { a: [1, 1, 0, 0], b: [1, 1, 0, 0], expected: 2 },
      { a: [1, 0, 1, 1], b: [1, 1, 0, 1], expected: 2 },
      { a: [0, 1, 1, 1], b: [1, 1, 1, 0], expected: 2 },
    ];
    
    testCases.forEach(({ a, b, expected }) => {
      const queryVec = new Uint8Array(a);
      const targetVec = new Uint8Array(b);
      const result = compute4BitDirectDotProduct(queryVec, targetVec);
      console.log(`${a.join('')} · ${b.join('')} = ${result} (期望: ${expected})`);
      expect(result).toBe(expected);
    });
    
    // 验证所有可能的组合
    let totalCombinations = 0;
    for (let a = 0; a < 16; a++) {
      for (let b = 0; b < 16; b++) {
        const aVec = new Uint8Array([
          (a >> 3) & 1,
          (a >> 2) & 1,
          (a >> 1) & 1,
          a & 1
        ]);
        const bVec = new Uint8Array([
          (b >> 3) & 1,
          (b >> 2) & 1,
          (b >> 1) & 1,
          b & 1
        ]);
        
        const lookupResult = compute4BitDirectDotProduct(aVec, bVec);
        const manualResult = DIRECT_4BIT_LOOKUP_TABLE[a * 16 + b]!;
        
        expect(lookupResult).toBe(manualResult);
        totalCombinations++;
      }
    }
    
    console.log(`验证了 ${totalCombinations} 个组合，全部正确`);
  });
  
  it('比较直接查表与传统方法的性能', () => {
    console.log('=== 直接查表性能对比测试 ===');
    
    const dimensions = [64, 256, 512, 1024, 2048];
    
    dimensions.forEach(dimension => {
      const { query, target } = createTestVectors(dimension);
      
      // 预热
      for (let i = 0; i < 10; i++) {
        compute4BitDirectDotProductOptimized(query, target);
        computeTraditionalDotProduct(query, target);
      }
      
      // 测试直接查表方法
      const directStart = performance.now();
      let directResult = 0;
      for (let i = 0; i < 1000; i++) {
        directResult = compute4BitDirectDotProductOptimized(query, target);
      }
      const directTime = performance.now() - directStart;
      
      // 测试传统方法
      const traditionalStart = performance.now();
      let traditionalResult = 0;
      for (let i = 0; i < 1000; i++) {
        traditionalResult = computeTraditionalDotProduct(query, target);
      }
      const traditionalTime = performance.now() - traditionalStart;
      
      // 验证结果一致性
      expect(directResult).toBe(traditionalResult);
      
      const speedup = traditionalTime / directTime;
      
      console.log(`维度 ${dimension}:`);
      console.log(`  直接查表: ${directTime.toFixed(3)}ms (结果: ${directResult})`);
      console.log(`  传统方法: ${traditionalTime.toFixed(3)}ms (结果: ${traditionalResult})`);
      console.log(`  加速比: ${speedup.toFixed(2)}x`);
      console.log('');
    });
  });
  
  it('测试批量计算性能', () => {
    console.log('=== 批量直接查表性能测试 ===');
    
    const dimension = 1024;
    const numVectors = 100;
    
    // 创建查询向量和多个目标向量
    const { query } = createTestVectors(dimension);
    const targetVectors: Uint8Array[] = [];
    
    for (let i = 0; i < numVectors; i++) {
      const target = new Uint8Array(dimension);
      for (let j = 0; j < dimension; j++) {
        target[j] = Math.random() > 0.5 ? 1 : 0;
      }
      targetVectors.push(target);
    }
    
    // 预热
    for (let i = 0; i < 5; i++) {
      computeBatch4BitDirectDotProduct(query, targetVectors);
    }
    
    // 测试批量直接查表方法
    const batchStart = performance.now();
    let batchResults: number[] = [];
    for (let i = 0; i < 10; i++) {
      batchResults = computeBatch4BitDirectDotProduct(query, targetVectors);
    }
    const batchTime = performance.now() - batchStart;
    
    // 测试逐个传统方法
    const individualStart = performance.now();
    let individualResults: number[] = [];
    for (let i = 0; i < 10; i++) {
      individualResults = targetVectors.map(target => 
        computeTraditionalDotProduct(query, target)
      );
    }
    const individualTime = performance.now() - individualStart;
    
    // 验证结果一致性
    for (let i = 0; i < numVectors; i++) {
      expect(batchResults[i]).toBe(individualResults[i]);
    }
    
    const speedup = individualTime / batchTime;
    
    console.log(`批量计算 ${numVectors} 个 ${dimension} 维向量:`);
    console.log(`  批量直接查表: ${batchTime.toFixed(3)}ms`);
    console.log(`  逐个传统: ${individualTime.toFixed(3)}ms`);
    console.log(`  加速比: ${speedup.toFixed(2)}x`);
    console.log(`  平均每个向量: ${(batchTime / numVectors / 10).toFixed(6)}ms`);
  });
  
  it('分析直接查表的优势', () => {
    console.log('=== 直接查表优势分析 ===');
    
    // 测量查表访问性能
    const accessStart = performance.now();
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      const a = i % 16;
      const b = (i * 7) % 16;
      sum += DIRECT_4BIT_LOOKUP_TABLE[a * 16 + b]!;
    }
    const accessTime = performance.now() - accessStart;
    
    console.log(`100万次直接查表访问: ${accessTime.toFixed(3)}ms`);
    console.log(`平均每次访问: ${(accessTime / 1000000).toFixed(6)}ms`);
    console.log(`查表内存占用: ${DIRECT_4BIT_LOOKUP_TABLE.length} 字节 (${(DIRECT_4BIT_LOOKUP_TABLE.length / 1024).toFixed(2)}KB)`);
    console.log(`查表创建时间: 0ms (编译时创建)`);
    
    // 测试不同稀疏度下的性能
    const dimension = 1024;
    const sparsityLevels = [0.1, 0.3, 0.5, 0.7, 0.9];
    
    console.log('\n=== 不同稀疏度性能测试 ===');
    
    sparsityLevels.forEach(sparsity => {
      const query = new Uint8Array(dimension);
      const target = new Uint8Array(dimension);
      
      for (let i = 0; i < dimension; i++) {
        query[i] = Math.random() > sparsity ? 1 : 0;
        target[i] = Math.random() > sparsity ? 1 : 0;
      }
      
      const iterations = 1000;
      
      const directStart = performance.now();
      let directResult = 0;
      for (let i = 0; i < iterations; i++) {
        directResult = compute4BitDirectDotProductOptimized(query, target);
      }
      const directTime = performance.now() - directStart;
      
      const traditionalStart = performance.now();
      let traditionalResult = 0;
      for (let i = 0; i < iterations; i++) {
        traditionalResult = computeTraditionalDotProduct(query, target);
      }
      const traditionalTime = performance.now() - traditionalStart;
      
      const speedup = traditionalTime / directTime;
      
      console.log(`稀疏度 ${(sparsity * 100).toFixed(0)}%:`);
      console.log(`  直接查表: ${directTime.toFixed(3)}ms, 传统: ${traditionalTime.toFixed(3)}ms`);
      console.log(`  加速比: ${speedup.toFixed(2)}x`);
      console.log(`  点积: ${directResult}/${dimension} (${((directResult / dimension) * 100).toFixed(1)}%)`);
      
      expect(directResult).toBe(traditionalResult);
    });
    
    expect(sum).toBeGreaterThan(0);
  });
  
  it('总结直接查表的优化效果', () => {
    console.log('=== 直接查表优化效果总结 ===');
    
    console.log('直接查表优势:');
    console.log('  - 无位打包转换开销');
    console.log('  - 直接使用向量值作为索引');
    console.log('  - 减少类型转换');
    console.log('  - 更简单的索引计算');
    console.log('');
    
    console.log('与内联查表对比:');
    console.log('  - 内联查表: 需要位打包操作');
    console.log('  - 直接查表: 直接使用向量值');
    console.log('  - 内联查表: 有类型转换开销');
    console.log('  - 直接查表: 无转换开销');
    console.log('');
    
    console.log('与直接计算对比:');
    console.log('  - 直接计算: 简单循环，JS引擎优化好');
    console.log('  - 直接查表: 索引计算+查表，可能更高效');
    console.log('  - 关键看实际性能测试结果');
    console.log('');
    
    console.log('适用场景:');
    console.log('  - 向量值直接可用作索引');
    console.log('  - 需要避免位操作开销');
    console.log('  - 大维度向量计算');
    console.log('  - 批量计算场景');
  });
}); 