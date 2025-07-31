import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '../src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '../src/types';
import { normalizeVector } from '../src/vectorOperations';
import { computeCosineSimilarity } from '../src/vectorSimilarity';

/**
 * @织: 量化查询流程性能测试
 * 重建整个量化查询流程，每一步都打点记录性能
 */

/**
 * 性能打点记录接口
 */
interface PerformancePoint {
  /** 步骤名称 */
  step: string;
  /** 执行时间 */
  time: number;
  /** 开始时间戳 */
  startTime: number;
  /** 结束时间戳 */
  endTime: number;
  /** 额外信息 */
  info?: Record<string, any>;
}

/**
 * 性能分析结果接口
 */
interface PerformanceAnalysis {
  /** 总执行时间 */
  totalTime: number;
  /** 各步骤性能记录 */
  steps: PerformancePoint[];
  /** 步骤时间占比 */
  timeDistribution: Record<string, number>;
  /** 性能瓶颈分析 */
  bottlenecks: string[];
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
 * 性能打点工具
 */
class PerformanceProfiler {
  private points: PerformancePoint[] = [];
  private currentStep: string | null = null;
  private stepStartTime: number = 0;

  /**
   * 开始记录步骤
   * @param step 步骤名称
   * @param info 额外信息
   */
  startStep(step: string, info?: Record<string, any>): void {
    if (this.currentStep) {
      this.endStep();
    }
    this.currentStep = step;
    this.stepStartTime = performance.now();
    console.log(`🔍 开始步骤: ${step}`);
    if (info) {
      console.log(`   信息:`, info);
    }
  }

  /**
   * 结束当前步骤
   */
  endStep(): void {
    if (!this.currentStep) return;
    
    const endTime = performance.now();
    const duration = endTime - this.stepStartTime;
    
    this.points.push({
      step: this.currentStep,
      time: duration,
      startTime: this.stepStartTime,
      endTime: endTime
    });
    
    console.log(`✅ 完成步骤: ${this.currentStep} (${duration.toFixed(2)}ms)`);
    this.currentStep = null;
  }

  /**
   * 记录中间点
   * @param step 步骤名称
   * @param info 额外信息
   */
  recordPoint(step: string, info?: Record<string, any>): void {
    const time = performance.now();
    this.points.push({
      step,
      time: 0,
      startTime: time,
      endTime: time,
      info
    });
    console.log(`📍 记录点: ${step} (${time.toFixed(2)}ms)`);
    if (info) {
      console.log(`   信息:`, info);
    }
  }

  /**
   * 获取性能分析结果
   * @returns 性能分析结果
   */
  getAnalysis(): PerformanceAnalysis {
    this.endStep(); // 确保最后一个步骤被记录
    
    const totalTime = this.points.reduce((sum, point) => sum + point.time, 0);
    
    // 计算时间分布
    const timeDistribution: Record<string, number> = {};
    this.points.forEach(point => {
      if (point.time > 0) {
        timeDistribution[point.step] = (point.time / totalTime) * 100;
      }
    });
    
    // 识别性能瓶颈（占用时间超过10%的步骤）
    const bottlenecks = Object.entries(timeDistribution)
      .filter(([_, percentage]) => percentage > 10)
      .sort(([_, a], [__, b]) => b - a)
      .map(([step, percentage]) => `${step} (${percentage.toFixed(1)}%)`);
    
    return {
      totalTime,
      steps: this.points,
      timeDistribution,
      bottlenecks
    };
  }

