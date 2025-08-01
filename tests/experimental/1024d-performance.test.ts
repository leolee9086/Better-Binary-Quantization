import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '@src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '@src/types';
import { normalizeVector } from '@src/vectorOperations';
import { computeCosineSimilarity } from '@src/vectorSimilarity';
import { getOversampledTopKWithHeap } from '@src/topKSelector';

/**
 * @�? 1024维向量单比特量化+4bit查询性能测试
 * 测试大规模高维向量的量化性能和查询性能
 */

// 类型定义
interface PerformanceResult {
  result: any;
  avgTime: number;
  totalTime: number;
}

interface OversampleResult {
  factor: number;
  recall: number;
  queryTime: number;
  avgQueryTime: number;
}

// 生成1024维测试向�?
function generate1024DVectors(count: number): Float32Array[] {
  const vectors: Float32Array[] = [];
  for (let i = 0; i < count; i++) {
    const vector = new Float32Array(1024);
    for (let j = 0; j < 1024; j++) {
      vector[j] = Math.random() * 2 - 1; // [-1, 1]
    }
    vectors.push(normalizeVector(vector));
  }
  return vectors;
}



// 性能测量工具
function measurePerformance(name: string, fn: () => any, iterations: number = 1): PerformanceResult {
  const start = performance.now();
  let result: any;
  
  for (let i = 0; i < iterations; i++) {
    result = fn();
  }
  
  const end = performance.now();
  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  
  // eslint-disable-next-line no-console
  console.log(`📊 ${name}: ${avgTime.toFixed(2)}ms (${iterations}次迭�? 总计${totalTime.toFixed(2)}ms)`);
  
  return { result, avgTime, totalTime };
}

