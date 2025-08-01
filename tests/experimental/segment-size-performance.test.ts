import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '@src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '@src/types';
import { normalizeVector } from '@src/vectorOperations';

/**
 * @�? 段大小性能测试
 * 测试不同段大小对性能的影�?
 */

// 生成测试数据
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

// 模拟分段量化
function simulateSegmentedQuantization(
  vectors: Float32Array[],
  segmentSize: number
): {
  quantizationTime: number;
  memoryUsage: number;
  queryTime: number;
  recall: number;
} {
  const startTime = performance.now();
  
  // 分段
  const segments: Float32Array[][] = [];
  for (let i = 0; i < vectors.length; i += segmentSize) {
    segments.push(vectors.slice(i, i + segmentSize));
  }
  
  // 量化每个�?
  const format = new BinaryQuantizationFormat({
    queryBits: 4,
    indexBits: 1,
    quantizer: {
      similarityFunction: VectorSimilarityFunction.COSINE,
      lambda: 0.001,
      iters: 20
    }
  });
  
  const quantizedSegments = segments.map(segmentVectors => {
    return format.quantizeVectors(segmentVectors);
  });
  
  const quantizationTime = performance.now() - startTime;
  
  // 估算内存使用
  const memoryUsage = quantizedSegments.reduce((total, segment) => {
    return total + segment.quantizedVectors.size() * 128; // 估算每个向量128字节
  }, 0);
  
  // 测试查询性能
  const queryVector = generateTestVectors(1, 128)[0];
  const queryStartTime = performance.now();
  
  let totalRecall = 0;
  let queryCount = 0;
  
  // 在每个段中查�?
  for (const segment of quantizedSegments) {
    if (!queryVector) {
      throw new Error('查询向量不存�?);
    }
    const results = format.searchNearestNeighbors(queryVector, segment.quantizedVectors, 10);
    queryCount++;
    
    // 计算召回率（简化版本）
    const trueTopK = segment.quantizedVectors.size() > 0 ? 1 : 0;
    const foundTopK = results.length > 0 ? 1 : 0;
    totalRecall += foundTopK / trueTopK;
  }
  
  const queryTime = performance.now() - queryStartTime;
  const avgRecall = queryCount > 0 ? totalRecall / queryCount : 0;
  
  return {
    quantizationTime,
    memoryUsage,
    queryTime,
    recall: avgRecall
  };
}

describe('段大小性能测试', () => {
  const TOTAL_VECTORS = 10000; // 1万向�?
  const DIMENSION = 128;
  const testVectors = generateTestVectors(TOTAL_VECTORS, DIMENSION);
  
  it('测试不同段大小的性能表现', () => {
    const segmentSizes = [100, 500, 1000, 5000, 10000]; // 100�?万向�?�?
    const results: Array<{
      segmentSize: number;
      segmentCount: number;
      quantizationTime: number;
      memoryUsage: number;
      queryTime: number;
      recall: number;
    }> = [];
    
    for (const segmentSize of segmentSizes) {
      const result = simulateSegmentedQuantization(testVectors, segmentSize);
      results.push({
        segmentSize,
        segmentCount: Math.ceil(TOTAL_VECTORS / segmentSize),
        ...result
      });
    }
    
    // 输出结果
    console.log('=== 段大小性能测试结果 ===');
    console.log('总向量数:', TOTAL_VECTORS);
    console.log('向量维度:', DIMENSION);
    console.log('');
    
    results.forEach(result => {
      console.log(`段大�? ${result.segmentSize} 向量`);
      console.log(`  段数�? ${result.segmentCount}`);
      console.log(`  量化时间: ${result.quantizationTime.toFixed(2)}ms`);
      console.log(`  内存使用: ${(result.memoryUsage / 1024).toFixed(2)}KB`);
      console.log(`  查询时间: ${result.queryTime.toFixed(2)}ms`);
      console.log(`  召回�? ${(result.recall * 100).toFixed(1)}%`);
      console.log('');
    });
    
    // 分析最佳段大小
    const bestForSpeed = results.reduce((best, current) => 
      current.quantizationTime < best.quantizationTime ? current : best
    );
    
    const bestForMemory = results.reduce((best, current) => 
      current.memoryUsage < best.memoryUsage ? current : best
    );
    
    const bestForQuery = results.reduce((best, current) => 
      current.queryTime < best.queryTime ? current : best
    );
    
    console.log('=== 性能分析 ===');
    console.log(`最快量�? ${bestForSpeed.segmentSize} 向量/段`);
    console.log(`最少内�? ${bestForMemory.segmentSize} 向量/段`);
    console.log(`最快查�? ${bestForQuery.segmentSize} 向量/段`);
    
    // 断言基本性能要求
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.quantizationTime < 10000)).toBe(true); // 量化时间小于10�?
    expect(results.every(r => r.queryTime < 1000)).toBe(true); // 查询时间小于1�?
  });
  
  it('测试段大小对更新性能的影�?, () => {
    // 模拟添加新向量的场景
    const newVectors = generateTestVectors(100, DIMENSION);
    const segmentSizes = [100, 1000, 5000];
    
    console.log('=== 更新性能测试 ===');
    
    segmentSizes.forEach(segmentSize => {
      const segmentCount = Math.ceil(TOTAL_VECTORS / segmentSize);
      const segmentsToUpdate = Math.ceil(newVectors.length / segmentSize);
      
      console.log(`段大�? ${segmentSize} 向量`);
      console.log(`  总段�? ${segmentCount}`);
      console.log(`  需要更新的段数: ${segmentsToUpdate}`);
      console.log(`  更新比例: ${((segmentsToUpdate / segmentCount) * 100).toFixed(1)}%`);
      console.log('');
    });
  });
}); 