  /**
   * 打印性能分析报告
   */
  printReport(): void {
    const analysis = this.getAnalysis();
    
    console.log('\n📊 性能分析报告');
    console.log('='.repeat(50));
    console.log(`总执行时间: ${analysis.totalTime.toFixed(2)}ms`);
    console.log('\n📈 各步骤时间分布:');
    
    Object.entries(analysis.timeDistribution)
      .sort(([_, a], [__, b]) => b - a)
      .forEach(([step, percentage]) => {
        const stepData = analysis.steps.find(p => p.step === step);
        const time = stepData?.time || 0;
        console.log(`  ${step}: ${time.toFixed(2)}ms (${percentage.toFixed(1)}%)`);
      });
    
    if (analysis.bottlenecks.length > 0) {
      console.log('\n⚠️ 性能瓶颈:');
      analysis.bottlenecks.forEach(bottleneck => {
        console.log(`  - ${bottleneck}`);
      });
    }
    
    console.log('\n📋 详细步骤记录:');
    analysis.steps.forEach((point, index) => {
      if (point.time > 0) {
        console.log(`  ${index + 1}. ${point.step}: ${point.time.toFixed(2)}ms`);
      } else {
        console.log(`  ${index + 1}. ${point.step}: 记录点`);
      }
    });
  }
}

describe('量化查询流程性能测试', () => {
  const DIMENSION = 1024;
  const BASE_SIZE = 5000;
  const QUERY_SIZE = 5;
  const K = 10;

  describe('完整量化查询流程性能分析', () => {
    it('1bit量化查询完整流程性能分析', () => {
      const profiler = new PerformanceProfiler();
      
      // 1. 数据准备阶段
      profiler.startStep('数据生成', { dimension: DIMENSION, baseSize: BASE_SIZE, querySize: QUERY_SIZE });
      const vectors = generateVectors(BASE_SIZE, DIMENSION);
      const queryVectors = generateVectors(QUERY_SIZE, DIMENSION);
      profiler.endStep();
      
      // 2. 量化索引构建阶段
      profiler.startStep('量化索引构建', { queryBits: 1, indexBits: 1 });
      const format = new BinaryQuantizationFormat({
        queryBits: 1,
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
      profiler.recordPoint('量化构建完成', { 
        buildTime: buildEnd - buildStart,
        vectorsPerSecond: Math.round(BASE_SIZE / ((buildEnd - buildStart) / 1000))
      });
      profiler.endStep();
      
      // 3. 查询执行阶段
      profiler.startStep('查询向量处理', { queryCount: QUERY_SIZE });
      const processedQueries: Float32Array[] = [];
      for (let i = 0; i < QUERY_SIZE; i++) {
        const query = queryVectors[i]!;
        const normalizedQuery = normalizeVector(query);
        processedQueries.push(normalizedQuery);
      }
      profiler.endStep();
      
      // 4. 质心获取
      profiler.startStep('质心获取');
      const centroid = quantizedVectors.getCentroid();
      profiler.recordPoint('质心获取完成', { centroidDimension: centroid.length });
      profiler.endStep();
      
      // 5. 查询向量量化
      profiler.startStep('查询向量量化', { queryBits: 1 });
      const quantizedQueries: Uint8Array[] = [];
      const queryCorrections: any[] = [];
      
      for (let i = 0; i < QUERY_SIZE; i++) {
        const query = processedQueries[i]!;
        const { quantizedQuery, queryCorrections: corrections } = format.quantizeQueryVector(query, centroid);
        quantizedQueries.push(quantizedQuery);
        queryCorrections.push(corrections);
      }
      profiler.endStep();
      
      // 6. 批量相似度计算
      profiler.startStep('批量相似度计算', { 
        targetCount: BASE_SIZE, 
        queryCount: QUERY_SIZE,
        batchSize: 1000 
      });
      
      const allResults: Array<{ index: number; score: number }>[] = [];
      
      for (let q = 0; q < QUERY_SIZE; q++) {
        const queryStart = performance.now();
        const quantizedQuery = quantizedQueries[q]!;
        const corrections = queryCorrections[q]!;
        
        // 批量计算分数
        const scores = new Float32Array(BASE_SIZE);
        const batchSize = 1000;
        
        for (let i = 0; i < BASE_SIZE; i += batchSize) {
          const end = Math.min(i + batchSize, BASE_SIZE);
          const batchIndices = Array.from({ length: end - i }, (_, j) => i + j);
          
          const batchStart = performance.now();
          const results = format.getScorer().computeBatchQuantizedScores(
            quantizedQuery,
            corrections,
            quantizedVectors,
            batchIndices,
            1 // 1bit查询
          );
          const batchEnd = performance.now();
          
          profiler.recordPoint('批次计算完成', {
            batchIndex: Math.floor(i / batchSize),
            batchSize: end - i,
            batchTime: batchEnd - batchStart
          });
          
          for (let j = 0; j < results.length; j++) {
            const result = results[j];
            if (result) {
              scores[i + j] = result.score;
            }
          }
        }
        
        // 找到Top-K
        const topKStart = performance.now();
        const topKResults: Array<{ index: number; score: number }> = [];
        const scoreIndices = Array.from({ length: BASE_SIZE }, (_, i) => i);
        scoreIndices.sort((a, b) => scores[b]! - scores[a]!);
        
        for (let i = 0; i < K; i++) {
          topKResults.push({
            index: scoreIndices[i]!,
            score: scores[scoreIndices[i]!]!
          });
        }
        const topKEnd = performance.now();
        
        profiler.recordPoint('Top-K计算完成', {
          queryIndex: q,
          topKTime: topKEnd - topKStart,
          topScore: topKResults[0]?.score
        });
        
        allResults.push(topKResults);
        const queryEnd = performance.now();
        
        profiler.recordPoint('单查询完成', {
          queryIndex: q,
          queryTime: queryEnd - queryStart
        });
      }
      
      profiler.endStep();
      
      // 7. 结果验证
      profiler.startStep('结果验证');
      let totalResults = 0;
      for (const results of allResults) {
        totalResults += results.length;
        expect(results.length).toBe(K);
        // 验证分数降序排列
        for (let i = 1; i < results.length; i++) {
          expect(results[i]!.score).toBeLessThanOrEqual(results[i - 1]!.score);
        }
      }
      profiler.recordPoint('验证完成', { totalResults });
      profiler.endStep();
      
      // 打印性能报告
      profiler.printReport();
      
      // 性能断言
      const analysis = profiler.getAnalysis();
      expect(analysis.totalTime).toBeLessThan(30000); // 30秒内完成
      expect(analysis.bottlenecks.length).toBeGreaterThan(0); // 应该有性能瓶颈
    });

    it('4bit量化查询完整流程性能分析', () => {
      const profiler = new PerformanceProfiler();
      
      // 1. 数据准备阶段
      profiler.startStep('数据生成', { dimension: DIMENSION, baseSize: BASE_SIZE, querySize: QUERY_SIZE });
      const vectors = generateVectors(BASE_SIZE, DIMENSION);
      const queryVectors = generateVectors(QUERY_SIZE, DIMENSION);
      profiler.endStep();
      
      // 2. 量化索引构建阶段
      profiler.startStep('量化索引构建', { queryBits: 4, indexBits: 1 });
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
      profiler.recordPoint('量化构建完成', { 
        buildTime: buildEnd - buildStart,
        vectorsPerSecond: Math.round(BASE_SIZE / ((buildEnd - buildStart) / 1000))
      });
      profiler.endStep();
      
      // 3. 查询执行阶段
      profiler.startStep('查询向量处理', { queryCount: QUERY_SIZE });
      const processedQueries: Float32Array[] = [];
      for (let i = 0; i < QUERY_SIZE; i++) {
        const query = queryVectors[i]!;
        const normalizedQuery = normalizeVector(query);
        processedQueries.push(normalizedQuery);
      }
      profiler.endStep();
      
      // 4. 质心获取
      profiler.startStep('质心获取');
      const centroid = quantizedVectors.getCentroid();
      profiler.recordPoint('质心获取完成', { centroidDimension: centroid.length });
      profiler.endStep();
      
      // 5. 查询向量量化
      profiler.startStep('查询向量量化', { queryBits: 4 });
      const quantizedQueries: Uint8Array[] = [];
      const queryCorrections: any[] = [];
      
      for (let i = 0; i < QUERY_SIZE; i++) {
        const query = processedQueries[i]!;
        const { quantizedQuery, queryCorrections: corrections } = format.quantizeQueryVector(query, centroid);
        quantizedQueries.push(quantizedQuery);
        queryCorrections.push(corrections);
      }
      profiler.endStep();
      
      // 6. 批量相似度计算
      profiler.startStep('批量相似度计算', { 
        targetCount: BASE_SIZE, 
        queryCount: QUERY_SIZE,
        batchSize: 1000 
      });
      
      const allResults: Array<{ index: number; score: number }>[] = [];
      
      for (let q = 0; q < QUERY_SIZE; q++) {
        const queryStart = performance.now();
        const quantizedQuery = quantizedQueries[q]!;
        const corrections = queryCorrections[q]!;
        
        // 批量计算分数
        const scores = new Float32Array(BASE_SIZE);
        const batchSize = 1000;
        
        for (let i = 0; i < BASE_SIZE; i += batchSize) {
          const end = Math.min(i + batchSize, BASE_SIZE);
          const batchIndices = Array.from({ length: end - i }, (_, j) => i + j);
          
          const batchStart = performance.now();
          const results = format.getScorer().computeBatchQuantizedScores(
            quantizedQuery,
            corrections,
            quantizedVectors,
            batchIndices,
            4 // 4bit查询
          );
          const batchEnd = performance.now();
          
          profiler.recordPoint('批次计算完成', {
            batchIndex: Math.floor(i / batchSize),
            batchSize: end - i,
            batchTime: batchEnd - batchStart
          });
          
          for (let j = 0; j < results.length; j++) {
            const result = results[j];
            if (result) {
              scores[i + j] = result.score;
            }
          }
        }
        
        // 找到Top-K
        const topKStart = performance.now();
        const topKResults: Array<{ index: number; score: number }> = [];
        const scoreIndices = Array.from({ length: BASE_SIZE }, (_, i) => i);
        scoreIndices.sort((a, b) => scores[b]! - scores[a]!);
        
        for (let i = 0; i < K; i++) {
          topKResults.push({
            index: scoreIndices[i]!,
            score: scores[scoreIndices[i]!]!
          });
        }
        const topKEnd = performance.now();
        
        profiler.recordPoint('Top-K计算完成', {
          queryIndex: q,
          topKTime: topKEnd - topKStart,
          topScore: topKResults[0]?.score
        });
        
        allResults.push(topKResults);
        const queryEnd = performance.now();
        
        profiler.recordPoint('单查询完成', {
          queryIndex: q,
          queryTime: queryEnd - queryStart
        });
      }
      
      profiler.endStep();
      
      // 7. 结果验证
      profiler.startStep('结果验证');
      let totalResults = 0;
      for (const results of allResults) {
        totalResults += results.length;
        expect(results.length).toBe(K);
        // 验证分数降序排列
        for (let i = 1; i < results.length; i++) {
          expect(results[i]!.score).toBeLessThanOrEqual(results[i - 1]!.score);
        }
      }
      profiler.recordPoint('验证完成', { totalResults });
      profiler.endStep();
      
      // 打印性能报告
      profiler.printReport();
      
      // 性能断言
      const analysis = profiler.getAnalysis();
      expect(analysis.totalTime).toBeLessThan(30000); // 30秒内完成
      expect(analysis.bottlenecks.length).toBeGreaterThan(0); // 应该有性能瓶颈
    });
  });

  describe('1bit vs 4bit性能对比', () => {
    it('1bit和4bit量化查询性能对比', () => {
      const vectors = generateVectors(BASE_SIZE, DIMENSION);
      const queryVectors = generateVectors(QUERY_SIZE, DIMENSION);
      
      // 1bit量化测试
      const profiler1bit = new PerformanceProfiler();
      profiler1bit.startStep('1bit完整流程');
      
      const format1bit = new BinaryQuantizationFormat({
        queryBits: 1,
        indexBits: 1,
        quantizer: {
          similarityFunction: VectorSimilarityFunction.COSINE,
          lambda: 0.01,
          iters: 20
        }
      });
      
      const { quantizedVectors: quantizedVectors1bit } = format1bit.quantizeVectors(vectors);
      
      const queryStart1bit = performance.now();
      for (let i = 0; i < QUERY_SIZE; i++) {
        const query = queryVectors[i]!;
        format1bit.searchNearestNeighbors(query, quantizedVectors1bit, K);
      }
      const queryEnd1bit = performance.now();
      
      profiler1bit.recordPoint('1bit查询完成', { 
        totalTime: queryEnd1bit - queryStart1bit,
        avgTime: (queryEnd1bit - queryStart1bit) / QUERY_SIZE
      });
      profiler1bit.endStep();
      
      // 4bit量化测试
      const profiler4bit = new PerformanceProfiler();
      profiler4bit.startStep('4bit完整流程');
      
      const format4bit = new BinaryQuantizationFormat({
        queryBits: 4,
        indexBits: 1,
        quantizer: {
          similarityFunction: VectorSimilarityFunction.COSINE,
          lambda: 0.01,
          iters: 20
        }
      });
      
      const { quantizedVectors: quantizedVectors4bit } = format4bit.quantizeVectors(vectors);
      
      const queryStart4bit = performance.now();
      for (let i = 0; i < QUERY_SIZE; i++) {
        const query = queryVectors[i]!;
        format4bit.searchNearestNeighbors(query, quantizedVectors4bit, K);
      }
      const queryEnd4bit = performance.now();
      
      profiler4bit.recordPoint('4bit查询完成', { 
        totalTime: queryEnd4bit - queryStart4bit,
        avgTime: (queryEnd4bit - queryStart4bit) / QUERY_SIZE
      });
      profiler4bit.endStep();
      
      // 性能对比
      const time1bit = queryEnd1bit - queryStart1bit;
      const time4bit = queryEnd4bit - queryStart4bit;
      const speedup = time4bit / time1bit;
      
      console.log('\n📊 1bit vs 4bit性能对比:');
      console.log(`1bit查询总时间: ${time1bit.toFixed(2)}ms`);
      console.log(`4bit查询总时间: ${time4bit.toFixed(2)}ms`);
      console.log(`加速比: ${speedup.toFixed(2)}x`);
      console.log(`性能提升: ${((speedup - 1) * 100).toFixed(1)}%`);
      
      // 打印详细报告
      console.log('\n🔍 1bit详细报告:');
      profiler1bit.printReport();
      
      console.log('\n🔍 4bit详细报告:');
      profiler4bit.printReport();
      
      // 性能断言
      expect(speedup).toBeGreaterThan(1.0); // 4bit应该比1bit慢
      expect(time1bit).toBeLessThan(time4bit); // 1bit应该更快
    });
  });
}); 