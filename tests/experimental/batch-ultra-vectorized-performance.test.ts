/**
 * 超向量化批量算法性能对比测试
 * 对比超向量化批量算法与现有单比特内积算法的性能差异
 */

import { describe, it, expect } from 'vitest';
import {
  computeBatchDotProductOptimized,
  computeBatchDotProductOriginal,
  computeBatchDotProductTrueOriginal,
  computeBatchDotProductUltraVectorized,
  createConcatenatedBuffer
} from '../../src/batchDotProduct';
import { computeInt1BitDotProduct } from '../../src/bitwiseDotProduct';

/**
 * 生成随机二值向量
 * @param length 向量长度
 * @returns 二值向量
 */
function generateBinaryVector(length: number): Uint8Array {
  const vector = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    vector[i] = Math.floor(Math.random() * 256);
  }
  return vector;
}

/**
 * 模拟目标向量集合
 */
class MockTargetVectors {
  private vectors: Uint8Array[];

  constructor(vectors: Uint8Array[]) {
    this.vectors = vectors;
  }

  getUnpackedVector(ord: number): Uint8Array {
    return this.vectors[ord]!;
  }

  getCorrectiveTerms(ord: number): any {
    // 模拟修正因子
    return {
      quantizedComponentSum: 0,
      lowerInterval: 0,
      upperInterval: 1,
      additionalCorrection: 0
    };
  }
}

/**
 * 测量函数执行时间
 * @param fn 要测量的函数
 * @param iterations 迭代次数
 * @returns 执行时间（毫秒）
 */
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

