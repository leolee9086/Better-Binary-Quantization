import { describe, it, expect } from 'vitest';

/**
 * 8位分组查表优化算法
 * 使用8位分组，减少查表次数，提高性能
 */

describe('8位分组查表优化算法', () => {
  
  /**
   * 预计算8位二进制向量点积查表
   * 注意：8位查表会很大 (256 x 256 = 65536 条目)
   */
  function create8BitLookupTable(): Uint8Array {
    const table = new Uint8Array(65536); // 256 * 256 = 65536
    
    for (let a = 0; a < 256; a++) {
      for (let b = 0; b < 256; b++) {
        let dotProduct = 0;
        for (let bit = 0; bit < 8; bit++) {
          const aBit = (a >> bit) & 1;
          const bBit = (b >> bit) & 1;
          dotProduct += aBit * bBit;
        }
        table[a * 256 + b] = dotProduct;
      }
    }
    
    return table;
  }
  
  /**
   * 8位分组点积计算
   */
  function compute8BitGroupedDotProduct(
    queryVector: Uint8Array,
    targetVector: Uint8Array,
    lookupTable: Uint8Array
  ): number {
    const length = Math.max(queryVector.length, targetVector.length);
    const paddedLength = Math.ceil(length / 8) * 8;
    
    let totalDotProduct = 0;
    const numGroups = paddedLength / 8;
    
    for (let group = 0; group < numGroups; group++) {
      const groupStart = group * 8;
      
      // 直接使用字节值，避免位打包
      let queryByte = 0;
      let targetByte = 0;
      
      for (let bit = 0; bit < 8; bit++) {
        const index = groupStart + bit;
        const queryBit = index < queryVector.length ? queryVector[index]! : 0;
        const targetBit = index < targetVector.length ? targetVector[index]! : 0;
        
        queryByte |= queryBit << (7 - bit);
        targetByte |= targetBit << (7 - bit);
      }
      
      // 查表获取点积
      totalDotProduct += lookupTable[queryByte * 256 + targetByte]!;
    }
    
    return totalDotProduct;
  }
  
  /**
   * 传统逐位点积计算
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
  
  it('验证8位查表的正确性', () => {
    console.log('=== 8位查表验证 ===');
    console.log('正在创建8位查表...');
    
    const createStart = performance.now();
    const lookupTable = create8BitLookupTable();
    const createTime = performance.now() - createStart;
    
    console.log(`查表创建时间: ${createTime.toFixed(3)}ms`);
    console.log(`查表大小: ${lookupTable.length} 个条目 (${(lookupTable.length / 1024).toFixed(2)}KB)`);
    
    // 验证一些特殊情况
    const testCases = [
      { a: 0b00000000, b: 0b00000000, expected: 0 },
      { a: 0b11111111, b: 0b11111111, expected: 8 },
      { a: 0b10101010, b: 0b10101010, expected: 4 },
      { a: 0b10101010, b: 0b01010101, expected: 0 },
      { a: 0b11001100, b: 0b00110011, expected: 0 },
      { a: 0b11001100, b: 0b11001100, expected: 4 },
    ];
    
    testCases.forEach(({ a, b, expected }) => {
      const result = lookupTable[a * 256 + b]!;
      console.log(`${a.toString(2).padStart(8, '0')} · ${b.toString(2).padStart(8, '0')} = ${result} (期望: ${expected})`);
      expect(result).toBe(expected);
    });
    
    // 验证一些随机组合
    let totalCombinations = 0;
    for (let i = 0; i < 1000; i++) {
      const a = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      
      const lookupResult = lookupTable[a * 256 + b]!;
      
      // 手动计算验证
      let manualResult = 0;
      for (let bit = 0; bit < 8; bit++) {
        const aBit = (a >> bit) & 1;
        const bBit = (b >> bit) & 1;
        manualResult += aBit * bBit;
      }
      
      expect(lookupResult).toBe(manualResult);
      totalCombinations++;
    }
    
    console.log(`验证了 ${totalCombinations} 个随机组合，全部正确`);
  });
  
  it('比较8位查表与传统方法的性能', () => {
    console.log('=== 8位查表性能对比测试 ===');
    
    const createStart = performance.now();
    const lookupTable = create8BitLookupTable();
    const createTime = performance.now() - createStart;
    
    console.log(`查表创建时间: ${createTime.toFixed(3)}ms`);
    
    const dimensions = [64, 256, 512, 1024];
    
    dimensions.forEach(dimension => {
      const { query, target } = createTestVectors(dimension);
      
      // 预热
      for (let i = 0; i < 10; i++) {
        compute8BitGroupedDotProduct(query, target, lookupTable);
        computeTraditionalDotProduct(query, target);
      }
      
      // 测试8位查表方法
      const lookupStart = performance.now();
      let lookupResult = 0;
      for (let i = 0; i < 1000; i++) {
        lookupResult = compute8BitGroupedDotProduct(query, target, lookupTable);
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
      console.log(`  8位查表: ${lookupTime.toFixed(3)}ms (结果: ${lookupResult})`);
      console.log(`  传统方法: ${traditionalTime.toFixed(3)}ms (结果: ${traditionalResult})`);
      console.log(`  加速比: ${speedup.toFixed(2)}x`);
      console.log('');
    });
  });
  
  it('分析8位查表的适用性', () => {
    console.log('=== 8位查表适用性分析 ===');
    
    const lookupTable = create8BitLookupTable();
    const dimension = 1024;
    
    // 测试不同稀疏度
    const sparsityLevels = [0.1, 0.3, 0.5, 0.7, 0.9];
    
    sparsityLevels.forEach(sparsity => {
      const query = new Uint8Array(dimension);
      const target = new Uint8Array(dimension);
      
      for (let i = 0; i < dimension; i++) {
        query[i] = Math.random() > sparsity ? 1 : 0;
        target[i] = Math.random() > sparsity ? 1 : 0;
      }
      
      const iterations = 1000;
      
      const lookupStart = performance.now();
      let lookupResult = 0;
      for (let i = 0; i < iterations; i++) {
        lookupResult = compute8BitGroupedDotProduct(query, target, lookupTable);
      }
      const lookupTime = performance.now() - lookupStart;
      
      const traditionalStart = performance.now();
      let traditionalResult = 0;
      for (let i = 0; i < iterations; i++) {
        traditionalResult = computeTraditionalDotProduct(query, target);
      }
      const traditionalTime = performance.now() - traditionalStart;
      
      const speedup = traditionalTime / lookupTime;
      
      console.log(`稀疏度 ${(sparsity * 100).toFixed(0)}%:`);
      console.log(`  8位查表: ${lookupTime.toFixed(3)}ms, 传统: ${traditionalTime.toFixed(3)}ms`);
      console.log(`  加速比: ${speedup.toFixed(2)}x`);
      console.log(`  点积: ${lookupResult}/${dimension} (${((lookupResult / dimension) * 100).toFixed(1)}%)`);
      
      expect(lookupResult).toBe(traditionalResult);
    });
  });
  
  it('总结查表优化的效果', () => {
    console.log('=== 查表优化效果总结 ===');
    
    console.log('4位分组查表:');
    console.log('  - 查表大小: 256 条目 (0.25KB)');
    console.log('  - 创建时间: ~0.04ms');
    console.log('  - 性能: 比传统方法慢 20-30%');
    console.log('');
    
    console.log('8位分组查表:');
    console.log('  - 查表大小: 65536 条目 (64KB)');
    console.log('  - 创建时间: ~10-20ms');
    console.log('  - 性能: 需要测试验证');
    console.log('');
    
    console.log('结论:');
    console.log('  - 查表优化在JavaScript中效果有限');
    console.log('  - 主要原因是JS引擎对简单循环的优化');
    console.log('  - 位操作和查表访问的开销抵消了查表优势');
    console.log('  - 对于二进制向量，直接计算可能更高效');
    console.log('');
    
    console.log('建议:');
    console.log('  - 优先考虑内存访问模式优化');
    console.log('  - 使用批量处理和向量化操作');
    console.log('  - 考虑SIMD指令或WebAssembly');
    console.log('  - 查表优化更适合复杂计算场景');
  });
}); 