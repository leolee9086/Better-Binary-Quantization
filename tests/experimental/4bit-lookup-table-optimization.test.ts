import { describe, it, expect } from 'vitest';

/**
 * 4位分组查表优化算法
 * 将1024维向量分组为256个4位组，使用预计算查表加速点积计算
 */

describe('4位分组查表优化算法', () => {
  
  /**
   * 预计算4位二进制向量点积查表
   * 两个4位二进制向量的点积结果范围：0-4
   */
  function create4BitLookupTable(): number[][] {
    const table: number[][] = [];
    
    // 遍历所有可能的4位二进制向量组合
    for (let a = 0; a < 16; a++) { // 4位二进制：0000-1111
      table[a] = [];
      for (let b = 0; b < 16; b++) {
        // 计算两个4位向量的点积
        let dotProduct = 0;
        for (let bit = 0; bit < 4; bit++) {
          const aBit = (a >> bit) & 1;
          const bBit = (b >> bit) & 1;
          dotProduct += aBit * bBit;
        }
        table[a]![b] = dotProduct;
      }
    }
    
    return table;
  }
  
  /**
   * 将向量填充到4的倍数
   */
  function padVectorToMultipleOf4(vector: Uint8Array): Uint8Array {
    const originalLength = vector.length;
    const paddedLength = Math.ceil(originalLength / 4) * 4;
    
    if (paddedLength === originalLength) {
      return vector; // 已经是4的倍数
    }
    
    const paddedVector = new Uint8Array(paddedLength);
    paddedVector.set(vector);
    
    // 填充部分用0填充
    for (let i = originalLength; i < paddedLength; i++) {
      paddedVector[i] = 0;
    }
    
    return paddedVector;
  }
  
  /**
   * 将4位二进制向量打包为单个字节
   */
  function pack4BitsToByte(bits: Uint8Array): number {
    if (bits.length !== 4) {
      throw new Error('必须是4位二进制向量');
    }
    
    return (bits[0]! << 3) | (bits[1]! << 2) | (bits[2]! << 1) | bits[3]!;
  }
  
  /**
   * 将字节解包为4位二进制向量
   */
  function unpackByteTo4Bits(byte: number): Uint8Array {
    return new Uint8Array([
      (byte >> 3) & 1,
      (byte >> 2) & 1,
      (byte >> 1) & 1,
      byte & 1
    ]);
  }
  
  /**
   * 使用查表优化的4位分组点积计算
   */
  function compute4BitGroupedDotProduct(
    queryVector: Uint8Array,
    targetVector: Uint8Array,
    lookupTable: number[][]
  ): number {
    // 确保向量长度是4的倍数
    const paddedQuery = padVectorToMultipleOf4(queryVector);
    const paddedTarget = padVectorToMultipleOf4(targetVector);
    
    if (paddedQuery.length !== paddedTarget.length) {
      throw new Error('向量长度不匹配');
    }
    
    let totalDotProduct = 0;
    const numGroups = paddedQuery.length / 4;
    
    for (let group = 0; group < numGroups; group++) {
      const groupStart = group * 4;
      
      // 提取4位组
      const queryGroup = paddedQuery.slice(groupStart, groupStart + 4);
      const targetGroup = paddedTarget.slice(groupStart, groupStart + 4);
      
      // 打包为字节用于查表
      const queryByte = pack4BitsToByte(queryGroup);
      const targetByte = pack4BitsToByte(targetGroup);
      
      // 查表获取点积
      const groupDotProduct = lookupTable[queryByte]![targetByte]!;
      totalDotProduct += groupDotProduct;
    }
    
    return totalDotProduct;
  }
  
  /**
   * 传统逐位点积计算（用于对比）
   */
  function computeTraditionalDotProduct(queryVector: Uint8Array, targetVector: Uint8Array): number {
    const paddedQuery = padVectorToMultipleOf4(queryVector);
    const paddedTarget = padVectorToMultipleOf4(targetVector);
    
    let dotProduct = 0;
    for (let i = 0; i < paddedQuery.length; i++) {
      dotProduct += paddedQuery[i]! * paddedTarget[i]!;
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
  
  it('验证4位查表的正确性', () => {
    const lookupTable = create4BitLookupTable();
    
    console.log('=== 4位查表验证 ===');
    console.log('查表大小:', lookupTable.length, 'x', lookupTable[0]?.length);
    
    // 验证一些特殊情况
    const testCases = [
      { a: 0b0000, b: 0b0000, expected: 0 }, // 全0
      { a: 0b1111, b: 0b1111, expected: 4 }, // 全1
      { a: 0b1010, b: 0b1010, expected: 2 }, // 交替1
      { a: 0b1010, b: 0b0101, expected: 0 }, // 互补
      { a: 0b1100, b: 0b0011, expected: 0 }, // 互补
      { a: 0b1100, b: 0b1100, expected: 2 }, // 相同
    ];
    
    testCases.forEach(({ a, b, expected }) => {
      const result = lookupTable[a]![b]!;
      console.log(`${a.toString(2).padStart(4, '0')} · ${b.toString(2).padStart(4, '0')} = ${result} (期望: ${expected})`);
      expect(result).toBe(expected);
    });
    
    // 验证所有可能的组合
    let totalCombinations = 0;
    for (let a = 0; a < 16; a++) {
      for (let b = 0; b < 16; b++) {
        const lookupResult = lookupTable[a]![b]!;
        const manualResult = computeTraditionalDotProduct(
          unpackByteTo4Bits(a),
          unpackByteTo4Bits(b)
        );
        expect(lookupResult).toBe(manualResult);
        totalCombinations++;
      }
    }
    
    console.log(`验证了 ${totalCombinations} 个组合，全部正确`);
  });
  
  it('比较查表优化与传统方法的性能', () => {
    const lookupTable = create4BitLookupTable();
    const dimensions = [64, 256, 512, 1024];
    
    console.log('=== 性能对比测试 ===');
    
    dimensions.forEach(dimension => {
      const { query, target } = createTestVectors(dimension);
      
      // 预热
      for (let i = 0; i < 10; i++) {
        compute4BitGroupedDotProduct(query, target, lookupTable);
        computeTraditionalDotProduct(query, target);
      }
      
      // 测试查表方法
      const lookupStart = performance.now();
      let lookupResult = 0;
      for (let i = 0; i < 1000; i++) {
        lookupResult = compute4BitGroupedDotProduct(query, target, lookupTable);
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
      console.log(`  查表方法: ${lookupTime.toFixed(3)}ms (结果: ${lookupResult})`);
      console.log(`  传统方法: ${traditionalTime.toFixed(3)}ms (结果: ${traditionalResult})`);
      console.log(`  加速比: ${speedup.toFixed(2)}x`);
      console.log('');
    });
  });
  
  it('测试不同稀疏度下的性能表现', () => {
    const lookupTable = create4BitLookupTable();
    const dimension = 1024;
    const sparsityLevels = [0.1, 0.3, 0.5, 0.7, 0.9];
    
    console.log('=== 不同稀疏度性能测试 ===');
    
    sparsityLevels.forEach(sparsity => {
      // 创建指定稀疏度的向量
      const query = new Uint8Array(dimension);
      const target = new Uint8Array(dimension);
      
      for (let i = 0; i < dimension; i++) {
        query[i] = Math.random() > sparsity ? 1 : 0;
        target[i] = Math.random() > sparsity ? 1 : 0;
      }
      
      // 性能测试
      const iterations = 1000;
      
      const lookupStart = performance.now();
      let lookupResult = 0;
      for (let i = 0; i < iterations; i++) {
        lookupResult = compute4BitGroupedDotProduct(query, target, lookupTable);
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
      console.log(`  查表: ${lookupTime.toFixed(3)}ms, 传统: ${traditionalTime.toFixed(3)}ms, 加速: ${speedup.toFixed(2)}x`);
      console.log(`  点积结果: ${lookupResult}/${dimension} (${((lookupResult / dimension) * 100).toFixed(1)}%)`);
      
      expect(lookupResult).toBe(traditionalResult);
    });
  });
  
  it('分析查表的内存占用和初始化开销', () => {
    console.log('=== 查表开销分析 ===');
    
    // 测量查表创建时间
    const createStart = performance.now();
    const lookupTable = create4BitLookupTable();
    const createTime = performance.now() - createStart;
    
    // 计算内存占用（粗略估计）
    const tableSize = lookupTable.length * lookupTable[0]!.length * 8; // 假设每个number是8字节
    const tableSizeKB = tableSize / 1024;
    
    console.log(`查表创建时间: ${createTime.toFixed(3)}ms`);
    console.log(`查表内存占用: ${tableSizeKB.toFixed(2)}KB`);
    console.log(`查表大小: ${lookupTable.length} x ${lookupTable[0]?.length} = ${lookupTable.length * lookupTable[0]!.length} 个条目`);
    
    // 验证查表内容
    expect(lookupTable.length).toBe(16);
    expect(lookupTable[0]!.length).toBe(16);
    
    // 测试查表访问性能
    const accessStart = performance.now();
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      const a = i % 16;
      const b = (i * 7) % 16;
      sum += lookupTable[a]![b]!;
    }
    const accessTime = performance.now() - accessStart;
    
    console.log(`100万次查表访问时间: ${accessTime.toFixed(3)}ms`);
    console.log(`平均每次访问: ${(accessTime / 1000000).toFixed(6)}ms`);
    
    expect(sum).toBeGreaterThan(0); // 确保查表工作正常
  });
}); 