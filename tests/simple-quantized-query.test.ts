import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '../src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '../src/types';
import { normalizeVector } from '../src/vectorOperations';

/**
 * 最简单的量化查询性能测试
 * 测量等规模数据下一次量化查询的时间
 */

/**
 * 生成测试向量
 */
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
 */
function measurePerformance<T>(name: string, fn: () => T, iterations: number = 1): {
  result: T;
  avgTime: number;
  totalTime: number;
} {
  const start = performance.now();
  let result: T;
  
  for (let i = 0; i < iterations; i++) {
    result = fn();
  }
  
  const end = performance.now();
  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  
  console.log(`📊 ${name}: ${avgTime.toFixed(2)}ms (${iterations}次迭代, 总计${totalTime.toFixed(2)}ms)`);
  
  return { result: result!, avgTime, totalTime };
}

describe('简单量化查询性能测试', () => {
  it('使用相同测量方式测试量化查询', () => {
    const dim = 1024;
    const baseSize = 5000;
    const k = 10;
    const queryCount = 10;
    
    console.log(`\n🔍 测试配置:`);
    console.log(`  向量维度: ${dim}`);
    console.log(`  向量数量: ${baseSize}`);
    console.log(`  查询次数: ${queryCount}`);
    console.log(`  返回数量: ${k}`);
    
    // 生成测试数据
    console.log(`\n📊 生成测试数据...`);
    const vectors = generateVectors(baseSize, dim);
    const queryVectors = generateVectors(queryCount, dim);
    
    // 构建量化索引
    console.log(`\n🔧 构建量化索引...`);
    const format = new BinaryQuantizationFormat({
      queryBits: 4,
      indexBits: 1,
      quantizer: {
        similarityFunction: VectorSimilarityFunction.COSINE,
        lambda: 0.01,
        iters: 20
      }
    });
    
    const buildStart = performance.now();
    const { quantizedVectors } = format.quantizeVectors(vectors);
    const buildEnd = performance.now();
    const buildTime = buildEnd - buildStart;
    
    console.log(`构建时间: ${buildTime.toFixed(2)}ms`);
    
    // 测试量化查询 - 使用相同的测量方式
    const quantizedMethod = () => {
      const results = [];
      for (let i = 0; i < queryCount; i++) {
        const query = queryVectors[i]!;
        results.push(format.searchNearestNeighbors(query, quantizedVectors, k));
      }
      return results;
    };
    
    console.log(`\n🔍 执行量化查询性能测试...`);
    const quantizedTime = measurePerformance('量化查询（批量）', quantizedMethod, 3);
    
    // 计算每次查询的平均时间
    const avgQueryTime = quantizedTime.avgTime / queryCount;
    
    console.log(`\n📈 性能统计:`);
    console.log(`总批次时间: ${quantizedTime.avgTime.toFixed(2)}ms`);
    console.log(`每次查询平均时间: ${avgQueryTime.toFixed(2)}ms`);
    console.log(`查询吞吐量: ${Math.round(1000 / avgQueryTime)} 查询/秒`);
    
    // 验证结果
    const results = quantizedTime.result;
    expect(results.length).toBe(queryCount);
    expect(results[0]!.length).toBe(k);
    
    console.log(`\n✅ 测试完成`);
  });
});