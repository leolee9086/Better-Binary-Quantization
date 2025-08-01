import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '@src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '@src/types';
import { normalizeVector } from '@src/vectorOperations';

/**
 * @�? 单步查询过程性能测试
 * 模拟单步查询过程，去掉索引构建时间，专注于查询本身的性能分析
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
  /** 结束时间�?*/
  endTime: number;
  /** 额外信息 */
  info?: Record<string, any>;
}

/**
 * 性能分析结果接口
 */
interface PerformanceAnalysis {
  /** 总执行时�?*/
  totalTime: number;
  /** 各步骤性能记录 */
  steps: PerformancePoint[];
  /** 步骤时间占比 */
  timeDistribution: Record<string, number>;
  /** 性能瓶颈分析 */
  bottlenecks: string[];
}

/**
 * 性能分析器类
 */
class QueryPerformanceProfiler {
  private steps: PerformancePoint[] = [];
  private currentStep: string | null = null;
  private stepStartTime: number = 0;

  /**
   * 开始记录一个步�?
   */
  startStep(step: string): void {
    if (this.currentStep) {
      this.endStep();
    }
    this.currentStep = step;
    this.stepStartTime = performance.now();
  }

  /**
   * 结束当前步骤
   */
  endStep(info?: Record<string, any>): void {
    if (!this.currentStep) return;
    
    const endTime = performance.now();
    const time = endTime - this.stepStartTime;
    
    this.steps.push({
      step: this.currentStep,
      time,
      startTime: this.stepStartTime,
      endTime,
      info
    });
    
    this.currentStep = null;
  }

  /**
   * 获取性能分析结果
   */
  getAnalysis(): PerformanceAnalysis {
    const totalTime = this.steps.reduce((sum, step) => sum + step.time, 0);
    
    const timeDistribution: Record<string, number> = {};
    this.steps.forEach(step => {
      timeDistribution[step.step] = (step.time / totalTime) * 100;
    });
    
    const bottlenecks = this.steps
      .filter(step => (step.time / totalTime) > 0.1) // 超过10%的步�?
      .sort((a, b) => b.time - a.time)
      .map(step => step.step);
    
    return {
      totalTime,
      steps: this.steps,
      timeDistribution,
      bottlenecks
    };
  }

  /**
   * 重置分析�?
   */
  reset(): void {
    this.steps = [];
    this.currentStep = null;
    this.stepStartTime = 0;
  }
}

/**
 * 生成测试向量
 */
function generateVectors(count: number, dimension: number): Float32Array[] {
  const vectors: Float32Array[] = [];
  for (let i = 0; i < count; i++) {
    const vector = new Float32Array(dimension);
    for (let j = 0; j < dimension; j++) {
      vector[j] = (Math.random() - 0.5) * 2; // [-1, 1]
    }
    vectors.push(vector);
  }
  return vectors;
}

