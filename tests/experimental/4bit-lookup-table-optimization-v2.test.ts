import { describe, it, expect } from 'vitest';

/**
 * 4位分组查表优化算法 V2
 * 优化版本：减少内存分配，使用更高效的打包方式
 */

describe('4位分组查表优化算法 V2', () => {
  
  /**
   * 预计算4位二进制向量点积查表（优化版本）
   */
  function create4BitLookupTable(): Uint8Array {
    // 使用Uint8Array而不是二维数组，减少内存占用
    const table = new Uint8Array(256); // 16 * 16 = 256
    
    for (let a = 0; a < 16; a++) {
      for (let b = 0; b < 16; b++) {
        let dotProduct = 0;
        for (let bit = 0; bit < 4; bit++) {
          const aBit = (a >> bit) & 1;
          const bBit = (b >> bit) & 1;
          dotProduct += aBit * bBit;
        }
        table[a * 16 + b] = dotProduct;
      }
    }
    
    return table;
  }
  
  /**
   * 优化的4位分组点积计算（避免内存分配）
   */
  function compute4BitGroupedDotProductOptimized(
    queryVector: Uint8Array,
    targetVector: Uint8Array,
    lookupTable: Uint8Array
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
      
      // 查表获取点积
      totalDotProduct += lookupTable[queryByte * 16 + targetByte]!;
    }
    
    return totalDotProduct;
  }
  
  /**
   * 批量4位分组点积计算（针对多个目标向量）
   */
  function computeBatch4BitGroupedDotProduct(
    queryVector: Uint8Array,
    targetVectors: Uint8Array[],
    lookupTable: Uint8Array
  ): number[] {
    const results = new Array(targetVectors.length);
    
    for (let vecIndex = 0; vecIndex < targetVectors.length; vecIndex++) {
      results[vecIndex] = compute4BitGroupedDotProductOptimized(
        queryVector,
        targetVectors[vecIndex]!,
        lookupTable
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
  
  it('验证优化版查表的正确性', () => {
    const lookupTable = create4BitLookupTable();
    
    console.log('=== 优化版查表验证 ===');
    console.log('查表大小:', lookupTable.length, '个条目');
    
    // 验证一些特殊情况
    const testCases = [
      { a: 0b0000, b: 0b0000, expected: 0 },
      { a: 0b1111, b: 0b1111, expected: 4 },
      { a: 0b1010, b: 0b1010, expected: 2 },
      { a: 0b1010, b: 0b0101, expected: 0 },
      { a: 0b1100, b: 0b0011, expected: 0 },
      { a: 0b1100, b: 0b1100, expected: 2 },
    ];
    
    testCases.forEach(({ a, b, expected }) => {
      const result = lookupTable[a * 16 + b]!;
      console.log(`${a.toString(2).padStart(4, '0')} · ${b.toString(2).padStart(4, '0')} = ${result} (期望: ${expected})`);
      expect(result).toBe(expected);
    });
    
    // 验证所有可能的组合
    let totalCombinations = 0;
    for (let a = 0; a < 16; a++) {
      for (let b = 0; b < 16; b++) {
        const lookupResult = lookupTable[a * 16 + b]!;
        
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
  
  it('比较优化版查表与传统方法的性能', () => {
    const lookupTable = create4BitLookupTable();
    const dimensions = [64, 256, 512, 1024];
    
    console.log('=== 优化版性能对比测试 ===');
    
    dimensions.forEach(dimension => {
      const { query, target } = createTestVectors(dimension);
      
      // 预热
      for (let i = 0; i < 10; i++) {
        compute4BitGroupedDotProductOptimized(query, target, lookupTable);
        computeTraditionalDotProduct(query, target);
      }
      
      // 测试优化版查表方法
      const lookupStart = performance.now();
      let lookupResult = 0;
      for (let i = 0; i < 1000; i++) {
        lookupResult = compute4BitGroupedDotProductOptimized(query, target, lookupTable);
      }
      const lookupTime = performance.now() - lookupStart;
      
      // 测试传统方法
      const traditionalStart = performance.now();
      let traditionalResult = 0;
      for (let i = 0; i < 1000; i++) {
        traditionalResult = computeTraditionalDotProduct(query, target);
      }
      const traditionalTime = performance.now() - traditionalStart;
      
      // 验证结果一致性
      expect(lookupResult).toBe(traditionalResult);
      
      const speedup = traditionalTime / lookupTime;
      
      console.log(`维度 ${dimension}:`);
      console.log(`  优化查表: ${lookupTime.toFixed(3)}ms (结果: ${lookupResult})`);
      console.log(`  传统方法: ${traditionalTime.toFixed(3)}ms (结果: ${traditionalResult})`);
      console.log(`  加速比: ${speedup.toFixed(2)}x`);
      console.log('');
    });
  });
  
  it('测试批量计算性能', () => {
    const lookupTable = create4BitLookupTable();
    const dimension = 1024;
    const numVectors = 100;
    
    console.log('=== 批量计算性能测试 ===');
    
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
      computeBatch4BitGroupedDotProduct(query, targetVectors, lookupTable);
    }
    
    // 测试批量查表方法
    const batchStart = performance.now();
    let batchResults: number[] = [];
    for (let i = 0; i < 10; i++) {
      batchResults = computeBatch4BitGroupedDotProduct(query, targetVectors, lookupTable);
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
    console.log(`  批量查表: ${batchTime.toFixed(3)}ms`);
    console.log(`  逐个传统: ${individualTime.toFixed(3)}ms`);
    console.log(`  加速比: ${speedup.toFixed(2)}x`);
    console.log(`  平均每个向量: ${(batchTime / numVectors / 10).toFixed(6)}ms`);
  });
  
  it('分析内存占用和缓存效率', () => {
    console.log('=== 内存占用和缓存效率分析 ===');
    
    // 测量查表创建时间和内存
    const createStart = performance.now();
    const lookupTable = create4BitLookupTable();
    const createTime = performance.now() - createStart;
    
    console.log(`查表创建时间: ${createTime.toFixed(3)}ms`);
    console.log(`查表内存占用: ${lookupTable.length} 字节 (${(lookupTable.length / 1024).toFixed(2)}KB)`);
    
    // 测试缓存效率
    const testVector = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) {
      testVector[i] = Math.random() > 0.5 ? 1 : 0;
    }
    
    // 测试重复访问同一查表条目的性能
    const cacheTestStart = performance.now();
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      const a = (i >> 16) & 0xF; // 使用高位作为索引
      const b = (i >> 12) & 0xF;
      sum += lookupTable[a * 16 + b]!;
    }
    const cacheTestTime = performance.now() - cacheTestStart;
    
    console.log(`100万次查表访问: ${cacheTestTime.toFixed(3)}ms`);
    console.log(`平均每次访问: ${(cacheTestTime / 1000000).toFixed(6)}ms`);
    console.log(`查表命中率: 100% (预计算表)`);
    
    expect(sum).toBeGreaterThan(0);
  });
  
  it('测试不同向量长度的性能表现', () => {
    const lookupTable = create4BitLookupTable();
    const lengths = [128, 256, 512, 1024, 2048, 4096];
    
    console.log('=== 不同向量长度性能测试 ===');
    
    lengths.forEach(length => {
      const { query, target } = createTestVectors(length);
      
      // 预热
      for (let i = 0; i < 5; i++) {
        compute4BitGroupedDotProductOptimized(query, target, lookupTable);
        computeTraditionalDotProduct(query, target);
      }
      
      // 性能测试
      const iterations = Math.max(100, 10000 / length); // 根据长度调整迭代次数
      
      const lookupStart = performance.now();
      let lookupResult = 0;
      for (let i = 0; i < iterations; i++) {
        lookupResult = compute4BitGroupedDotProductOptimized(query, target, lookupTable);
      }
      const lookupTime = performance.now() - lookupStart;
      
      const traditionalStart = performance.now();
      let traditionalResult = 0;
      for (let i = 0; i < iterations; i++) {
        traditionalResult = computeTraditionalDotProduct(query, target);
      }
      const traditionalTime = performance.now() - traditionalStart;
      
      const speedup = traditionalTime / lookupTime;
      const avgLookupTime = lookupTime / iterations;
      const avgTraditionalTime = traditionalTime / iterations;
      
      console.log(`长度 ${length}:`);
      console.log(`  查表: ${avgLookupTime.toFixed(6)}ms/次, 传统: ${avgTraditionalTime.toFixed(6)}ms/次`);
      console.log(`  加速比: ${speedup.toFixed(2)}x`);
      
      expect(lookupResult).toBe(traditionalResult);
    });
  });
}); 