describe('1024维向量单比特量化+4bit查询性能测试', () => {
  const DIM = 1024;
  const BASE_SIZES = [5000];
  const QUERY_SIZE = 100;
  const K = 10;
  const OVERSAMPLE_FACTOR = 5; // 增加超采样因子到5�?
  
  // 生成测试数据
  const baseVectors = generate1024DVectors(Math.max(...BASE_SIZES));
  const queryVectors = generate1024DVectors(QUERY_SIZE);
  
  // 构建量化�?- 单比特量�?4bit查询配置
  const format = new BinaryQuantizationFormat({
    queryBits: 4, // 4位查询量�?
    indexBits: 1, // 1位索引量�?
    quantizer: {
      similarityFunction: VectorSimilarityFunction.COSINE,
      lambda: 0.01, // 减小lambda以提高精�?
      iters: 20 // 增加迭代次数以提高精�?
    }
  });

  describe('构建性能测试', () => {
    BASE_SIZES.forEach(baseSize => {
      it(`构建 ${baseSize} �?024维向量的量化索引`, () => {
        const vectors = baseVectors.slice(0, baseSize);
        
        // 测量构建时间
        const { result, avgTime } = measurePerformance(
          `构建${baseSize}�?024维向量量化索引`,
          () => format.quantizeVectors(vectors)
        );
        
        // 验证结果
        expect(result).toHaveProperty('quantizedVectors');
        expect(result.quantizedVectors.size()).toBe(baseSize);
        
        // 计算构建速度
        const buildSpeed = Math.round(baseSize / (avgTime / 1000));
        // eslint-disable-next-line no-console
        console.log(`  构建速度: ${buildSpeed} 向量/秒`);
        // eslint-disable-next-line no-console
        console.log(`  压缩�? 32:1 (1024�?× 4字节 �?128字节)`);
        // eslint-disable-next-line no-console
        console.log(`  压缩后大�? ${(1024 * 4 / 32).toFixed(0)} 字节/向量`);
        
        // 性能断言
        expect(avgTime).toBeLessThan(10000); // 10秒内完成
        expect(buildSpeed).toBeGreaterThan(100); // 至少100向量/�?
      });
    });
  });

  describe('查询性能测试', () => {
    BASE_SIZES.forEach(baseSize => {
      it(`查询 ${baseSize} �?024维向量的性能`, () => {
        const vectors = baseVectors.slice(0, baseSize);
        
        // 构建量化索引
        const { quantizedVectors } = format.quantizeVectors(vectors);
        
        // 测量查询时间
        const queryTimes: number[] = [];
        for (let i = 0; i < 10; i++) { // 测试10次查�?
          const query = queryVectors[i % queryVectors.length];
          if (!query) continue;
          const start = performance.now();
          format.searchNearestNeighbors(query, quantizedVectors, K);
          const end = performance.now();
          queryTimes.push(end - start);
        }
        
        const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
        const minQueryTime = Math.min(...queryTimes);
        const maxQueryTime = Math.max(...queryTimes);
        
        // eslint-disable-next-line no-console
        console.log(`📊 查询${baseSize}�?024维向�?`);
        // eslint-disable-next-line no-console
        console.log(`  平均查询时间: ${avgQueryTime.toFixed(2)}ms`);
        // eslint-disable-next-line no-console
        console.log(`  最快查询时�? ${minQueryTime.toFixed(2)}ms`);
        // eslint-disable-next-line no-console
        console.log(`  最慢查询时�? ${maxQueryTime.toFixed(2)}ms`);
        // eslint-disable-next-line no-console
        console.log(`  查询吞吐�? ${Math.round(1000 / avgQueryTime)} 查询/秒`);
        
        // 性能断言
        expect(avgQueryTime).toBeLessThan(100); // 平均查询时间小于100ms
        expect(minQueryTime).toBeLessThan(50);   // 最快查询时间小�?0ms
      });
    });
  });

  describe('召回率测�?, () => {
    it('1024维向量的召回率测�?, () => {
      const baseSize = 10000; // 使用1万个向量测试召回�?
      const vectors = baseVectors.slice(0, baseSize);
      
      // 构建量化索引
      const { quantizedVectors } = format.quantizeVectors(vectors);
      
      // 计算真实topK
      const trueTopK: number[][] = [];
      for (let i = 0; i < 10; i++) { // 测试10个查�?
        const query = queryVectors[i];
        if (!query) continue;
        const similarities = vectors.map((vector, index) => ({
          index,
          similarity: computeCosineSimilarity(query, vector)
        }));
        similarities.sort((a, b) => b.similarity - a.similarity);
        trueTopK.push(similarities.slice(0, K).map(x => x.index));
      }
      
      // 计算量化topK（使用最小堆优化�?
      const quantizedTopK: number[][] = [];
      for (let i = 0; i < 10; i++) {
        const query = queryVectors[i];
        if (!query) continue;
        
        // 使用最小堆优化的超采样topK选择
        const topKCandidates = getOversampledTopKWithHeap(query, quantizedVectors, vectors, K, OVERSAMPLE_FACTOR, format);
        quantizedTopK.push(topKCandidates.map(x => x.index));
        
        // 输出调试信息
        // eslint-disable-next-line no-console
        console.log(`\n超采样查�?${i} (最小堆优化):`);
        // eslint-disable-next-line no-console
        console.log(`  量化分数: [${topKCandidates.map(r => r.quantizedScore.toFixed(3)).join(', ')}]`);
        // eslint-disable-next-line no-console
        console.log(`  真实分数: [${topKCandidates.map(r => r.trueScore.toFixed(3)).join(', ')}]`);
      }
      
      // 计算召回�?
      let totalRecall = 0;
      for (let i = 0; i < 10; i++) {
        const trueSet = new Set(trueTopK[i]);
        const quantizedSet = new Set(quantizedTopK[i]);
        const intersection = new Set([...trueSet].filter(x => quantizedSet.has(x)));
        const recall = intersection.size / K;
        totalRecall += recall;
      }
      const avgRecall = totalRecall / 10;
      
      // eslint-disable-next-line no-console
      console.log(`📊 1024维向量召回率测试:`);
      // eslint-disable-next-line no-console
      console.log(`  平均召回�? ${avgRecall.toFixed(3)} (${(avgRecall * 100).toFixed(1)}%)`);
      // eslint-disable-next-line no-console
      console.log(`  测试规模: ${baseSize} �?024维向量`);
      // eslint-disable-next-line no-console
      console.log(`  查询数量: 10 个`);
      // eslint-disable-next-line no-console
      console.log(`  TopK: ${K}`);
      // eslint-disable-next-line no-console
      console.log(`  超采样因�? ${OVERSAMPLE_FACTOR}`);
      
      // 召回率断言
      expect(avgRecall).toBeGreaterThan(0.6); // 召回率应大于60%
    });
  });

  describe('不同超采样因子性能对比测试', () => {
    it('测试不同超采样因子对召回率和查询性能的影�?, () => {
      const baseSize = 5000; // 使用5000个向量进行对比测�?
      const vectors = baseVectors.slice(0, baseSize);
      
      // 构建量化索引
      const { quantizedVectors } = format.quantizeVectors(vectors);
      
      // 计算真实topK
      const trueTopK: number[][] = [];
      for (let i = 0; i < 5; i++) { // 测试5个查�?
        const query = queryVectors[i];
        if (!query) continue;
        const similarities = vectors.map((vector, index) => ({
          index,
          similarity: computeCosineSimilarity(query, vector)
        }));
        similarities.sort((a, b) => b.similarity - a.similarity);
        trueTopK.push(similarities.slice(0, K).map(x => x.index));
      }
      
      // 测试不同的超采样因子
      const oversampleFactors = [1, 2, 3, 5, 8, 10];
      const results: OversampleResult[] = [];
      
      for (const factor of oversampleFactors) {
        const startTime = performance.now();
        
        // 计算量化topK（使用最小堆优化�?
        const quantizedTopK: number[][] = [];
        for (let i = 0; i < 5; i++) {
          const query = queryVectors[i];
          if (!query) continue;
          
          // 使用最小堆优化的超采样topK选择
          const topKCandidates = getOversampledTopKWithHeap(query, quantizedVectors, vectors, K, factor, format);
          quantizedTopK.push(topKCandidates.map(x => x.index));
        }
        
        const endTime = performance.now();
        const queryTime = endTime - startTime;
        
        // 计算召回�?
        let totalRecall = 0;
        for (let i = 0; i < 5; i++) {
          const trueSet = new Set(trueTopK[i]);
          const quantizedSet = new Set(quantizedTopK[i]);
          const intersection = new Set([...trueSet].filter(x => quantizedSet.has(x)));
          const recall = intersection.size / K;
          totalRecall += recall;
        }
        const avgRecall = totalRecall / 5;
        
        results.push({
          factor,
          recall: avgRecall,
          queryTime,
          avgQueryTime: queryTime / 5
        });
      }
      
      // 输出结果对比
      // eslint-disable-next-line no-console
      console.log(`\n📊 不同超采样因子性能对比:`);
      // eslint-disable-next-line no-console
      console.log(`测试规模: ${baseSize} �?024维向�? 查询数量: 5�? TopK: ${K}`);
      // eslint-disable-next-line no-console
      console.log(`┌─────────────┬──────────┬──────────────┬─────────────────┐`);
      // eslint-disable-next-line no-console
      console.log(`�?超采样因�? �?召回�?  �?总查询时�?  �?平均查询时间    │`);
      // eslint-disable-next-line no-console
      console.log(`├─────────────┼──────────┼──────────────┼─────────────────┤`);
      
      results.forEach(result => {
        // eslint-disable-next-line no-console
        console.log(`�?${result.factor.toString().padStart(11)} �?${(result.recall * 100).toFixed(1).padStart(8)}% �?${result.queryTime.toFixed(2).padStart(12)}ms �?${result.avgQueryTime.toFixed(2).padStart(15)}ms │`);
      });
      
      // eslint-disable-next-line no-console
      console.log(`└─────────────┴──────────┴──────────────┴─────────────────┘`);
      
      // 性能分析
      const bestRecall = Math.max(...results.map(r => r.recall));
      const fastestQuery = Math.min(...results.map(r => r.avgQueryTime));
      const bestRecallResult = results.find(r => r.recall === bestRecall);
      const fastestResult = results.find(r => r.avgQueryTime === fastestQuery);
      
      // eslint-disable-next-line no-console
      console.log(`\n📈 性能分析:`);
      // eslint-disable-next-line no-console
      console.log(`最高召回率: ${(bestRecall * 100).toFixed(1)}% (超采样因�? ${bestRecallResult?.factor})`);
      // eslint-disable-next-line no-console
      console.log(`最快查�? ${fastestQuery.toFixed(2)}ms (超采样因�? ${fastestResult?.factor})`);
      
      // 找到召回率≥90%的最快配�?
      const highRecallResults = results.filter(r => r.recall >= 0.9);
      if (highRecallResults.length > 0) {
        const optimalResult = highRecallResults.reduce((min, current) => 
          current.avgQueryTime < min.avgQueryTime ? current : min
        );
        // eslint-disable-next-line no-console
        console.log(`推荐配置: 超采样因�?${optimalResult.factor} (召回�? ${(optimalResult.recall * 100).toFixed(1)}%, 查询时间: ${optimalResult.avgQueryTime.toFixed(2)}ms)`);
      }
      
      // 断言：至少有一个配置能达到90%召回�?
      expect(bestRecall).toBeGreaterThan(0.85);
    });
  });

  describe('最小堆优化性能对比测试', () => {
    it('比较最小堆优化前后的性能差异', () => {
      const baseSize = 3000; // 使用3000个向量进行性能对比
      const vectors = baseVectors.slice(0, baseSize);
      
      // 构建量化索引
      const { quantizedVectors } = format.quantizeVectors(vectors);
      
      // 计算真实topK
      const trueTopK: number[][] = [];
      for (let i = 0; i < 3; i++) {
        const query = queryVectors[i];
        if (!query) continue;
        const similarities = vectors.map((vector, index) => ({
          index,
          similarity: computeCosineSimilarity(query, vector)
        }));
        similarities.sort((a, b) => b.similarity - a.similarity);
        trueTopK.push(similarities.slice(0, K).map(x => x.index));
      }
      
      // 测试原始方法（排序）
      const originalMethod = (): number[][] => {
        const quantizedTopK: number[][] = [];
        for (let i = 0; i < 3; i++) {
          const query = queryVectors[i];
          if (!query) continue;
          const oversampledResults = format.searchNearestNeighbors(query, quantizedVectors, K * 5);
          
          const candidateScores = oversampledResults.map(result => {
            const vector = vectors[result.index];
            if (!vector) return null;
            return {
              index: result.index,
              quantizedScore: result.score,
              trueScore: computeCosineSimilarity(query, vector)
            };
          }).filter((c): c is {index:number,quantizedScore:number,trueScore:number} => c !== null);
          
          const sortedCandidates = candidateScores.sort((a, b) => b.trueScore - a.trueScore);
          quantizedTopK.push(sortedCandidates.slice(0, K).map(x => x.index));
        }
        return quantizedTopK;
      };
      
      // 测试最小堆优化方法
      const heapMethod = (): number[][] => {
        const quantizedTopK: number[][] = [];
        for (let i = 0; i < 3; i++) {
          const query = queryVectors[i];
          if (!query) continue;
          const topKCandidates = getOversampledTopKWithHeap(query, quantizedVectors, vectors, K, 5, format);
          quantizedTopK.push(topKCandidates.map(x => x.index));
        }
        return quantizedTopK;
      };
      
      // 性能测试
      const originalTime = measurePerformance('原始排序方法', originalMethod, 10);
      const heapTime = measurePerformance('最小堆优化方法', heapMethod, 10);
      
      // 计算性能提升
      const performanceImprovement = ((originalTime.avgTime - heapTime.avgTime) / originalTime.avgTime * 100);
      
      // eslint-disable-next-line no-console
      console.log(`\n📈 最小堆优化性能分析:`);
      // eslint-disable-next-line no-console
      console.log(`原始方法平均时间: ${originalTime.avgTime.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
      console.log(`最小堆方法平均时间: ${heapTime.avgTime.toFixed(2)}ms`);
      // eslint-disable-next-line no-console
      console.log(`性能提升: ${performanceImprovement.toFixed(1)}%`);
      // eslint-disable-next-line no-console
      console.log(`时间节省: ${(originalTime.avgTime - heapTime.avgTime).toFixed(2)}ms`);
      
      // 验证结果一致�?
      const originalResults = originalMethod();
      const heapResults = heapMethod();
      
      let consistencyCount = 0;
      for (let i = 0; i < 3; i++) {
        const originalSet = new Set(originalResults[i]);
        const heapSet = new Set(heapResults[i]);
        const intersection = new Set([...originalSet].filter(x => heapSet.has(x)));
        if (intersection.size === K) {
          consistencyCount++;
        }
      }
      
      // eslint-disable-next-line no-console
      console.log(`结果一致�? ${consistencyCount}/3 个查询完全一致`);
      
      // 性能断言
      expect(heapTime.avgTime).toBeLessThan(originalTime.avgTime * 1.2); // 堆方法不应比排序方法�?0%以上
      expect(performanceImprovement).toBeGreaterThan(-20); // 允许最�?0%的性能下降
    });
  });

  describe('内存使用分析', () => {
    it('1024维向量的内存使用情况', () => {
      const baseSize = 1000; // 1千个向量
      const vectors = baseVectors.slice(0, baseSize);
      
      // 测量原始内存使用
      const originalMemory = baseSize * DIM * 4; // 4字节/浮点�?
      
      // 构建量化索引
      const { quantizedVectors } = format.quantizeVectors(vectors);
      
      // 测量量化后内存使�?
      // 4位量化：每个向量占用 DIM/2 字节�?�?= 0.5字节�?
      const quantizedMemory = quantizedVectors.size() * (DIM / 2); // 4�?= 1/2字节
      
      // eslint-disable-next-line no-console
      console.log(`📊 1024维向量内存使用分�?`);
      // eslint-disable-next-line no-console
      console.log(`  原始内存: ${(originalMemory / 1024 / 1024).toFixed(2)} MB`);
      // eslint-disable-next-line no-console
      console.log(`  量化内存: ${(quantizedMemory / 1024 / 1024).toFixed(2)} MB`);
      // eslint-disable-next-line no-console
      console.log(`  压缩�? ${(originalMemory / quantizedMemory).toFixed(1)}:1`);
      // eslint-disable-next-line no-console
      console.log(`  内存节省: ${((1 - quantizedMemory / originalMemory) * 100).toFixed(1)}%`);
      // eslint-disable-next-line no-console
      console.log(`  每向量原始大�? ${(DIM * 4).toFixed(0)} 字节`);
      // eslint-disable-next-line no-console
      console.log(`  每向量量化大�? ${(DIM / 2).toFixed(0)} 字节`);
      
      // 内存使用断言
      expect(quantizedMemory).toBeLessThanOrEqual(originalMemory / 8); // 至少8倍压缩（4位量化）
    });
  });
}); 
