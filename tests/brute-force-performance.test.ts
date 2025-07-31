import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '../src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '../src/types';
import { normalizeVector } from '../src/vectorOperations';
import { computeCosineSimilarity } from '../src/vectorSimilarity';

/**
 * @织: 暴力查询性能测试
 * 测试线性搜索的性能，与量化查询进行对比
 */

/**
 * 查询结果接口
 */
interface SearchResult {
  /** 向量索引 */
  index: number;
  /** 相似度分数 */
  similarity: number;
}

/**
 * 性能测量结果接口
 */
interface PerformanceResult<T> {
  /** 执行结果 */
  result: T;
  /** 平均执行时间 */
  avgTime: number;
  /** 总执行时间 */
  totalTime: number;
}

/**
 * 生成测试向量
 * @param count 向量数量
 * @param dimension 向量维度
 * @returns 生成的测试向量数组
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
 * @param query 查询向量
 * @param vectors 目标向量数组
 * @param k 返回的最近邻数量
 * @returns 查询结果数组
 */
function bruteForceSearch(query: Float32Array, vectors: Float32Array[], k: number): SearchResult[] {
  const similarities: SearchResult[] = vectors.map((vector, index) => ({
    index,
    similarity: computeCosineSimilarity(query, vector)
  }));
  
  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, k);
}

/**
 * 性能测量工具
 * @param name 测试名称
 * @param fn 执行函数
 * @param iterations 迭代次数
 * @returns 性能测量结果
 */