describe('超向量化批量算法性能对比', () => {
  const testSizes = [10, 50, 100, 500, 1000];
  const vectorSizes = [128, 256, 512, 1024];
  const iterations = 100;

  it('应该正确计算批量点积', () => {
    const numVectors = 10;
    const vectorSize = 128;
    
    // 生成测试数据
    const queryVector = generateBinaryVector(vectorSize);
    const targetVectors: Uint8Array[] = [];
    for (let i = 0; i < numVectors; i++) {
      targetVectors.push(generateBinaryVector(vectorSize));
    }
    
    const mockTargetVectors = new MockTargetVectors(targetVectors);
    const targetOrds = Array.from({ length: numVectors }, (_, i) => i);
    const concatenatedBuffer = createConcatenatedBuffer(mockTargetVectors, targetOrds);
    
    // 计算期望结果（使用原始方法）
    const expected = computeBatchDotProductTrueOriginal(queryVector, mockTargetVectors, targetOrds);
    
    // 测试不同算法的结果一致性
    const result1 = computeBatchDotProductOriginal(queryVector, concatenatedBuffer, numVectors, vectorSize);
    const result2 = computeBatchDotProductOptimized(queryVector, concatenatedBuffer, numVectors, vectorSize);
    const result3 = computeBatchDotProductUltraVectorized(queryVector, concatenatedBuffer, numVectors, vectorSize);
    
    // 验证结果
    for (let i = 0; i < numVectors; i++) {
      expect(result1[i]).toBe(expected[i]);
      expect(result2[i]).toBe(expected[i]);
      expect(result3[i]).toBe(expected[i]);
    }
  });

  it('批量算法性能对比测试', () => {
    console.log('\n=== 批量算法性能对比测试 ===');
    console.log('向量数量\t向量大小\t原始算法(ms)\t八路优化(ms)\t超向量化(ms)\t超向量化加速比');
    
    for (const numVectors of testSizes) {
      for (const vectorSize of vectorSizes) {
        // 生成测试数据
        const queryVector = generateBinaryVector(vectorSize);
        const targetVectors: Uint8Array[] = [];
        for (let i = 0; i < numVectors; i++) {
          targetVectors.push(generateBinaryVector(vectorSize));
        }
        
        const mockTargetVectors = new MockTargetVectors(targetVectors);
        const targetOrds = Array.from({ length: numVectors }, (_, i) => i);
        const concatenatedBuffer = createConcatenatedBuffer(mockTargetVectors, targetOrds);
        
        // 预热
        for (let i = 0; i < 10; i++) {
          computeBatchDotProductOriginal(queryVector, concatenatedBuffer, numVectors, vectorSize);
          computeBatchDotProductOptimized(queryVector, concatenatedBuffer, numVectors, vectorSize);
          computeBatchDotProductUltraVectorized(queryVector, concatenatedBuffer, numVectors, vectorSize);
        }
        
        // 测试原始算法
        const time1 = measureTime(() => {
          computeBatchDotProductOriginal(queryVector, concatenatedBuffer, numVectors, vectorSize);
        }, iterations);
        
        // 测试八路优化算法
        const time2 = measureTime(() => {
          computeBatchDotProductOptimized(queryVector, concatenatedBuffer, numVectors, vectorSize);
        }, iterations);
        
        // 测试超向量化算法
        const time3 = measureTime(() => {
          computeBatchDotProductUltraVectorized(queryVector, concatenatedBuffer, numVectors, vectorSize);
        }, iterations);
        
        const speedup = time2 / time3;
        
        console.log(`${numVectors}\t\t${vectorSize}\t\t${time1.toFixed(2)}\t\t${time2.toFixed(2)}\t\t${time3.toFixed(2)}\t\t${speedup.toFixed(2)}x`);
        
        // 验证结果一致性
        const result1 = computeBatchDotProductOriginal(queryVector, concatenatedBuffer, numVectors, vectorSize);
        const result2 = computeBatchDotProductOptimized(queryVector, concatenatedBuffer, numVectors, vectorSize);
        const result3 = computeBatchDotProductUltraVectorized(queryVector, concatenatedBuffer, numVectors, vectorSize);
        
        for (let i = 0; i < numVectors; i++) {
          expect(result1[i]).toBe(result2[i]);
          expect(result2[i]).toBe(result3[i]);
        }
      }
    }
    
    console.log('\n=== 性能分析总结 ===');
    console.log('1. 原始算法：逐字节循环计算，基础实现');
    console.log('2. 八路优化算法：八路循环展开，减少循环开销');
    console.log('3. 超向量化算法：使用Uint32Array一次处理4个字节，真正的向量化操作');
  });

  it('大规模数据性能测试', () => {
    console.log('\n=== 大规模数据性能测试 ===');
    const largeTestSizes = [1000, 5000, 10000];
    const largeVectorSizes = [1024, 2048];
    const largeIterations = 50;
    
    console.log('向量数量\t向量大小\t八路优化(ms)\t超向量化(ms)\t加速比\t\t内存效率');
    
    for (const numVectors of largeTestSizes) {
      for (const vectorSize of largeVectorSizes) {
        // 生成大规模测试数据
        const queryVector = generateBinaryVector(vectorSize);
        const targetVectors: Uint8Array[] = [];
        for (let i = 0; i < numVectors; i++) {
          targetVectors.push(generateBinaryVector(vectorSize));
        }
        
        const mockTargetVectors = new MockTargetVectors(targetVectors);
        const targetOrds = Array.from({ length: numVectors }, (_, i) => i);
        const concatenatedBuffer = createConcatenatedBuffer(mockTargetVectors, targetOrds);
        
        // 预热
        for (let i = 0; i < 5; i++) {
          computeBatchDotProductOptimized(queryVector, concatenatedBuffer, numVectors, vectorSize);
          computeBatchDotProductUltraVectorized(queryVector, concatenatedBuffer, numVectors, vectorSize);
        }
        
        // 测试八路优化算法
        const time1 = measureTime(() => {
          computeBatchDotProductOptimized(queryVector, concatenatedBuffer, numVectors, vectorSize);
        }, largeIterations);
        
        // 测试超向量化算法
        const time2 = measureTime(() => {
          computeBatchDotProductUltraVectorized(queryVector, concatenatedBuffer, numVectors, vectorSize);
        }, largeIterations);
        
        const speedup = time1 / time2;
        const memoryEfficiency = (vectorSize * numVectors) / (time2 * 1000); // 字节/毫秒
        
        console.log(`${numVectors}\t\t${vectorSize}\t\t${time1.toFixed(2)}\t\t${time2.toFixed(2)}\t\t${speedup.toFixed(2)}x\t\t${memoryEfficiency.toFixed(0)} B/ms`);
      }
    }
  });

  it('算法复杂度分析', () => {
    console.log('\n=== 算法复杂度分析 ===');
    console.log('原始算法：O(n*m)，其中n是向量数量，m是向量字节数');
    console.log('八路优化算法：O(n*m)，但循环展开减少了循环开销');
    console.log('超向量化算法：O(n*m/4)，一次处理4个字节，循环次数减少75%');
    console.log('');
    console.log('内存访问模式：');
    console.log('- 原始算法：逐字节访问，缓存局部性一般');
    console.log('- 八路优化算法：八字节一组访问，缓存局部性较好');
    console.log('- 超向量化算法：32位对齐访问，缓存局部性最佳');
    console.log('');
    console.log('CPU优化友好度：');
    console.log('- 原始算法：基础循环，编译器优化有限');
    console.log('- 八路优化算法：循环展开，编译器可以更好地优化');
    console.log('- 超向量化算法：32位操作，符合现代CPU优化模式');
  });
}); 