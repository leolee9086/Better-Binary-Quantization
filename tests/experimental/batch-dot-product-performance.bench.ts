/**
 * 批量点积计算性能测试
 * 验证批量计算相比单个计算的性能提升
 */

import { describe, it, expect, bench } from 'vitest';
import {
  computeQuantizedDotProduct,
  computeBatchQuantizedDotProducts,
  computeBatchQuantizedDotProductsOptimized
} from '@src/bitwiseDotProduct';

describe('批量点积计算性能测试', () => {
  // 生成测试数据
  const generateTestData = (vectorCount: number, dimension: number) => {
    const quantizedQuery = new Uint8Array(dimension);
    const targetVectors: Uint8Array[] = [];
    
    // 生成查询向量
    for (let i = 0; i < dimension; i++) {
      quantizedQuery[i] = Math.floor(Math.random() * 256);
    }
    
    // 生成目标向量
    for (let i = 0; i < vectorCount; i++) {
      const vector = new Uint8Array(dimension);
      for (let j = 0; j < dimension; j++) {
        vector[j] = Math.floor(Math.random() * 256);
      }
      targetVectors.push(vector);
    }
    
    return { quantizedQuery, targetVectors };
  };

  // 模拟目标向量集合
  const createMockTargetVectors = (targetVectors: Uint8Array[]) => {
    return {
      getUnpackedVector: (ord: number): Uint8Array => {
        return targetVectors[ord]!;
      }
    };
  };

  it('批量点积计算正确性验�?, () => {
    const { quantizedQuery, targetVectors } = generateTestData(100, 1024);
    const mockTargetVectors = createMockTargetVectors(targetVectors);
    const targetOrds = Array.from({ length: 100 }, (_, i) => i);
    
    // 单个计算
    const individualResults: number[] = [];
    for (let i = 0; i < targetOrds.length; i++) {
      const targetVector = mockTargetVectors.getUnpackedVector(targetOrds[i]!);
      individualResults.push(computeQuantizedDotProduct(quantizedQuery, targetVector));
    }
    
    // 批量计算
    const batchResults = computeBatchQuantizedDotProducts(
      quantizedQuery,
      mockTargetVectors,
      targetOrds
    );
    
    // 优化批量计算
    const optimizedBatchResults = computeBatchQuantizedDotProductsOptimized(
      quantizedQuery,
      mockTargetVectors,
      targetOrds
    );
    
    // 验证结果一致�?
    expect(batchResults.length).toBe(individualResults.length);
    expect(optimizedBatchResults.length).toBe(individualResults.length);
    
    for (let i = 0; i < individualResults.length; i++) {
      expect(batchResults[i]).toBe(individualResults[i]);
      expect(optimizedBatchResults[i]).toBe(individualResults[i]);
    }
  });

  bench('单个点积计算 vs 批量点积计算', () => {
    const { quantizedQuery, targetVectors } = generateTestData(1000, 1024);
    const mockTargetVectors = createMockTargetVectors(targetVectors);
    const targetOrds = Array.from({ length: 1000 }, (_, i) => i);
    
    // 单个计算
    bench('单个点积计算', () => {
      const results: number[] = [];
      for (let i = 0; i < targetOrds.length; i++) {
        const targetVector = mockTargetVectors.getUnpackedVector(targetOrds[i]!);
        results.push(computeQuantizedDotProduct(quantizedQuery, targetVector));
      }
      return results;
    });
    
    // 批量计算
    bench('批量点积计算', () => {
      return computeBatchQuantizedDotProducts(
        quantizedQuery,
        mockTargetVectors,
        targetOrds
      );
    });
    
    // 优化批量计算
    bench('优化批量点积计算', () => {
      return computeBatchQuantizedDotProductsOptimized(
        quantizedQuery,
        mockTargetVectors,
        targetOrds
      );
    });
  });

  bench('不同规模的批量点积计算性能', () => {
    const { quantizedQuery, targetVectors } = generateTestData(5000, 1024);
    const mockTargetVectors = createMockTargetVectors(targetVectors);
    
    // 小规模批量（100个向量）
    bench('小规模批量计�?(100个向�?', () => {
      const targetOrds = Array.from({ length: 100 }, (_, i) => i);
      return computeBatchQuantizedDotProductsOptimized(
        quantizedQuery,
        mockTargetVectors,
        targetOrds
      );
    });
    
    // 中等规模批量�?000个向量）
    bench('中等规模批量计算 (1000个向�?', () => {
      const targetOrds = Array.from({ length: 1000 }, (_, i) => i);
      return computeBatchQuantizedDotProductsOptimized(
        quantizedQuery,
        mockTargetVectors,
        targetOrds
      );
    });
    
    // 大规模批量（5000个向量）
    bench('大规模批量计�?(5000个向�?', () => {
      const targetOrds = Array.from({ length: 5000 }, (_, i) => i);
      return computeBatchQuantizedDotProductsOptimized(
        quantizedQuery,
        mockTargetVectors,
        targetOrds
      );
    });
  });

  it('内存使用分析', () => {
    const { quantizedQuery, targetVectors } = generateTestData(1000, 1024);
    const mockTargetVectors = createMockTargetVectors(targetVectors);
    const targetOrds = Array.from({ length: 1000 }, (_, i) => i);
    
    // 测量内存使用
    const initialMemory = performance.memory?.usedJSHeapSize || 0;
    
    // 执行批量计算
    const results = computeBatchQuantizedDotProductsOptimized(
      quantizedQuery,
      mockTargetVectors,
      targetOrds
    );
    
    const finalMemory = performance.memory?.usedJSHeapSize || 0;
    const memoryUsed = finalMemory - initialMemory;
    
    console.log(`批量点积计算内存使用: ${(memoryUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`每个向量的平均内存开销: ${(memoryUsed / 1024 / targetOrds.length).toFixed(2)} KB`);
    
    expect(results.length).toBe(1000);
    expect(memoryUsed).toBeGreaterThan(0);
  });
}); 