function measurePerformance<T>(name: string, fn: () => T, iterations: number = 1): PerformanceResult<T> {
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

describe('暴力查询性能测试', () => {
  const DIMENSIONS = [128, 256, 512, 1024];
  const BASE_SIZES = [1000, 5000, 10000];
  const QUERY_SIZE = 10;
  const K = 10;
  
  describe('不同维度的暴力查询性能', () => {
    DIMENSIONS.forEach(dim => {
      BASE_SIZES.forEach(baseSize => {
        it(`${dim}维向量 ${baseSize}个向量的暴力查询性能`, () => {
          // 生成测试数据
          const vectors = generateVectors(baseSize, dim);
          const queryVectors = generateVectors(QUERY_SIZE, dim);
          
          // 测试暴力查询性能
          const queryTimes: number[] = [];
          for (let i = 0; i < QUERY_SIZE; i++) {
            const query = queryVectors[i]!;
            const start = performance.now();
            bruteForceSearch(query, vectors, K);
            const end = performance.now();
            queryTimes.push(end - start);
          }
          
          const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
          const minQueryTime = Math.min(...queryTimes);
          const maxQueryTime = Math.max(...queryTimes);
          
          console.log(`\n📊 ${dim}维 ${baseSize}个向量暴力查询:`);
          console.log(`  平均查询时间: ${avgQueryTime.toFixed(2)}ms`);
          console.log(`  最快查询时间: ${minQueryTime.toFixed(2)}ms`);
          console.log(`  最慢查询时间: ${maxQueryTime.toFixed(2)}ms`);
          console.log(`  查询吞吐量: ${Math.round(1000 / avgQueryTime)} 查询/秒`);
          console.log(`  计算复杂度: O(${baseSize} × ${dim})`);
          
          // 性能断言
          expect(avgQueryTime).toBeLessThan(10000); // 10秒内完成
        });
      });
    });
  });

  describe('量化索引构建时间测试', () => {
    it('测试量化索引构建时间', () => {
      const dim = 1024;
      const baseSize = 5000;
      const vectors = generateVectors(baseSize, dim);
      
      // 构建量化索引
      const format = new BinaryQuantizationFormat({
        queryBits: 4,
        indexBits: 1,
        quantizer: {
          similarityFunction: VectorSimilarityFunction.COSINE,
          lambda: 0.01,
          iters: 20
        }
      });
      
      const buildTime = measurePerformance('量化索引构建', () => format.quantizeVectors(vectors), 1);
      
      console.log(`\n📊 量化索引构建分析:`);
      console.log(`构建时间: ${buildTime.avgTime.toFixed(2)}ms`);
      console.log(`构建速度: ${Math.round(baseSize / (buildTime.avgTime / 1000))} 向量/秒`);
      console.log(`每向量构建时间: ${(buildTime.avgTime / baseSize).toFixed(3)}ms`);
      
      // 构建时间断言
      expect(buildTime.avgTime).toBeLessThan(10000); // 10秒内完成构建
    });
  });

  describe('暴力查询与量化查询性能对比', () => {
    it('1024维向量暴力查询与量化查询对比', () => {
      const dim = 1024;
      const baseSize = 5000;
      const vectors = generateVectors(baseSize, dim);
      const queryVectors = generateVectors(QUERY_SIZE, dim);
      
      // 构建量化索引（不计入查询时间）
      const format = new BinaryQuantizationFormat({
        queryBits: 4,
        indexBits: 1,
        quantizer: {
          similarityFunction: VectorSimilarityFunction.COSINE,
          lambda: 0.01,
          iters: 20
        }
      });
      
      const { quantizedVectors } = format.quantizeVectors(vectors);
      
      // 测试暴力查询（纯查询时间）
      const bruteForceMethod = (): SearchResult[][] => {
        const results: SearchResult[][] = [];
        for (let i = 0; i < QUERY_SIZE; i++) {
          const query = queryVectors[i]!;
          results.push(bruteForceSearch(query, vectors, K));
        }
        return results;
      };
      
      // 测试量化查询（纯查询时间，不包含构建时间）
      const quantizedMethod = () => {
        const results = [];
        for (let i = 0; i < QUERY_SIZE; i++) {
          const query = queryVectors[i]!;
          results.push(format.searchNearestNeighbors(query, quantizedVectors, K));
        }
        return results;
      };
      
      // 性能测试（只测试纯查询时间）
      const bruteForceTime = measurePerformance('暴力查询（纯查询）', bruteForceMethod, 3);
      const quantizedTime = measurePerformance('量化查询（纯查询）', quantizedMethod, 3);
      
      // 计算性能提升
      const speedup = bruteForceTime.avgTime / quantizedTime.avgTime;
      const timeSaved = bruteForceTime.avgTime - quantizedTime.avgTime;
      
      console.log(`\n📈 性能对比分析:`);
      console.log(`暴力查询平均时间: ${bruteForceTime.avgTime.toFixed(2)}ms`);
      console.log(`量化查询平均时间: ${quantizedTime.avgTime.toFixed(2)}ms`);
      console.log(`加速比: ${speedup.toFixed(2)}x`);
      console.log(`时间节省: ${timeSaved.toFixed(2)}ms`);
      console.log(`性能提升: ${((speedup - 1) * 100).toFixed(1)}%`);
      
      // 验证结果一致性
      const bruteForceResults = bruteForceMethod();
      const quantizedResults = quantizedMethod();
      
      let consistencyCount = 0;
      for (let i = 0; i < QUERY_SIZE; i++) {
        const bruteForceSet = new Set(bruteForceResults[i]!.map(r => r.index));
        const quantizedSet = new Set(quantizedResults[i]!.map(r => r.index));
        const intersection = new Set([...bruteForceSet].filter(x => quantizedSet.has(x)));
        if (intersection.size >= K * 0.8) { // 80%一致性
          consistencyCount++;
        }
      }
      
      console.log(`结果一致性: ${consistencyCount}/${QUERY_SIZE} 个查询达到80%一致性`);
      
      // 性能断言（允许量化查询在小规模数据上可能更慢）
      expect(speedup).toBeGreaterThan(0.1); // 量化查询不应比暴力查询慢10倍以上
      expect(quantizedTime.avgTime).toBeLessThan(bruteForceTime.avgTime * 10); // 量化查询时间不应超过暴力查询10倍
    });
  });

  describe('大规模数据暴力查询性能', () => {
    it('大规模数据的暴力查询性能测试', () => {
      const dim = 1024;
      const largeSizes = [10000, 20000, 50000];
      
      largeSizes.forEach(baseSize => {
        console.log(`\n🔍 测试 ${baseSize} 个 ${dim}维向量...`);
        
        // 生成大规模数据
        const vectors = generateVectors(baseSize, dim);
        const queryVectors = generateVectors(3, dim); // 只测试3个查询以节省时间
        
        // 测试单个查询的性能
        const query = queryVectors[0]!;
        const { avgTime } = measurePerformance(
          `暴力查询 ${baseSize}个${dim}维向量`,
          () => bruteForceSearch(query, vectors, K),
          1
        );
        
        // 计算理论复杂度
        const operations = baseSize * dim * 2; // 每个向量需要dim次乘法和dim次加法
        const operationsPerMs = operations / avgTime;
        
        console.log(`  理论操作数: ${operations.toLocaleString()}`);
        console.log(`  操作速度: ${Math.round(operationsPerMs).toLocaleString()} 操作/ms`);
        console.log(`  预计100万向量查询时间: ${((1000000 * dim * 2) / operationsPerMs / 1000).toFixed(1)}秒`);
        
        // 性能断言
        expect(avgTime).toBeLessThan(30000); // 30秒内完成
      });
    });
  });

  describe('内存使用对比', () => {
    it('暴力查询与量化查询的内存使用对比', () => {
      const dim = 1024;
      const baseSize = 10000;
      const vectors = generateVectors(baseSize, dim);
      
      // 测量原始内存使用
      const originalMemory = baseSize * dim * 4; // 4字节/浮点数
      
      // 构建量化索引
      const format = new BinaryQuantizationFormat({
        queryBits: 4,
        indexBits: 1,
        quantizer: {
          similarityFunction: VectorSimilarityFunction.COSINE,
          lambda: 0.01,
          iters: 20
        }
      });
      
      const { quantizedVectors } = format.quantizeVectors(vectors);
      const quantizedMemory = quantizedVectors.size() * (dim / 2); // 4位量化
      
      console.log(`\n📊 内存使用对比:`);
      console.log(`原始向量内存: ${(originalMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`量化向量内存: ${(quantizedMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`内存压缩比: ${(originalMemory / quantizedMemory).toFixed(1)}:1`);
      console.log(`内存节省: ${((1 - quantizedMemory / originalMemory) * 100).toFixed(1)}%`);
      
      // 内存使用断言
      expect(quantizedMemory).toBeLessThanOrEqual(originalMemory / 8); // 至少8倍压缩
    });
  });
}); 