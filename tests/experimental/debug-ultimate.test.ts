import { describe, it, expect } from 'vitest';

/**
 * 调试极致优化算法的问题
 */

describe('调试极致优化算法', () => {
  
  /**
   * 预计算的4位二进制向量点积查表
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
   * 修复后的4位查表算法
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
  
  it('调试边界处理问题', () => {
    console.log('=== 调试边界处理问题 ===');
    
    // 测试一个简单的例子
    const query = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    const target = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    
    console.log('向量长度:', query.length);
    console.log('查询向量:', Array.from(query));
    console.log('目标向量:', Array.from(target));
    
    const traditionalResult = computeTraditionalDotProduct(query, target);
    const ultimate4BitResult = computeUltimate4BitDotProduct(query, target);
    
    console.log('传统算法结果:', traditionalResult);
    console.log('4位查表算法结果:', ultimate4BitResult);
    console.log('结果是否一致:', traditionalResult === ultimate4BitResult);
    
    // 检查边界处理
    console.log('\n=== 边界处理检查 ===');
    console.log('mainLoopEnd:', query.length - (query.length % 32));
    console.log('remainingStart:', query.length - (query.length % 32));
    console.log('remainingEnd:', query.length - (query.length % 4));
    console.log('最后不足4位的元素数量:', query.length - (query.length - (query.length % 4)));
    
    expect(ultimate4BitResult).toBe(traditionalResult);
  });
  
  it('调试特殊情况', () => {
    console.log('=== 调试特殊情况 ===');
    
    // 测试交替向量
    const dimension = 100;
    const query = new Uint8Array(dimension).map((_, i) => i % 2);
    const target = new Uint8Array(dimension).map((_, i) => (i + 1) % 2);
    
    console.log('向量长度:', dimension);
    console.log('查询向量前10个元素:', Array.from(query.slice(0, 10)));
    console.log('目标向量前10个元素:', Array.from(target.slice(0, 10)));
    
    const traditionalResult = computeTraditionalDotProduct(query, target);
    const ultimate4BitResult = computeUltimate4BitDotProduct(query, target);
    
    console.log('传统算法结果:', traditionalResult);
    console.log('4位查表算法结果:', ultimate4BitResult);
    console.log('结果是否一致:', traditionalResult === ultimate4BitResult);
    
    expect(ultimate4BitResult).toBe(traditionalResult);
  });
  
  it('调试边界维度', () => {
    console.log('=== 调试边界维度 ===');
    
    // 测试边界维度
    const dimensions = [1, 3, 5, 7, 15, 17, 31, 33, 63, 65, 127, 129];
    
    dimensions.forEach(dimension => {
      const query = new Uint8Array(dimension);
      const target = new Uint8Array(dimension);
      
      for (let i = 0; i < dimension; i++) {
        query[i] = Math.random() > 0.5 ? 1 : 0;
        target[i] = Math.random() > 0.5 ? 1 : 0;
      }
      
      const traditionalResult = computeTraditionalDotProduct(query, target);
      const ultimate4BitResult = computeUltimate4BitDotProduct(query, target);
      
      console.log(`维度 ${dimension}: 传统=${traditionalResult}, 查表=${ultimate4BitResult}, 一致=${traditionalResult === ultimate4BitResult}`);
      
      if (traditionalResult !== ultimate4BitResult) {
        console.log('  查询向量:', Array.from(query));
        console.log('  目标向量:', Array.from(target));
        console.log('  问题维度:', dimension);
      }
      
      expect(ultimate4BitResult).toBe(traditionalResult);
    });
  });
  
  it('调试fill方法问题', () => {
    console.log('=== 调试fill方法问题 ===');
    
    // 测试fill方法
    const dimension = 100;
    const query = new Uint8Array(dimension);
    const target = new Uint8Array(dimension);
    
    // 手动填充
    for (let i = 0; i < dimension; i++) {
      query[i] = 1;
      target[i] = 1;
    }
    
    console.log('向量长度:', dimension);
    console.log('查询向量前10个元素:', Array.from(query.slice(0, 10)));
    console.log('目标向量前10个元素:', Array.from(target.slice(0, 10)));
    
    const traditionalResult = computeTraditionalDotProduct(query, target);
    const ultimate4BitResult = computeUltimate4BitDotProduct(query, target);
    
    console.log('传统算法结果:', traditionalResult);
    console.log('4位查表算法结果:', ultimate4BitResult);
    console.log('结果是否一致:', traditionalResult === ultimate4BitResult);
    
    expect(ultimate4BitResult).toBe(traditionalResult);
  });
}); 