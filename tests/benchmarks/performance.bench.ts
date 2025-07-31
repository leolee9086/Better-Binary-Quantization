import { describe, it, expect } from 'vitest';
import { 
  computeDotProduct, 
  normalizeVector
} from '../../src/vectorOperations';
import { 
  computeEuclideanDistance, 
  computeCosineSimilarity 
} from '../../src/vectorSimilarity';
import { 
  computeInt4BitDotProduct, 
  computeInt4BitDotProductOptimized 
} from '../../src/bitwiseDotProduct';
import { createBinaryQuantizationFormat, quickQuantize, quickSearch } from '../../src/index';
import { OptimizedScalarQuantizer } from '../../src/optimizedScalarQuantizer';

/**
 * 性能测量工具
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

describe('性能基准测试', () => {
  describe('向量操作性能', () => {
    const largeVectorA = new Float32Array(1000).map(() => Math.random());
    const largeVectorB = new Float32Array(1000).map(() => Math.random());

    it('computeDotProduct - 1000维向量', () => {
      const result = measurePerformance('computeDotProduct - 1000维向量', () => {
        return computeDotProduct(largeVectorA, largeVectorB);
      }, 1000);
      
      expect(typeof result).toBe('number');
    });

    it('computeEuclideanDistance - 1000维向量', () => {
      const result = measurePerformance('computeEuclideanDistance - 1000维向量', () => {
        return computeEuclideanDistance(largeVectorA, largeVectorB);
      }, 1000);
      
      expect(typeof result).toBe('number');
    });

    it('computeCosineSimilarity - 1000维向量', () => {
      const result = measurePerformance('computeCosineSimilarity - 1000维向量', () => {
        return computeCosineSimilarity(largeVectorA, largeVectorB);
      }, 1000);
      
      expect(typeof result).toBe('number');
    });

    it('normalizeVector - 1000维向量', () => {
      const result = measurePerformance('normalizeVector - 1000维向量', () => {
        return normalizeVector(largeVectorA);
      }, 500);
      
      expect(result).toBeInstanceOf(Float32Array);
    });
  });

  describe('量化性能', () => {
    const vectors = Array.from({ length: 100 }, () => 
      new Float32Array(128).map(() => Math.random() * 2 - 1)
    );

    it('quickQuantize - 100个128维向量', () => {
      const result = measurePerformance('quickQuantize - 100个128维向量', () => {
        return quickQuantize(vectors);
      }, 100);
      
      expect(result).toHaveProperty('quantizedVectors');
      expect(result).toHaveProperty('queryQuantizer');
    });

    it('createBinaryQuantizationFormat', () => {
      const result = measurePerformance('createBinaryQuantizationFormat', () => {
        return createBinaryQuantizationFormat();
      }, 1000);
      
      expect(result).toBeDefined();
    });
  });

  describe('搜索性能', () => {
    const queryVector = new Float32Array(128).map(() => Math.random() * 2 - 1);
    const targetVectors = Array.from({ length: 1000 }, () => 
      new Float32Array(128).map(() => Math.random() * 2 - 1)
    );

    it('quickSearch - 1000个目标向量，k=10', () => {
      const result = measurePerformance('quickSearch - 1000个目标向量，k=10', () => {
        return quickSearch(queryVector, targetVectors, 10);
      }, 50);
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('quickSearch - 1000个目标向量，k=100', () => {
      const result = measurePerformance('quickSearch - 1000个目标向量，k=100', () => {
        return quickSearch(queryVector, targetVectors, 100);
      }, 50);
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('大规模数据性能', () => {
    const largeVectors = Array.from({ length: 10000 }, () => 
      new Float32Array(256).map(() => Math.random() * 2 - 1)
    );
    const largeQueryVector = new Float32Array(256).map(() => Math.random() * 2 - 1);

    it('quickQuantize - 10000个256维向量', () => {
      const result = measurePerformance('quickQuantize - 10000个256维向量', () => {
        return quickQuantize(largeVectors.slice(0, 1000)); // 限制测试规模
      }, 10);
      
      expect(result).toHaveProperty('quantizedVectors');
    });

    it('quickSearch - 10000个目标向量，k=50', () => {
      const result = measurePerformance('quickSearch - 10000个目标向量，k=50', () => {
        return quickSearch(largeQueryVector, largeVectors.slice(0, 1000), 50); // 限制测试规模
      }, 10);
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('内存使用优化', () => {
    const vectors = Array.from({ length: 500 }, () => 
      new Float32Array(64).map(() => Math.random() * 2 - 1)
    );

    it('重复量化操作 - 内存重用', () => {
      const result = measurePerformance('重复量化操作 - 内存重用', () => {
        const format = createBinaryQuantizationFormat();
        for (let i = 0; i < 10; i++) {
          format.quantizeVectors(vectors);
        }
        return format;
      }, 20);
      
      expect(result).toBeDefined();
    });

    it('批量搜索操作', () => {
      const result = measurePerformance('批量搜索操作', () => {
        const queryVectors = Array.from({ length: 10 }, () => 
          new Float32Array(64).map(() => Math.random() * 2 - 1)
        );
        const format = createBinaryQuantizationFormat();
        const { quantizedVectors } = format.quantizeVectors(vectors);
        
                 const results: Array<Array<{index: number; score: number; originalScore?: number}>> = [];
         for (const queryVector of queryVectors) {
           results.push(format.searchNearestNeighbors(queryVector, quantizedVectors, 10));
         }
         return results;
      }, 10);
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('位运算优化性能', () => {
    // 为int4BitDotProductOptimized准备数据：indexVector长度为2，queryVector长度为8
    const indexVectorOptimized = new Uint8Array(2).map(() => Math.floor(Math.random() * 2)); // 1位值
    const queryVectorOptimized = new Uint8Array(8).map(() => Math.floor(Math.random() * 16)); // 4位值
    // 转置后长度应为4
    const transposedQueryOptimized = new Uint8Array(Math.ceil(queryVectorOptimized.length / 8) * 4);
    OptimizedScalarQuantizer.transposeHalfByte(queryVectorOptimized, transposedQueryOptimized);
    
    // 为int4BitDotProduct准备数据：indexVector长度为8，queryVector长度为8
    const indexVector = new Uint8Array(8).map(() => Math.floor(Math.random() * 2)); // 1位值
    const queryVector = new Uint8Array(8).map(() => Math.floor(Math.random() * 16)); // 4位值
    // 转置后长度应为4
    const transposedQuery = new Uint8Array(Math.ceil(queryVector.length / 8) * 4);
    OptimizedScalarQuantizer.transposeHalfByte(queryVector, transposedQuery);

    it('int4BitDotProduct - 位运算点积', () => {
      const result = measurePerformance('int4BitDotProduct - 位运算点积', () => {
        return computeInt4BitDotProduct(transposedQuery, indexVector);
      }, 1000);
      expect(typeof result).toBe('number');
    });

    it('int4BitDotProductOptimized - 优化位运算点积', () => {
      const result = measurePerformance('int4BitDotProductOptimized - 优化位运算点积', () => {
        return computeInt4BitDotProductOptimized(queryVectorOptimized, indexVectorOptimized);
      }, 1000);
      expect(typeof result).toBe('number');
    });
  });
}); 