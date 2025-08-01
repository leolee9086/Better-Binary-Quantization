import { describe, it, expect, beforeAll } from 'vitest';
import { BinaryQuantizationFormat } from '@src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '@src/types';
import { normalizeVector } from '@src/vectorOperations';

/**
 * @�? 1bit 量化, 4bit 查询性能瓶颈测试
 * 旨在测量在特定量化配置下，量化和查询阶段的性能，以找出潜在瓶颈�? */

/**
 * 生成测试向量
 * @param count 向量数量
 * @param dimension 向量维度
 * @returns 生成的测试向量数�? */
function generateVectors(count: number, dimension: number): Float32Array[] {
  const vectors: Float32Array[] = [];
  for (let i = 0; i < count; i++) {
    const vector = new Float32Array(dimension);
    for (let j = 0; j < dimension; j++) {
      vector[j] = Math.random() * 2 - 1; // [-1, 1]
    }
    vectors.push(normalizeVector(vector));
  }
  return vectors;
}

/**
 * 性能测量工具
 * @param name 测试名称
 * @param fn 执行函数
 * @param iterations 迭代次数
 * @returns 性能测量结果
 */
interface PerformanceResult<T> {
  result: T;
  avgTime: number;
  totalTime: number;
}

function measurePerformance<T>(name: string, fn: () => T, iterations: number = 1): PerformanceResult<T> {
  const start = performance.now();
  let result: T;
  
  for (let i = 0; i < iterations; i++) {
    result = fn();
  }
  
  const end = performance.now();
  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  
  console.log(`📊 ${name}: ${avgTime.toFixed(2)}ms (${iterations}次迭�? 总计${totalTime.toFixed(2)}ms)`);
  
  return { result: result!, avgTime, totalTime };
}

describe('1bit 量化, 4bit 查询性能瓶颈测试', () => {
  const DIMENSION = 1024;
  const NUM_VECTORS = 10000; // 向量数量
  const NUM_QUERIES = 100;   // 查询数量
  const K = 10;              // Top-K

  let vectors: Float32Array[];
  let quantizedVectors: any; // BinarizedByteVectorValues
  let format: BinaryQuantizationFormat;

  beforeAll(() => {
    // 生成测试数据
    vectors = generateVectors(NUM_VECTORS, DIMENSION);

    // 初始化量化格�?    format = new BinaryQuantizationFormat({
      queryBits: 4,
      indexBits: 1,
      quantizer: {
        similarityFunction: VectorSimilarityFunction.COSINE,
        lambda: 0.01,
        iters: 20
      }
    });

    // 测量向量量化时间（只执行一次）
    const quantizationResult = measurePerformance(
      '向量量化 (indexBits=1, queryBits=4)',
      () => format.quantizeVectors(vectors),
      1
    );
    quantizedVectors = quantizationResult.result.quantizedVectors;
  });

  it('测量 1bit 量化, 4bit 查询的搜索性能', () => {
    const queryVectors = generateVectors(NUM_QUERIES, DIMENSION);

    const searchPerformance = measurePerformance(
      '搜索最近邻 (1bit 量化, 4bit 查询)',
      () => {
        for (let i = 0; i < NUM_QUERIES; i++) {
          format.searchNearestNeighbors(queryVectors[i]!, quantizedVectors, K);
        }
        return null; // 返回 null 因为我们只关心时�?      },
      1 // 内部循环已经包含了多次查�?    );

    console.log(`\n--- 1bit 量化, 4bit 查询性能分析 ---`);
    console.log(`维度: ${DIMENSION}, 向量数量: ${NUM_VECTORS}, 查询数量: ${NUM_QUERIES}, K: ${K}`);
    console.log(`平均每次查询时间: ${(searchPerformance.avgTime / NUM_QUERIES).toFixed(2)}ms`);
    console.log(`查询吞吐�? ${Math.round(1000 / (searchPerformance.avgTime / NUM_QUERIES))} 查询/秒`);

    // 性能断言：确保在合理时间内完�?    expect(searchPerformance.avgTime).toBeLessThan(NUM_QUERIES * 100); // 假设每个查询不超�?00ms
  });
});
