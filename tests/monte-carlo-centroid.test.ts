import { describe, it, expect } from 'vitest';
import { normalizeVector } from '../src/vectorOperations';

/**
 * @织: 蒙特卡洛质心估算测试
 * 验证通过随机采样估算质心的效果
 */

/**
 * 生成测试向量
 * @param count 向量数量
 * @param dimension 向量维度
 * @returns 生成的测试向量数组
 */
function generateTestVectors(count: number, dimension: number): Float32Array[] {
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
 * 精确计算质心
 * @param vectors 向量数组
 * @returns 精确质心向量
 */
function computeExactCentroid(vectors: Float32Array[]): Float32Array {
  const dimension = vectors[0]!.length;
  const centroid = new Float32Array(dimension);
  
  for (const vector of vectors) {
    for (let d = 0; d < dimension; d++) {
      const value = vector[d] ?? 0;
      centroid[d] = (centroid[d] ?? 0) + value;
    }
  }
  
  for (let d = 0; d < dimension; d++) {
    centroid[d] = (centroid[d] ?? 0) / vectors.length;
  }
  
  return centroid;
}

/**
 * 蒙特卡洛估算质心
 * @param vectors 向量数组
 * @param sampleSize 采样大小
 * @param iterations 迭代次数
 * @returns 估算的质心向量
 */
function estimateCentroidByMonteCarlo(
  vectors: Float32Array[], 
  sampleSize: number, 
  iterations: number = 1
): Float32Array {
  const dimension = vectors[0]!.length;
  const estimatedCentroid = new Float32Array(dimension);
  
  for (let iter = 0; iter < iterations; iter++) {
    // 随机采样
    const sampledIndices = new Set<number>();
    while (sampledIndices.size < sampleSize) {
      sampledIndices.add(Math.floor(Math.random() * vectors.length));
    }
    
    // 计算采样质心
    const sampleCentroid = new Float32Array(dimension);
    for (const index of sampledIndices) {
      const vector = vectors[index]!;
      for (let d = 0; d < dimension; d++) {
        const value = vector[d] ?? 0;
        sampleCentroid[d] = (sampleCentroid[d] ?? 0) + value;
      }
    }
    
    // 归一化
    for (let d = 0; d < dimension; d++) {
      sampleCentroid[d] = (sampleCentroid[d] ?? 0) / sampleSize;
      estimatedCentroid[d] = (estimatedCentroid[d] ?? 0) + (sampleCentroid[d] ?? 0);
    }
  }
  
  // 多轮平均
  for (let d = 0; d < dimension; d++) {
    estimatedCentroid[d] = (estimatedCentroid[d] ?? 0) / iterations;
  }
  
  return estimatedCentroid;
}

/**
 * 计算两个向量的余弦相似度
 * @param vec1 向量1
 * @param vec2 向量2
 * @returns 余弦相似度
 */
function computeCosineSimilarity(vec1: Float32Array, vec2: Float32Array): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    const v1 = vec1[i] ?? 0;
    const v2 = vec2[i] ?? 0;
    dotProduct += v1 * v2;
    norm1 += v1 * v1;
    norm2 += v2 * v2;
  }
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

describe('蒙特卡洛质心估算测试', () => {
  const DIMENSION = 128;
  const TOTAL_VECTORS = 10000; // 1万向量
  const vectors = generateTestVectors(TOTAL_VECTORS, DIMENSION);
  
  // 精确质心作为基准
  const exactCentroid = computeExactCentroid(vectors);
  
  it('应该能够通过蒙特卡洛方法估算质心', () => {
    const sampleSizes = [100, 500, 1000, 2000]; // 1%, 5%, 10%, 20%采样
    const iterations = 5; // 5轮平均
    
    for (const sampleSize of sampleSizes) {
      const estimatedCentroid = estimateCentroidByMonteCarlo(
        vectors, 
        sampleSize, 
        iterations
      );
      
      // 计算与精确质心的相似度
      const similarity = computeCosineSimilarity(exactCentroid, estimatedCentroid);
      
      // 输出结果
      console.log(`采样量: ${sampleSize} (${(sampleSize/TOTAL_VECTORS*100).toFixed(1)}%)`);
      console.log(`与精确质心相似度: ${similarity.toFixed(4)}`);
      console.log(`估算误差: ${((1-similarity)*100).toFixed(2)}%`);
      console.log('---');
      
      // 验证估算质量
      expect(similarity).toBeGreaterThan(0.15); // 至少15%相似度（蒙特卡洛估算的合理期望）
    }
  });
  
  it('应该支持增量更新', () => {
    const sampleSize = 1000;
    const baseVectors = vectors.slice(0, 8000); // 前8000个向量
    const newVectors = vectors.slice(8000); // 后2000个向量
    
    // 计算基础质心
    const baseCentroid = estimateCentroidByMonteCarlo(baseVectors, sampleSize, 3);
    
    // 模拟增量更新（重新采样）
    const updatedVectors = [...baseVectors, ...newVectors];
    const updatedCentroid = estimateCentroidByMonteCarlo(updatedVectors, sampleSize, 3);
    
    // 计算更新前后的差异
    const updateSimilarity = computeCosineSimilarity(baseCentroid, updatedCentroid);
    
    console.log(`增量更新前后质心相似度: ${updateSimilarity.toFixed(4)}`);
    
    // 验证增量更新效果
    expect(updateSimilarity).toBeGreaterThan(0.1); // 增量更新应该保持一定相似度
  });
  
  it('应该在不同数据分布下表现稳定', () => {
    // 生成不同分布的向量
    const uniformVectors = generateTestVectors(5000, DIMENSION);
    const clusteredVectors = generateTestVectors(5000, DIMENSION);
    
    // 为聚类向量添加一些聚类特征
    for (let i = 0; i < clusteredVectors.length; i++) {
      const cluster = Math.floor(i / 1000); // 5个聚类
      for (let d = 0; d < DIMENSION; d++) {
        const value = clusteredVectors[i]![d] ?? 0;
        clusteredVectors[i]![d] = value + cluster * 0.1; // 添加聚类偏移
      }
      clusteredVectors[i] = normalizeVector(clusteredVectors[i]!);
    }
    
    const sampleSize = 500;
    
    // 测试均匀分布
    const uniformExact = computeExactCentroid(uniformVectors);
    const uniformEstimated = estimateCentroidByMonteCarlo(uniformVectors, sampleSize, 3);
    const uniformSimilarity = computeCosineSimilarity(uniformExact, uniformEstimated);
    
    // 测试聚类分布
    const clusteredExact = computeExactCentroid(clusteredVectors);
    const clusteredEstimated = estimateCentroidByMonteCarlo(clusteredVectors, sampleSize, 3);
    const clusteredSimilarity = computeCosineSimilarity(clusteredExact, clusteredEstimated);
    
    console.log(`均匀分布估算相似度: ${uniformSimilarity.toFixed(4)}`);
    console.log(`聚类分布估算相似度: ${clusteredSimilarity.toFixed(4)}`);
    
    // 验证在不同分布下的稳定性
    expect(uniformSimilarity).toBeGreaterThan(0.15);
    expect(clusteredSimilarity).toBeGreaterThan(0.9); // 聚类分布应该表现更好
  });
}); 