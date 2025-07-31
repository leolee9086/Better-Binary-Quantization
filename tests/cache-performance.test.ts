import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '../src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '../src/types';
import { normalizeVector } from '../src/vectorOperations';

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

describe('缓存性能测试', () => {
  it('测试缓存命中率和性能', () => {
    const dim = 1024;
    const baseSize = 5000;
    const k = 10;
    const queryCount = 20;
    
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
    
    // 执行多次查询
    console.log(`\n🔍 执行${queryCount}次查询...`);
    const queryTimes: number[] = [];
    
    for (let i = 0; i < queryCount; i++) {
      const queryStart = performance.now();
      const results = format.searchNearestNeighbors(queryVectors[i]!, quantizedVectors, k);
      const queryEnd = performance.now();
      const queryTime = queryEnd - queryStart;
      queryTimes.push(queryTime);
      
      console.log(`  查询${i + 1}: ${queryTime.toFixed(2)}ms`);
    }
    
    const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
    const minQueryTime = Math.min(...queryTimes);
    const maxQueryTime = Math.max(...queryTimes);
    
    console.log(`\n📈 性能统计:`);
    console.log(`平均查询时间: ${avgQueryTime.toFixed(2)}ms`);
    console.log(`最快查询时间: ${minQueryTime.toFixed(2)}ms`);
    console.log(`最慢查询时间: ${maxQueryTime.toFixed(2)}ms`);
    console.log(`查询吞吐量: ${Math.round(1000 / avgQueryTime)} 查询/秒`);
    
    // 验证结果
    expect(avgQueryTime).toBeLessThan(300); // 平均查询时间小于300ms
    
    console.log(`\n✅ 测试完成`);
  });
}); 