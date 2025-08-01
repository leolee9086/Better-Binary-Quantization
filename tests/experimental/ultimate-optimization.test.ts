import { describe, it, expect } from 'vitest';

/**
 * 极致性能优化算法组合
 * 融合所有最佳实践：直接查表 + 批量处理 + 循环展开 + 内存优化 + 混合策略
 */

describe('极致性能优化算法组合', () => {
  
  /**
   * 预计算的4位二进制向量点积查表（极致优化版本）
   * 使用Uint8Array确保最小内存占用和最快访问
   */
  const ULTIMATE_4BIT_LOOKUP_TABLE = new Uint8Array([
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
   * 极致优化的单向量点积计算
   * 使用16路循环展开，避免边界检查，内联所有计算
   */
  function computeUltimateDotProduct(
    queryVector: Uint8Array,
    targetVector: Uint8Array
  ): number {
    const length = queryVector.length;
    let totalDotProduct = 0;
    
    // 16路循环展开，处理大部分数据
    const mainLoopEnd = length - (length % 16);
    for (let i = 0; i < mainLoopEnd; i += 16) {
      // 直接访问，避免边界检查
      totalDotProduct += queryVector[i]! * targetVector[i]!;
      totalDotProduct += queryVector[i + 1]! * targetVector[i + 1]!;
      totalDotProduct += queryVector[i + 2]! * targetVector[i + 2]!;
      totalDotProduct += queryVector[i + 3]! * targetVector[i + 3]!;
      totalDotProduct += queryVector[i + 4]! * targetVector[i + 4]!;
      totalDotProduct += queryVector[i + 5]! * targetVector[i + 5]!;
      totalDotProduct += queryVector[i + 6]! * targetVector[i + 6]!;
      totalDotProduct += queryVector[i + 7]! * targetVector[i + 7]!;
      totalDotProduct += queryVector[i + 8]! * targetVector[i + 8]!;
      totalDotProduct += queryVector[i + 9]! * targetVector[i + 9]!;
      totalDotProduct += queryVector[i + 10]! * targetVector[i + 10]!;
      totalDotProduct += queryVector[i + 11]! * targetVector[i + 11]!;
      totalDotProduct += queryVector[i + 12]! * targetVector[i + 12]!;
      totalDotProduct += queryVector[i + 13]! * targetVector[i + 13]!;
      totalDotProduct += queryVector[i + 14]! * targetVector[i + 14]!;
      totalDotProduct += queryVector[i + 15]! * targetVector[i + 15]!;
    }
    
    // 处理剩余元素
    for (let i = mainLoopEnd; i < length; i++) {
      totalDotProduct += queryVector[i]! * targetVector[i]!;
    }
    
    return totalDotProduct;
  }
  
  /**
   * 极致优化的4位查表点积计算
   * 使用8路循环展开，内联索引计算
   */
  function computeUltimate4BitDotProduct(
    queryVector: Uint8Array,
    targetVector: Uint8Array
  ): number {
    const length = queryVector.length;
    let totalDotProduct = 0;
    
    // 8路循环展开，处理大部分4位组
    const mainLoopEnd = length - (length % 32); // 8组 * 4位 = 32位
    for (let i = 0; i < mainLoopEnd; i += 32) {
      // 组0
      const q0 = (queryVector[i] ?? 0) * 8 + (queryVector[i + 1] ?? 0) * 4 + (queryVector[i + 2] ?? 0) * 2 + (queryVector[i + 3] ?? 0);
      const t0 = (targetVector[i] ?? 0) * 8 + (targetVector[i + 1] ?? 0) * 4 + (targetVector[i + 2] ?? 0) * 2 + (targetVector[i + 3] ?? 0);
      totalDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q0 * 16 + t0]!;
      
      // 组1
      const q1 = (queryVector[i + 4] ?? 0) * 8 + (queryVector[i + 5] ?? 0) * 4 + (queryVector[i + 6] ?? 0) * 2 + (queryVector[i + 7] ?? 0);
      const t1 = (targetVector[i + 4] ?? 0) * 8 + (targetVector[i + 5] ?? 0) * 4 + (targetVector[i + 6] ?? 0) * 2 + (targetVector[i + 7] ?? 0);
      totalDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q1 * 16 + t1]!;
      
      // 组2
      const q2 = (queryVector[i + 8] ?? 0) * 8 + (queryVector[i + 9] ?? 0) * 4 + (queryVector[i + 10] ?? 0) * 2 + (queryVector[i + 11] ?? 0);
      const t2 = (targetVector[i + 8] ?? 0) * 8 + (targetVector[i + 9] ?? 0) * 4 + (targetVector[i + 10] ?? 0) * 2 + (targetVector[i + 11] ?? 0);
      totalDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q2 * 16 + t2]!;
      
      // 组3
      const q3 = (queryVector[i + 12] ?? 0) * 8 + (queryVector[i + 13] ?? 0) * 4 + (queryVector[i + 14] ?? 0) * 2 + (queryVector[i + 15] ?? 0);
      const t3 = (targetVector[i + 12] ?? 0) * 8 + (targetVector[i + 13] ?? 0) * 4 + (targetVector[i + 14] ?? 0) * 2 + (targetVector[i + 15] ?? 0);
      totalDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q3 * 16 + t3]!;
      
      // 组4
      const q4 = (queryVector[i + 16] ?? 0) * 8 + (queryVector[i + 17] ?? 0) * 4 + (queryVector[i + 18] ?? 0) * 2 + (queryVector[i + 19] ?? 0);
      const t4 = (targetVector[i + 16] ?? 0) * 8 + (targetVector[i + 17] ?? 0) * 4 + (targetVector[i + 18] ?? 0) * 2 + (targetVector[i + 19] ?? 0);
      totalDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q4 * 16 + t4]!;
      
      // 组5
      const q5 = (queryVector[i + 20] ?? 0) * 8 + (queryVector[i + 21] ?? 0) * 4 + (queryVector[i + 22] ?? 0) * 2 + (queryVector[i + 23] ?? 0);
      const t5 = (targetVector[i + 20] ?? 0) * 8 + (targetVector[i + 21] ?? 0) * 4 + (targetVector[i + 22] ?? 0) * 2 + (targetVector[i + 23] ?? 0);
      totalDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q5 * 16 + t5]!;
      
      // 组6
      const q6 = (queryVector[i + 24] ?? 0) * 8 + (queryVector[i + 25] ?? 0) * 4 + (queryVector[i + 26] ?? 0) * 2 + (queryVector[i + 27] ?? 0);
      const t6 = (targetVector[i + 24] ?? 0) * 8 + (targetVector[i + 25] ?? 0) * 4 + (targetVector[i + 26] ?? 0) * 2 + (targetVector[i + 27] ?? 0);
      totalDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q6 * 16 + t6]!;
      
      // 组7
      const q7 = (queryVector[i + 28] ?? 0) * 8 + (queryVector[i + 29] ?? 0) * 4 + (queryVector[i + 30] ?? 0) * 2 + (queryVector[i + 31] ?? 0);
      const t7 = (targetVector[i + 28] ?? 0) * 8 + (targetVector[i + 29] ?? 0) * 4 + (targetVector[i + 30] ?? 0) * 2 + (targetVector[i + 31] ?? 0);
      totalDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q7 * 16 + t7]!;
    }
    
    // 处理剩余4位组
    const remainingStart = mainLoopEnd;
    const remainingEnd = length - (length % 4);
    for (let i = remainingStart; i < remainingEnd; i += 4) {
      const q = (queryVector[i] ?? 0) * 8 + (queryVector[i + 1] ?? 0) * 4 + (queryVector[i + 2] ?? 0) * 2 + (queryVector[i + 3] ?? 0);
      const t = (targetVector[i] ?? 0) * 8 + (targetVector[i + 1] ?? 0) * 4 + (targetVector[i + 2] ?? 0) * 2 + (targetVector[i + 3] ?? 0);
      totalDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q * 16 + t]!;
    }
    
    // 处理最后不足4位的元素
    for (let i = remainingEnd; i < length; i++) {
      totalDotProduct += (queryVector[i] ?? 0) * (targetVector[i] ?? 0);
    }
    
    return totalDotProduct;
  }
  
  /**
   * 混合策略：根据维度自动选择最优算法
   * 小维度用直接计算，大维度用查表
   */
  function computeHybridDotProduct(
    queryVector: Uint8Array,
    targetVector: Uint8Array,
    threshold: number = 512
  ): number {
    const length = queryVector.length;
    
    // 小维度用直接计算（JS引擎优化好）
    if (length < threshold) {
      return computeUltimateDotProduct(queryVector, targetVector);
    }
    
    // 大维度用查表（避免重复计算）
    return computeUltimate4BitDotProduct(queryVector, targetVector);
  }
  
  /**
   * 极致优化的批量点积计算
   * 使用预分配内存，避免GC压力
   */
  function computeUltimateBatchDotProduct(
    queryVector: Uint8Array,
    targetVectors: Uint8Array[],
    threshold: number = 512
  ): number[] {
    const results = new Array(targetVectors.length);
    const queryLength = queryVector.length;
    
    // 根据查询向量长度选择策略
    if (queryLength < threshold) {
      // 小维度：使用直接计算
      for (let vecIndex = 0; vecIndex < targetVectors.length; vecIndex++) {
        results[vecIndex] = computeUltimateDotProduct(queryVector, targetVectors[vecIndex]!);
      }
    } else {
      // 大维度：使用查表
      for (let vecIndex = 0; vecIndex < targetVectors.length; vecIndex++) {
        results[vecIndex] = computeUltimate4BitDotProduct(queryVector, targetVectors[vecIndex]!);
      }
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
  
  it('验证极致优化算法的正确性', () => {
    console.log('=== 极致优化算法验证 ===');
    
    // 测试标准维度
    const testDimensions = [64, 256, 512, 1024, 2048];
    
    testDimensions.forEach(dimension => {
      
      const { query, target } = createTestVectors(dimension);
      
      const traditionalResult = computeTraditionalDotProduct(query, target);
      const ultimateResult = computeUltimateDotProduct(query, target);
      const ultimate4BitResult = computeUltimate4BitDotProduct(query, target);
      const hybridResult = computeHybridDotProduct(query, target);
      
      expect(ultimateResult).toBe(traditionalResult);
      expect(ultimate4BitResult).toBe(traditionalResult);
      expect(hybridResult).toBe(traditionalResult);
      
      console.log(`维度 ${dimension}: 所有算法结果一致 ✅`);
    });
    
    // 测试边界情况：不是4的倍数的维度
    const edgeDimensions = [1, 3, 5, 7, 15, 17, 31, 33, 63, 65, 127, 129];
    
    edgeDimensions.forEach(dimension => {
      
      const { query, target } = createTestVectors(dimension);
      
      const traditionalResult = computeTraditionalDotProduct(query, target);
      const ultimateResult = computeUltimateDotProduct(query, target);
      const ultimate4BitResult = computeUltimate4BitDotProduct(query, target);
      const hybridResult = computeHybridDotProduct(query, target);
      
      expect(ultimateResult).toBe(traditionalResult);
      expect(ultimate4BitResult).toBe(traditionalResult);
      expect(hybridResult).toBe(traditionalResult);
      
      console.log(`边界维度 ${dimension}: 所有算法结果一致 ✅`);
    });
    
    // 测试特殊情况：全0向量、全1向量
    const specialCases = [
      { name: '全0向量', query: new Uint8Array(100), target: new Uint8Array(100) },
      { name: '全1向量', query: (() => { const arr = new Uint8Array(100); for (let i = 0; i < 100; i++) arr[i] = 1; return arr; })(), target: (() => { const arr = new Uint8Array(100); for (let i = 0; i < 100; i++) arr[i] = 1; return arr; })() },
      { name: '交替向量', query: (() => { const arr = new Uint8Array(100); for (let i = 0; i < 100; i++) arr[i] = i % 2; return arr; })(), target: (() => { const arr = new Uint8Array(100); for (let i = 0; i < 100; i++) arr[i] = (i + 1) % 2; return arr; })() }
    ];
    
    specialCases.forEach(({ name, query, target }) => {
      
      const traditionalResult = computeTraditionalDotProduct(query, target);
      const ultimateResult = computeUltimateDotProduct(query, target);
      const ultimate4BitResult = computeUltimate4BitDotProduct(query, target);
      const hybridResult = computeHybridDotProduct(query, target);
      
      expect(ultimateResult).toBe(traditionalResult);
      expect(ultimate4BitResult).toBe(traditionalResult);
      expect(hybridResult).toBe(traditionalResult);
      
      console.log(`${name}: 所有算法结果一致 ✅`);
    });
  });
  
  it('比较极致优化算法的性能', () => {
    console.log('=== 极致优化算法性能对比 ===');
    
    const dimensions = [64, 256, 512, 1024, 2048, 4096];
    
    dimensions.forEach(dimension => {
      const { query, target } = createTestVectors(dimension);
      
      // 预热
      for (let i = 0; i < 10; i++) {
        computeUltimateDotProduct(query, target);
        computeUltimate4BitDotProduct(query, target);
        computeHybridDotProduct(query, target);
        computeTraditionalDotProduct(query, target);
      }
      
      // 测试各种算法
      const iterations = Math.max(100, 10000 / dimension);
      
      const ultimateStart = performance.now();
      let ultimateResult = 0;
      for (let i = 0; i < iterations; i++) {
        ultimateResult = computeUltimateDotProduct(query, target);
      }
      const ultimateTime = performance.now() - ultimateStart;
      
      const ultimate4BitStart = performance.now();
      let ultimate4BitResult = 0;
      for (let i = 0; i < iterations; i++) {
        ultimate4BitResult = computeUltimate4BitDotProduct(query, target);
      }
      const ultimate4BitTime = performance.now() - ultimate4BitStart;
      
      const hybridStart = performance.now();
      let hybridResult = 0;
      for (let i = 0; i < iterations; i++) {
        hybridResult = computeHybridDotProduct(query, target);
      }
      const hybridTime = performance.now() - hybridStart;
      
      const traditionalStart = performance.now();
      let traditionalResult = 0;
      for (let i = 0; i < iterations; i++) {
        traditionalResult = computeTraditionalDotProduct(query, target);
      }
      const traditionalTime = performance.now() - traditionalStart;
      
      // 计算加速比
      const ultimateSpeedup = traditionalTime / ultimateTime;
      const ultimate4BitSpeedup = traditionalTime / ultimate4BitTime;
      const hybridSpeedup = traditionalTime / hybridTime;
      
      console.log(`维度 ${dimension}:`);
      console.log(`  极致直接: ${ultimateTime.toFixed(3)}ms (${ultimateSpeedup.toFixed(2)}x)`);
      console.log(`  极致查表: ${ultimate4BitTime.toFixed(3)}ms (${ultimate4BitSpeedup.toFixed(2)}x)`);
      console.log(`  混合策略: ${hybridTime.toFixed(3)}ms (${hybridSpeedup.toFixed(2)}x)`);
      console.log(`  传统方法: ${traditionalTime.toFixed(3)}ms (1.00x)`);
      console.log('');
    });
  });
  
  it('测试极致批量计算性能', () => {
    console.log('=== 极致批量计算性能测试 ===');
    
    const dimensions = [256, 512, 1024, 2048];
    const numVectors = 100;
    
    dimensions.forEach(dimension => {
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
      for (let i = 0; i < 3; i++) {
        computeUltimateBatchDotProduct(query, targetVectors);
      }
      
      // 测试批量计算
      const batchStart = performance.now();
      let batchResults: number[] = [];
      for (let i = 0; i < 5; i++) {
        batchResults = computeUltimateBatchDotProduct(query, targetVectors);
      }
      const batchTime = performance.now() - batchStart;
      
      // 测试逐个传统方法
      const individualStart = performance.now();
      let individualResults: number[] = [];
      for (let i = 0; i < 5; i++) {
        individualResults = targetVectors.map(target => 
          computeTraditionalDotProduct(query, target)
        );
      }
      const individualTime = performance.now() - individualStart;
      
      const speedup = individualTime / batchTime;
      
      console.log(`维度 ${dimension}, ${numVectors} 个向量:`);
      console.log(`  极致批量: ${batchTime.toFixed(3)}ms`);
      console.log(`  逐个传统: ${individualTime.toFixed(3)}ms`);
      console.log(`  加速比: ${speedup.toFixed(2)}x`);
      console.log(`  平均每个向量: ${(batchTime / numVectors / 5).toFixed(6)}ms`);
      console.log('');
    });
  });
  
  it('分析极致优化的效果', () => {
    console.log('=== 极致优化效果分析 ===');
    
    // 测试查表访问性能
    const accessStart = performance.now();
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      const a = i % 16;
      const b = (i * 7) % 16;
      sum += ULTIMATE_4BIT_LOOKUP_TABLE[a * 16 + b]!;
    }
    const accessTime = performance.now() - accessStart;
    
    console.log(`100万次查表访问: ${accessTime.toFixed(3)}ms`);
    console.log(`平均每次访问: ${(accessTime / 1000000).toFixed(6)}ms`);
    console.log(`查表内存占用: ${ULTIMATE_4BIT_LOOKUP_TABLE.length} 字节`);
    
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
      
      const hybridStart = performance.now();
      let hybridResult = 0;
      for (let i = 0; i < iterations; i++) {
        hybridResult = computeHybridDotProduct(query, target);
      }
      const hybridTime = performance.now() - hybridStart;
      
      const traditionalStart = performance.now();
      let traditionalResult = 0;
      for (let i = 0; i < iterations; i++) {
        traditionalResult = computeTraditionalDotProduct(query, target);
      }
      const traditionalTime = performance.now() - traditionalStart;
      
      const speedup = traditionalTime / hybridTime;
      
      console.log(`稀疏度 ${(sparsity * 100).toFixed(0)}%:`);
      console.log(`  混合策略: ${hybridTime.toFixed(3)}ms, 传统: ${traditionalTime.toFixed(3)}ms`);
      console.log(`  加速比: ${speedup.toFixed(2)}x`);
      console.log(`  点积: ${hybridResult}/${dimension} (${((hybridResult / dimension) * 100).toFixed(1)}%)`);
    });
    
    expect(sum).toBeGreaterThan(0);
  });
  
  it('总结极致优化的策略', () => {
    console.log('=== 极致优化策略总结 ===');
    
    console.log('核心优化策略:');
    console.log('  1. 混合算法选择：小维度直接计算，大维度查表');
    console.log('  2. 循环展开：16路直接计算，8路查表计算');
    console.log('  3. 内存优化：预分配数组，避免GC压力');
    console.log('  4. 内联计算：避免函数调用开销');
    console.log('  5. 边界检查消除：使用非空断言');
    console.log('');
    
    console.log('性能优势:');
    console.log('  - 小维度：JS引擎优化 + 循环展开');
    console.log('  - 大维度：查表缓存 + 批量处理');
    console.log('  - 内存：最小化分配，最大化缓存命中');
    console.log('  - CPU：减少分支预测失败');
    console.log('');
    
    console.log('适用场景:');
    console.log('  - 高频率向量计算');
    console.log('  - 大规模批量处理');
    console.log('  - 实时性能要求');
    console.log('  - 内存受限环境');
    console.log('');
    
    console.log('进一步优化方向:');
    console.log('  - SIMD指令优化');
    console.log('  - WebAssembly实现');
    console.log('  - GPU并行计算');
    console.log('  - 自适应阈值调整');
  });
}); 