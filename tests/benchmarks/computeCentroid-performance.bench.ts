import { describe, bench } from 'vitest';
import { computeCentroid } from '../../src/vectorOperations';

/**
 * computeCentroid性能回归测试
 * 测试不同实现方案的性能差异
 */

describe('computeCentroid性能回归测试', () => {
  // 测试数据准备
  const dimension = 128;
  const numVectors = 1000;
  const vectors = new Array(numVectors).fill(0).map(() => 
    new Float32Array(dimension).map(() => Math.random() * 2 - 1)
  );

  describe('当前实现性能', () => {
    bench('当前实现 - 1000个128维向量', () => {
      computeCentroid(vectors);
    });
  });

  describe('优化实现性能', () => {
    bench('交换循环顺序优化 - 1000个128维向量', () => {
      computeCentroidOptimized(vectors);
    });
  });

  describe('不同规模数据性能', () => {
    const smallVectors = new Array(100).fill(0).map(() => 
      new Float32Array(64).map(() => Math.random() * 2 - 1)
    );

    const largeVectors = new Array(5000).fill(0).map(() => 
      new Float32Array(256).map(() => Math.random() * 2 - 1)
    );

    bench('当前实现 - 100个64维向量', () => {
      computeCentroid(smallVectors);
    });

    bench('优化实现 - 100个64维向量', () => {
      computeCentroidOptimized(smallVectors);
    });

    bench('当前实现 - 5000个256维向量', () => {
      computeCentroid(largeVectors);
    });

    bench('优化实现 - 5000个256维向量', () => {
      computeCentroidOptimized(largeVectors);
    });
  });

  describe('正确性验证', () => {
    it('优化实现应该产生相同结果', () => {
      const result1 = computeCentroid(vectors);
      const result2 = computeCentroidOptimized(vectors);
      
      for (let i = 0; i < result1.length; i++) {
        expect(Math.abs(result1[i]! - result2[i]!)).toBeLessThan(1e-10);
      }
    });
  });
});

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