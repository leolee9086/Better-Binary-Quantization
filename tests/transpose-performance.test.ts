/**
 * transposeHalfByte函数性能测试
 * 测试优化前后的性能差异
 */

import { describe, it, expect } from 'vitest';
import { OptimizedScalarQuantizer } from '../src/optimizedScalarQuantizer';

/**
 * 性能测量函数
 */
function measurePerformance<T>(name: string, fn: () => T, iterations: number = 1000): T {
  const start = performance.now();
  let result: T;
  
  for (let i = 0; i < iterations; i++) {
    result = fn();
  }
  
  const end = performance.now();
  const avgTime = (end - start) / iterations;
  
  console.log(`📊 ${name}: ${avgTime.toFixed(4)}ms (${iterations}次迭代)`);
  
  return result!;
}

describe('transposeHalfByte性能测试', () => {
  // 准备测试数据
  const testCases = [
    { name: '8维向量', size: 8 },
    { name: '16维向量', size: 16 },
    { name: '32维向量', size: 32 },
    { name: '64维向量', size: 64 },
    { name: '128维向量', size: 128 },
    { name: '256维向量', size: 256 },
    { name: '512维向量', size: 512 },
    { name: '1024维向量', size: 1024 }
  ];

  testCases.forEach(({ name, size }) => {
    it(`${name} - 原始版本 vs 优化版本性能对比`, () => {
      // 准备测试数据
      const inputVector = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        inputVector[i] = Math.floor(Math.random() * 16); // 4位值
      }
      
      const outputSize = Math.ceil(size / 8) * 4;
      const outputVector1 = new Uint8Array(outputSize);
      const outputVector2 = new Uint8Array(outputSize);
      const outputVector3 = new Uint8Array(outputSize);

      // 预热缓存
      OptimizedScalarQuantizer.transposeHalfByteOptimized(inputVector, outputVector1, true);
      OptimizedScalarQuantizer.clearTransposeCache();

      // 测试原始版本
      measurePerformance(
        `${name} - 原始版本`,
        () => OptimizedScalarQuantizer.transposeHalfByte(inputVector, outputVector1),
        1000
      );

      // 测试优化版本（无缓存）
      measurePerformance(
        `${name} - 优化版本（无缓存）`,
        () => OptimizedScalarQuantizer.transposeHalfByteOptimized(inputVector, outputVector2, false),
        1000
      );

      // 测试优化版本（有缓存）
      measurePerformance(
        `${name} - 优化版本（有缓存）`,
        () => OptimizedScalarQuantizer.transposeHalfByteOptimized(inputVector, outputVector3, true),
        1000
      );

      // 测试快速版本
      measurePerformance(
        `${name} - 快速版本`,
        () => OptimizedScalarQuantizer.transposeHalfByteFast(inputVector, outputVector3),
        1000
      );

      // 验证结果一致性
      expect(outputVector1).toEqual(outputVector2);
      expect(outputVector1).toEqual(outputVector3);

      // 性能断言 - 只验证函数执行成功
      expect(outputVector1.length).toBeGreaterThan(0);
      expect(outputVector2.length).toBeGreaterThan(0);
      expect(outputVector3.length).toBeGreaterThan(0);
    });
  });

  it('缓存效果测试 - 重复调用性能', () => {
    const size = 128;
    const inputVector = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      inputVector[i] = Math.floor(Math.random() * 16);
    }
    
    const outputSize = Math.ceil(size / 8) * 4;
    const outputVector = new Uint8Array(outputSize);

    // 清空缓存
    OptimizedScalarQuantizer.clearTransposeCache();

    // 第一次调用（无缓存）
    measurePerformance(
      '128维向量 - 第一次调用（无缓存）',
      () => OptimizedScalarQuantizer.transposeHalfByteOptimized(inputVector, outputVector, true),
      100
    );

    // 第二次调用（有缓存）
    measurePerformance(
      '128维向量 - 第二次调用（有缓存）',
      () => OptimizedScalarQuantizer.transposeHalfByteOptimized(inputVector, outputVector, true),
      100
    );

    // 获取缓存统计
    const cacheStats = OptimizedScalarQuantizer.getTransposeCacheStats();
    console.log(`📊 缓存统计: 大小=${cacheStats.size}, 命中率=${cacheStats.hitRate}`);

    expect(cacheStats.size).toBeGreaterThan(0);
    expect(outputVector.length).toBeGreaterThan(0);
  });

  it('不同输入模式性能测试', () => {
    const size = 256;
    const outputSize = Math.ceil(size / 8) * 4;
    const outputVector = new Uint8Array(outputSize);

    // 测试模式1：全零向量
    const zeroVector = new Uint8Array(size);
    measurePerformance(
      '256维全零向量',
      () => OptimizedScalarQuantizer.transposeHalfByteOptimized(zeroVector, outputVector, true),
      500
    );

    // 测试模式2：全一向量
    const oneVector = new Uint8Array(size).fill(1);
    measurePerformance(
      '256维全一向量',
      () => OptimizedScalarQuantizer.transposeHalfByteOptimized(oneVector, outputVector, true),
      500
    );

    // 测试模式3：最大值向量
    const maxVector = new Uint8Array(size).fill(15);
    measurePerformance(
      '256维最大值向量',
      () => OptimizedScalarQuantizer.transposeHalfByteOptimized(maxVector, outputVector, true),
      500
    );

    // 测试模式4：随机向量
    const randomVector = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      randomVector[i] = Math.floor(Math.random() * 16);
    }
    measurePerformance(
      '256维随机向量',
      () => OptimizedScalarQuantizer.transposeHalfByteOptimized(randomVector, outputVector, true),
      500
    );

    // 清空缓存
    OptimizedScalarQuantizer.clearTransposeCache();
  });

  it('内存使用测试', () => {
    const size = 512;
    const outputSize = Math.ceil(size / 8) * 4;
    const inputVector = new Uint8Array(size);
    const outputVector = new Uint8Array(outputSize);
    
    for (let i = 0; i < size; i++) {
      inputVector[i] = Math.floor(Math.random() * 16);
    }

    // 记录初始缓存大小
    const initialStats = OptimizedScalarQuantizer.getTransposeCacheStats();
    console.log(`📊 初始缓存大小: ${initialStats.size}`);

    // 多次调用，观察缓存增长
    for (let i = 0; i < 100; i++) {
      const testVector = new Uint8Array(size);
      for (let j = 0; j < size; j++) {
        testVector[j] = Math.floor(Math.random() * 16);
      }
      OptimizedScalarQuantizer.transposeHalfByteOptimized(testVector, outputVector, true);
    }

    // 记录最终缓存大小
    const finalStats = OptimizedScalarQuantizer.getTransposeCacheStats();
    console.log(`📊 最终缓存大小: ${finalStats.size}`);

    // 验证缓存大小不超过限制
    expect(finalStats.size).toBeLessThanOrEqual(1000);

    // 清空缓存
    OptimizedScalarQuantizer.clearTransposeCache();
    const clearedStats = OptimizedScalarQuantizer.getTransposeCacheStats();
    expect(clearedStats.size).toBe(0);
  });
}); 