describe('单步查询过程性能测试', () => {
  it('1bit量化单步查询性能分析', () => {
    const profiler = new QueryPerformanceProfiler();
    
    // 测试参数
    const dim = 1024;
    const baseSize = 5000;
    const K = 10;
    
    profiler.startStep('数据生成');
    const vectors = generateVectors(baseSize, dim);
    const queryVector = generateVectors(1, dim)[0]!;
    profiler.endStep({ vectorCount: baseSize, dimension: dim });
    
    // 预构建量化索引（不计入查询时间）
    profiler.startStep('预构建量化索�?);
    const format = new BinaryQuantizationFormat({
      queryBits: 1,
      indexBits: 1,
      quantizer: {
        similarityFunction: VectorSimilarityFunction.COSINE,
        lambda: 0.01,
        iters: 20
      }
    });
    const { quantizedVectors } = format.quantizeVectors(vectors);
    profiler.endStep();
    
    // 开始单步查询性能分析
    profiler.startStep('查询向量标准�?);
    const normalizedQuery = normalizeVector(queryVector);
    profiler.endStep();
    
    profiler.startStep('获取质心');
    const centroid = quantizedVectors.getCentroid();
    profiler.endStep({ centroidDimension: centroid.length });
    
    profiler.startStep('查询向量量化');
    const { quantizedQuery, queryCorrections } = format.quantizeQueryVector(normalizedQuery, centroid);
    profiler.endStep({ 
      quantizedQueryLength: quantizedQuery.length,
      queryCorrectionsLength: queryCorrections.length 
    });
    
    profiler.startStep('批量相似度计�?);
    const vectorCount = quantizedVectors.size();
    const scores = new Float32Array(vectorCount);
    const batchSize = 1000;
    
    for (let i = 0; i < vectorCount; i += batchSize) {
      const end = Math.min(i + batchSize, vectorCount);
      const batchIndices = Array.from({ length: end - i }, (_, j) => i + j);
      
      const results = format.getScorer().computeBatchQuantizedScores(
        quantizedQuery,
        queryCorrections,
        quantizedVectors,
        batchIndices,
        format.getConfig().queryBits!
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result) {
          scores[i + j] = result.score;
        }
      }
    }
    profiler.endStep({ 
      scoreCount: scores.length,
      averageScore: scores.reduce((sum, s) => sum + s, 0) / scores.length 
    });
    
    profiler.startStep('Top-K计算');
    // 创建分数和索引的配对数组
    const scoreIndexPairs = Array.from({ length: vectorCount }, (_, i) => ({
      score: scores[i],
      index: i
    }));
    
    // 按分数降序排序并取前K�?
    scoreIndexPairs.sort((a, b) => b.score - a.score);
    const topK = scoreIndexPairs.slice(0, K);
    profiler.endStep({ 
      topKCount: topK.length,
      topScore: topK[0]?.score,
      bottomScore: topK[topK.length - 1]?.score 
    });
    
    // 获取性能分析结果
    const analysis = profiler.getAnalysis();
    
    // 输出详细结果
    console.log('\n🔍 1bit量化单步查询性能分析');
    console.log('='.repeat(50));
    console.log(`总执行时�? ${analysis.totalTime.toFixed(2)}ms`);
    console.log('\n📊 各步骤时间分�?');
    analysis.steps.forEach(step => {
      const percentage = ((step.time / analysis.totalTime) * 100).toFixed(1);
      console.log(`  ${step.step}: ${step.time.toFixed(2)}ms (${percentage}%)`);
      if (step.info) {
        Object.entries(step.info).forEach(([key, value]) => {
          console.log(`    ${key}: ${value}`);
        });
      }
    });
    
    console.log('\n⚠️ 性能瓶颈 (占用时间>10%):');
    analysis.bottlenecks.forEach(bottleneck => {
      const step = analysis.steps.find(s => s.step === bottleneck);
      const percentage = ((step!.time / analysis.totalTime) * 100).toFixed(1);
      console.log(`  ${bottleneck}: ${step!.time.toFixed(2)}ms (${percentage}%)`);
    });
    
    console.log('\n📈 查询结果:');
    console.log(`  找到 ${topK.length} 个最相似向量`);
    console.log(`  最高分�? ${topK[0]?.score.toFixed(4)}`);
    console.log(`  最低分�? ${topK[topK.length - 1]?.score.toFixed(4)}`);
    
    // 验证结果
    expect(topK.length).toBe(K);
    expect(topK[0]?.score).toBeGreaterThan(topK[topK.length - 1]?.score || 0);
  });

  it('4bit量化单步查询性能分析', () => {
    const profiler = new QueryPerformanceProfiler();
    
    // 测试参数
    const dim = 1024;
    const baseSize = 5000;
    const K = 10;
    
    profiler.startStep('数据生成');
    const vectors = generateVectors(baseSize, dim);
    const queryVector = generateVectors(1, dim)[0]!;
    profiler.endStep({ vectorCount: baseSize, dimension: dim });
    
    // 预构建量化索引（不计入查询时间）
    profiler.startStep('预构建量化索�?);
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
    profiler.endStep();
    
    // 开始单步查询性能分析
    profiler.startStep('查询向量标准�?);
    const normalizedQuery = normalizeVector(queryVector);
    profiler.endStep();
    
    profiler.startStep('获取质心');
    const centroid = quantizedVectors.getCentroid();
    profiler.endStep({ centroidDimension: centroid.length });
    
    profiler.startStep('查询向量量化');
    const { quantizedQuery, queryCorrections } = format.quantizeQueryVector(normalizedQuery, centroid);
    profiler.endStep({ 
      quantizedQueryLength: quantizedQuery.length,
      queryCorrectionsLength: queryCorrections.length 
    });
    
    profiler.startStep('批量相似度计�?);
    const vectorCount = quantizedVectors.size();
    const scores = new Float32Array(vectorCount);
    const batchSize = 1000;
    
    for (let i = 0; i < vectorCount; i += batchSize) {
      const end = Math.min(i + batchSize, vectorCount);
      const batchIndices = Array.from({ length: end - i }, (_, j) => i + j);
      
      const results = format.getScorer().computeBatchQuantizedScores(
        quantizedQuery,
        queryCorrections,
        quantizedVectors,
        batchIndices,
        format.getConfig().queryBits!
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result) {
          scores[i + j] = result.score;
        }
      }
    }
    profiler.endStep({ 
      scoreCount: scores.length,
      averageScore: scores.reduce((sum, s) => sum + s, 0) / scores.length 
    });
    
    profiler.startStep('Top-K计算');
    // 创建分数和索引的配对数组
    const scoreIndexPairs = Array.from({ length: vectorCount }, (_, i) => ({
      score: scores[i],
      index: i
    }));
    
    // 按分数降序排序并取前K�?
    scoreIndexPairs.sort((a, b) => b.score - a.score);
    const topK = scoreIndexPairs.slice(0, K);
    profiler.endStep({ 
      topKCount: topK.length,
      topScore: topK[0]?.score,
      bottomScore: topK[topK.length - 1]?.score 
    });
    
    // 获取性能分析结果
    const analysis = profiler.getAnalysis();
    
    // 输出详细结果
    console.log('\n🔍 4bit量化单步查询性能分析');
    console.log('='.repeat(50));
    console.log(`总执行时�? ${analysis.totalTime.toFixed(2)}ms`);
    console.log('\n📊 各步骤时间分�?');
    analysis.steps.forEach(step => {
      const percentage = ((step.time / analysis.totalTime) * 100).toFixed(1);
      console.log(`  ${step.step}: ${step.time.toFixed(2)}ms (${percentage}%)`);
      if (step.info) {
        Object.entries(step.info).forEach(([key, value]) => {
          console.log(`    ${key}: ${value}`);
        });
      }
    });
    
    console.log('\n⚠️ 性能瓶颈 (占用时间>10%):');
    analysis.bottlenecks.forEach(bottleneck => {
      const step = analysis.steps.find(s => s.step === bottleneck);
      const percentage = ((step!.time / analysis.totalTime) * 100).toFixed(1);
      console.log(`  ${bottleneck}: ${step!.time.toFixed(2)}ms (${percentage}%)`);
    });
    
    console.log('\n📈 查询结果:');
    console.log(`  找到 ${topK.length} 个最相似向量`);
    console.log(`  最高分�? ${topK[0]?.score.toFixed(4)}`);
    console.log(`  最低分�? ${topK[topK.length - 1]?.score.toFixed(4)}`);
    
    // 验证结果
    expect(topK.length).toBe(K);
    expect(topK[0]?.score).toBeGreaterThan(topK[topK.length - 1]?.score || 0);
  });

  it('1bit vs 4bit单步查询性能对比', () => {
    // 测试参数
    const dim = 1024;
    const baseSize = 5000;
    const K = 10;
    
    // 生成测试数据
    const vectors = generateVectors(baseSize, dim);
    const queryVector = generateVectors(1, dim)[0]!;
    
    // 1bit量化测试
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
    
    const start1bit = performance.now();
    const normalizedQuery = normalizeVector(queryVector);
    const centroid = quantizedVectors1bit.getCentroid();
    const { quantizedQuery: quantizedQuery1bit, queryCorrections: queryCorrections1bit } = 
      format1bit.quantizeQueryVector(normalizedQuery, centroid);
    
    const vectorCount = quantizedVectors1bit.size();
    const scores1bit = new Float32Array(vectorCount);
    const batchSize = 1000;
    
    for (let i = 0; i < vectorCount; i += batchSize) {
      const end = Math.min(i + batchSize, vectorCount);
      const batchIndices = Array.from({ length: end - i }, (_, j) => i + j);
      
      const results = format1bit.getScorer().computeBatchQuantizedScores(
        quantizedQuery1bit,
        queryCorrections1bit,
        quantizedVectors1bit,
        batchIndices,
        format1bit.getConfig().queryBits!
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result) {
          scores1bit[i + j] = result.score;
        }
      }
    }
    
    const scoreIndexPairs1bit = Array.from({ length: vectorCount }, (_, i) => ({
      score: scores1bit[i],
      index: i
    }));
    scoreIndexPairs1bit.sort((a, b) => b.score - a.score);
    const topK1bit = scoreIndexPairs1bit.slice(0, K);
    const time1bit = performance.now() - start1bit;
    
    // 4bit量化测试
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
    
    const start4bit = performance.now();
    const { quantizedQuery: quantizedQuery4bit, queryCorrections: queryCorrections4bit } = 
      format4bit.quantizeQueryVector(normalizedQuery, centroid);
    
    const scores4bit = new Float32Array(vectorCount);
    
    for (let i = 0; i < vectorCount; i += batchSize) {
      const end = Math.min(i + batchSize, vectorCount);
      const batchIndices = Array.from({ length: end - i }, (_, j) => i + j);
      
      const results = format4bit.getScorer().computeBatchQuantizedScores(
        quantizedQuery4bit,
        queryCorrections4bit,
        quantizedVectors4bit,
        batchIndices,
        format4bit.getConfig().queryBits!
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result) {
          scores4bit[i + j] = result.score;
        }
      }
    }
    
    const scoreIndexPairs4bit = Array.from({ length: vectorCount }, (_, i) => ({
      score: scores4bit[i],
      index: i
    }));
    scoreIndexPairs4bit.sort((a, b) => b.score - a.score);
    const topK4bit = scoreIndexPairs4bit.slice(0, K);
    const time4bit = performance.now() - start4bit;
    
    // 输出对比结果
    console.log('\n🔍 1bit vs 4bit单步查询性能对比');
    console.log('='.repeat(50));
    console.log(`1bit查询时间: ${time1bit.toFixed(2)}ms`);
    console.log(`4bit查询时间: ${time4bit.toFixed(2)}ms`);
    console.log(`加速比: ${(time4bit / time1bit).toFixed(2)}x`);
    console.log(`性能提升: ${(((time4bit - time1bit) / time4bit) * 100).toFixed(1)}%`);
    
    console.log('\n📊 分数对比:');
    console.log(`1bit最高分�? ${topK1bit[0]?.score.toFixed(4)}`);
    console.log(`4bit最高分�? ${topK4bit[0]?.score.toFixed(4)}`);
    console.log(`1bit最低分�? ${topK1bit[topK1bit.length - 1]?.score.toFixed(4)}`);
    console.log(`4bit最低分�? ${topK4bit[topK4bit.length - 1]?.score.toFixed(4)}`);
    
    // 验证结果
    expect(time1bit).toBeLessThan(time4bit);
    expect(topK1bit.length).toBe(K);
    expect(topK4bit.length).toBe(K);
  });
});
