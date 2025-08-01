import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '@src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '@src/types';
import { normalizeVector } from '@src/vectorOperations';
import { computeCosineSimilarity } from '@src/vectorSimilarity';

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
 * 暴力查询实现
 */
function bruteForceSearch(query: Float32Array, vectors: Float32Array[], k: number): Array<{index: number; similarity: number}> {
  const similarities = vectors.map((vector, index) => ({
    index,
    similarity: computeCosineSimilarity(query, vector)
  }));
  
  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, k);
}

describe('单次查询时间测试', () => {
  it('测量单次查询时间', () => {
    const dim = 1024;
    const baseSize = 5000;
    const k = 10;
    
    console.log(`\n🔍 测试配置:`);
    console.log(`  向量维度: ${dim}`);
    console.log(`  向量数量: ${baseSize}`);
    console.log(`  返回数量: ${k}`);
    
    // 生成测试数据
    console.log(`\n📊 生成测试数据...`);
    const vectors = generateVectors(baseSize, dim);
    const queryVector = generateVectors(1, dim)[0]!;
    
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
    
    // 测试单次暴力查询
    console.log(`\n🔍 执行单次暴力查询...`);
    const bruteForceStart = performance.now();
    const bruteForceResults = bruteForceSearch(queryVector, vectors, k);
    const bruteForceEnd = performance.now();
    const bruteForceTime = bruteForceEnd - bruteForceStart;
    
    // 测试单次量化查询
    console.log(`\n🔍 执行单次量化查询...`);
    const quantizedStart = performance.now();
    const quantizedResults = format.searchNearestNeighbors(queryVector, quantizedVectors, k);
    const quantizedEnd = performance.now();
    const quantizedTime = quantizedEnd - quantizedStart;
    
    console.log(`\n📈 性能结果:`);
    console.log(`暴力查询时间: ${bruteForceTime.toFixed(2)}ms`);
    console.log(`量化查询时间: ${quantizedTime.toFixed(2)}ms`);
    console.log(`暴力查询吞吐�? ${Math.round(1000 / bruteForceTime)} 查询/秒`);
    console.log(`量化查询吞吐�? ${Math.round(1000 / quantizedTime)} 查询/秒`);
    
    // 验证结果一致�?
    const bruteForceSet = new Set(bruteForceResults.map(r => r.index));
    const quantizedSet = new Set(quantizedResults.map(r => r.index));
    const intersection = new Set([...bruteForceSet].filter(x => quantizedSet.has(x)));
    const consistencyRate = intersection.size / k;
    
    console.log(`\n📊 结果一致�? ${(consistencyRate * 100).toFixed(1)}%`);
    
    // 验证结果
    expect(bruteForceResults.length).toBe(k);
    expect(quantizedResults.length).toBe(k);
    expect(consistencyRate).toBeGreaterThanOrEqual(0.5); // 至少50%一致�?
    
    console.log(`\n�?测试完成`);
  });
});
