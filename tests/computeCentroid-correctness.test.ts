import { describe, it, expect } from 'vitest';
import { computeCentroid } from '../src/vectorOperations';

/**
 * computeCentroid正确性验证测试
 */

// 优化实现：交换循环顺序
function computeCentroidOptimized(vectors: Float32Array[]): Float32Array {
  if (vectors.length === 0) {
    throw new Error('向量集合不能为空');
  }

  const firstVector = vectors[0];
  if (!firstVector) {
    throw new Error('第一个向量不能为空');
  }
  const dimension = firstVector.length;
  const centroid = new Float32Array(dimension);

  // 初始化质心为第一个向量
  for (let i = 0; i < dimension; i++) {
    centroid[i] = vectors[0]![i] || 0;
  }

  // 从第二个向量开始累加
  for (let j = 1; j < vectors.length; j++) {
    const vector = vectors[j];
    if (vector) {
      for (let i = 0; i < dimension; i++) {
        const val = vector[i];
        if (val !== undefined) {
          centroid[i] += val;
        }
      }
    }
  }

  // 除以向量数量
  const numVectors = vectors.length;
  for (let i = 0; i < dimension; i++) {
    centroid[i] /= numVectors;
  }

  return centroid;
}

describe('computeCentroid正确性验证', () => {
  it('优化实现应该产生相同结果', () => {
    // 创建测试数据
    const dimension = 128;
    const numVectors = 1000;
    const vectors = new Array(numVectors).fill(0).map(() => 
      new Float32Array(dimension).map(() => Math.random() * 2 - 1)
    );

    const result1 = computeCentroid(vectors);
    const result2 = computeCentroidOptimized(vectors);
    
    // 验证结果相同
    for (let i = 0; i < result1.length; i++) {
      expect(Math.abs(result1[i]! - result2[i]!)).toBeLessThan(1e-7);
    }
  });

  it('小规模数据测试', () => {
    const vectors = [
      new Float32Array([1, 2, 3]),
      new Float32Array([4, 5, 6]),
      new Float32Array([7, 8, 9])
    ];

    const result1 = computeCentroid(vectors);
    const result2 = computeCentroidOptimized(vectors);
    
    // 期望结果：[4, 5, 6]
    expect(result1[0]).toBeCloseTo(4, 10);
    expect(result1[1]).toBeCloseTo(5, 10);
    expect(result1[2]).toBeCloseTo(6, 10);
    
    // 验证两个实现结果相同
    for (let i = 0; i < result1.length; i++) {
      expect(result1[i]).toBeCloseTo(result2[i]!, 10);
    }
  });
}); 