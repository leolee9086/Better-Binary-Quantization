import { describe, it, expect } from 'vitest';

/**
 * 4位内联查表优化算法
 * 直接在代码中硬编码查表，避免运行时创建表的开销
 */

describe('4位内联查表优化算法', () => {
  
  /**
   * 预计算的4位二进制向量点积查表（内联版本）
   * 两个4位二进制向量的点积结果范围：0-4
   * 表大小：16 x 16 = 256 个条目
   */
  const INLINE_4BIT_LOOKUP_TABLE = new Uint8Array([
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
   * 使用内联查表的4位分组点积计算
   */
  function compute4BitInlineDotProduct(
    queryVector: Uint8Array,
    targetVector: Uint8Array
  ): number {
    const length = Math.max(queryVector.length, targetVector.length);
    const paddedLength = Math.ceil(length / 4) * 4;
    
    let totalDotProduct = 0;
    const numGroups = paddedLength / 4;
    
    for (let group = 0; group < numGroups; group++) {
      const groupStart = group * 4;
      
      // 直接计算4位组的字节值，避免slice操作
      let queryByte = 0;
      let targetByte = 0;
      
      for (let bit = 0; bit < 4; bit++) {
        const index = groupStart + bit;
        const queryBit = index < queryVector.length ? queryVector[index]! : 0;
        const targetBit = index < targetVector.length ? targetVector[index]! : 0;
        
        queryByte |= queryBit << (3 - bit);
        targetByte |= targetBit << (3 - bit);
      }
      
      // 直接查表获取点积
      totalDotProduct += INLINE_4BIT_LOOKUP_TABLE[queryByte * 16 + targetByte]!;
    }
    
    return totalDotProduct;
  }
  
  /**
   * 批量4位内联查表点积计算
   */
  function computeBatch4BitInlineDotProduct(
    queryVector: Uint8Array,
    targetVectors: Uint8Array[]
  ): number[] {
    const results = new Array(targetVectors.length);
    
    for (let vecIndex = 0; vecIndex < targetVectors.length; vecIndex++) {
      results[vecIndex] = compute4BitInlineDotProduct(
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
  
  it('验证内联查表的正确性', () => {
    console.log('=== 内联查表验证 ===');
    console.log('查表大小:', INLINE_4BIT_LOOKUP_TABLE.length, '个条目');
    
    // 验证一些特殊情况
    const testCases = [
      { a: 0b0000, b: 0b0000, expected: 0 },
      { a: 0b1111, b: 0b1111, expected: 4 },
      { a: 0b1010, b: 0b1010, expected: 2 },
      { a: 0b1010, b: 0b0101, expected: 0 },
      { a: 0b1100, b: 0b0011, expected: 0 },
      { a: 0b1100, b: 0b1100, expected: 2 },
      { a: 0b1011, b: 0b1101, expected: 2 },
      { a: 0b0111, b: 0b1110, expected: 2 },
    ];
    
    testCases.forEach(({ a, b, expected }) => {
      const result = INLINE_4BIT_LOOKUP_TABLE[a * 16 + b]!;
      console.log(`${a.toString(2).padStart(4, '0')} · ${b.toString(2).padStart(4, '0')} = ${result} (期望: ${expected})`);
      expect(result).toBe(expected);
    });
    
    // 验证所有可能的组合
    let totalCombinations = 0;
    for (let a = 0; a < 16; a++) {
      for (let b = 0; b < 16; b++) {
        const lookupResult = INLINE_4BIT_LOOKUP_TABLE[a * 16 + b]!;
        
        // 手动计算验证
        let manualResult = 0;
        for (let bit = 0; bit < 4; bit++) {
          const aBit = (a >> bit) & 1;
          const bBit = (b >> bit) & 1;
          manualResult += aBit * bBit;
        }
        
        expect(lookupResult).toBe(manualResult);
        totalCombinations++;
      }
    }
    
    console.log(`验证了 ${totalCombinations} 个组合，全部正确`);
  });
  
  it('比较内联查表与传统方法的性能', () => {
    console.log('=== 内联查表性能对比测试 ===');
    
    const dimensions = [64, 256, 512, 1024];
    
    dimensions.forEach(dimension => {
      const { query, target } = createTestVectors(dimension);
      
      // 预热
      for (let i = 0; i < 10; i++) {
        compute4BitInlineDotProduct(query, target);
        computeTraditionalDotProduct(query, target);
      }
      
      // 测试内联查表方法
      const inlineStart = performance.now();
      let inlineResult = 0;
      for (let i = 0; i < 1000; i++) {
        inlineResult = compute4BitInlineDotProduct(query, target);
      }
      const inlineTime = performance.now() - inlineStart;
      
      // 测试传统方法
      const traditionalStart = performance.now();
      let traditionalResult = 0;
      for (let i = 0; i < 1000; i++) {
        traditionalResult = computeTraditionalDotProduct(query, target);
      }
      const traditionalTime = performance.now() - traditionalStart;
      
      // 验证结果一致性
      expect(inlineResult).toBe(traditionalResult);
      
      const speedup = traditionalTime / inlineTime;
      
      console.log(`维度 ${dimension}:`);
      console.log(`  内联查表: ${inlineTime.toFixed(3)}ms (结果: ${inlineResult})`);
      console.log(`  传统方法: ${traditionalTime.toFixed(3)}ms (结果: ${traditionalResult})`);
      console.log(`  加速比: ${speedup.toFixed(2)}x`);
      console.log('');
    });
  });
  
  it('测试批量计算性能', () => {
    console.log('=== 批量内联查表性能测试 ===');
    
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
      computeBatch4BitInlineDotProduct(query, targetVectors);
    }
    
    // 测试批量内联查表方法
    const batchStart = performance.now();
    let batchResults: number[] = [];
    for (let i = 0; i < 10; i++) {
      batchResults = computeBatch4BitInlineDotProduct(query, targetVectors);
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
    console.log(`  批量内联查表: ${batchTime.toFixed(3)}ms`);
    console.log(`  逐个传统: ${individualTime.toFixed(3)}ms`);
    console.log(`  加速比: ${speedup.toFixed(2)}x`);
    console.log(`  平均每个向量: ${(batchTime / numVectors / 10).toFixed(6)}ms`);
  });
  
  it('分析内联查表的优势', () => {
    console.log('=== 内联查表优势分析 ===');
    
    // 测量查表访问性能
    const accessStart = performance.now();
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      const a = i % 16;
      const b = (i * 7) % 16;
      sum += INLINE_4BIT_LOOKUP_TABLE[a * 16 + b]!;
    }
    const accessTime = performance.now() - accessStart;
    
    console.log(`100万次内联查表访问: ${accessTime.toFixed(3)}ms`);
    console.log(`平均每次访问: ${(accessTime / 1000000).toFixed(6)}ms`);
    console.log(`查表内存占用: ${INLINE_4BIT_LOOKUP_TABLE.length} 字节 (${(INLINE_4BIT_LOOKUP_TABLE.length / 1024).toFixed(2)}KB)`);
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
      
      const inlineStart = performance.now();
      let inlineResult = 0;
      for (let i = 0; i < iterations; i++) {
        inlineResult = compute4BitInlineDotProduct(query, target);
      }
      const inlineTime = performance.now() - inlineStart;
      
      const traditionalStart = performance.now();
      let traditionalResult = 0;
      for (let i = 0; i < iterations; i++) {
        traditionalResult = computeTraditionalDotProduct(query, target);
      }
      const traditionalTime = performance.now() - traditionalStart;
      
      const speedup = traditionalTime / inlineTime;
      
      console.log(`稀疏度 ${(sparsity * 100).toFixed(0)}%:`);
      console.log(`  内联查表: ${inlineTime.toFixed(3)}ms, 传统: ${traditionalTime.toFixed(3)}ms`);
      console.log(`  加速比: ${speedup.toFixed(2)}x`);
      console.log(`  点积: ${inlineResult}/${dimension} (${((inlineResult / dimension) * 100).toFixed(1)}%)`);
      
      expect(inlineResult).toBe(traditionalResult);
    });
    
    expect(sum).toBeGreaterThan(0);
  });
  
  it('总结内联查表的优化效果', () => {
    console.log('=== 内联查表优化效果总结 ===');
    
    console.log('内联查表优势:');
    console.log('  - 无运行时创建开销');
    console.log('  - 编译时优化');
    console.log('  - 内存访问更直接');
    console.log('  - 减少函数调用开销');
    console.log('');
    
    console.log('与传统查表对比:');
    console.log('  - 传统查表: 需要运行时创建表');
    console.log('  - 内联查表: 编译时已创建');
    console.log('  - 传统查表: 可能有GC压力');
    console.log('  - 内联查表: 静态内存分配');
    console.log('');
    
    console.log('与直接计算对比:');
    console.log('  - 直接计算: 简单循环，JS引擎优化好');
    console.log('  - 内联查表: 位操作+查表，可能更复杂');
    console.log('  - 关键看实际性能测试结果');
    console.log('');
    
    console.log('适用场景:');
    console.log('  - 查表创建开销大的场景');
    console.log('  - 需要极致性能的场景');
    console.log('  - 内存受限的环境');
    console.log('  - 编译时优化的环境');
  });
}); 