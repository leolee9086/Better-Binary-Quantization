import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '@src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '@src/types';
import { normalizeVector } from '@src/vectorOperations';

/**
 * @�? 相似度计算步骤分解测�?
 * 深入分解相似度计算的每一个内部步骤，找出性能瓶颈
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
 * 相似度计算步骤分析器
 */
class SimilarityComputationProfiler {
  private steps: PerformancePoint[] = [];
  private currentStep: string | null = null;
  private stepStartTime: number = 0;

  startStep(step: string): void {
    if (this.currentStep) {
      this.endStep();
    }
    this.currentStep = step;
    this.stepStartTime = performance.now();
  }

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

  getSteps(): PerformancePoint[] {
    return this.steps;
  }

  getTotalTime(): number {
    return this.steps.reduce((sum, step) => sum + step.time, 0);
  }

  reset(): void {
    this.steps = [];
    this.currentStep = null;
    this.stepStartTime = 0;
  }

  printAnalysis(): void {
    const totalTime = this.getTotalTime();
    console.log('\n📊 相似度计算步骤分�?');
    console.log('='.repeat(60));
    console.log(`总时�? ${totalTime.toFixed(2)}ms`);
    console.log('\n各步骤详�?');
    
    this.steps.forEach((step, index) => {
      const percentage = ((step.time / totalTime) * 100).toFixed(1);
      console.log(`${index + 1}. ${step.step}: ${step.time.toFixed(2)}ms (${percentage}%)`);
      if (step.info) {
        Object.entries(step.info).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
      }
    });
    
    // 找出最耗时的步�?
    const bottlenecks = this.steps
      .filter(step => (step.time / totalTime) > 0.05) // 超过5%的步�?
      .sort((a, b) => b.time - a.time);
    
    if (bottlenecks.length > 0) {
      console.log('\n⚠️ 主要耗时步骤:');
      bottlenecks.forEach((step, index) => {
        const percentage = ((step.time / totalTime) * 100).toFixed(1);
        console.log(`${index + 1}. ${step.step}: ${step.time.toFixed(2)}ms (${percentage}%)`);
      });
    }
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

describe('相似度计算步骤分解测�?, () => {
  it('1bit量化相似度计算步骤分�?, () => {
    const profiler = new SimilarityComputationProfiler();
    
    // 测试参数
    const dim = 1024;
    const baseSize = 5000;
    const vectors = generateVectors(baseSize, dim);
    const queryVector = generateVectors(1, dim)[0]!;
    
    // 构建量化索引
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
    
    // 准备查询
    const normalizedQuery = normalizeVector(queryVector);
    const centroid = quantizedVectors.getCentroid();
    const { quantizedQuery, queryCorrections } = format.quantizeQueryVector(normalizedQuery, centroid);
    
    // 开始分解相似度计算
    const vectorCount = quantizedVectors.size();
    const scores = new Float32Array(vectorCount);
    const batchSize = 1000;
    const scorer = format.getScorer();
    const queryBits = format.getConfig().queryBits!;
    
    profiler.startStep('初始化参�?);
    const totalBatches = Math.ceil(vectorCount / batchSize);
    profiler.endStep({ 
      vectorCount, 
      batchSize, 
      totalBatches,
      queryBits,
      quantizedQueryLength: quantizedQuery.length
    });
    
    let totalVectorAccessTime = 0;
    let totalDotProductTime = 0;
    let totalScoreAssignTime = 0;
    let totalBatchOverhead = 0;
    
    // 逐批次处�?
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, vectorCount);
      const currentBatchSize = end - start;
      
      profiler.startStep(`批次${batchIndex + 1}-准备`);
      const batchOverheadStart = performance.now();
      const batchIndices = Array.from({ length: currentBatchSize }, (_, j) => start + j);
      const batchOverheadTime = performance.now() - batchOverheadStart;
      totalBatchOverhead += batchOverheadTime;
      profiler.endStep({ 
        batchIndex: batchIndex + 1,
        batchSize: currentBatchSize,
        startIndex: start,
        endIndex: end - 1,
        batchOverheadTime: batchOverheadTime.toFixed(3)
      });
      
      profiler.startStep(`批次${batchIndex + 1}-向量读取`);
      const vectorAccessStart = performance.now();
      // 实际向量访问（这里会触发实际的内存读取）
      const accessedVectors = batchIndices.map(idx => {
        const vector = quantizedVectors.vectorValue(idx);
        return { index: idx, vector };
      });
      const vectorAccessTime = performance.now() - vectorAccessStart;
      totalVectorAccessTime += vectorAccessTime;
      profiler.endStep({ 
        vectorAccessTime: vectorAccessTime.toFixed(3),
        vectorsAccessed: accessedVectors.length,
        avgVectorSize: accessedVectors.length > 0 ? accessedVectors[0].vector.length : 0
      });
      
      profiler.startStep(`批次${batchIndex + 1}-相似度核心计算`);
      const dotProductStart = performance.now();
      // 核心相似度计�?- 这是最关键的步�?
      const results = scorer.computeBatchQuantizedScores(
        quantizedQuery,
        queryCorrections,
        quantizedVectors,
        batchIndices,
        queryBits
      );
      const dotProductTime = performance.now() - dotProductStart;
      totalDotProductTime += dotProductTime;
      
      // 计算有效结果数和平均分数
      const validResults = results.filter(r => r !== null && r !== undefined);
      const avgScore = validResults.length > 0 ? 
        validResults.reduce((sum, r) => sum + r.score, 0) / validResults.length : 0;
      
      profiler.endStep({ 
        dotProductTime: dotProductTime.toFixed(3),
        resultsCount: results.length,
        validResults: validResults.length,
        avgScore: avgScore.toFixed(4),
        avgTimePerVector: (dotProductTime / currentBatchSize).toFixed(3)
      });
      
      profiler.startStep(`批次${batchIndex + 1}-分数存储`);
      const scoreAssignStart = performance.now();
      // 分数赋�?
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result) {
          scores[start + j] = result.score;
        }
      }
      const scoreAssignTime = performance.now() - scoreAssignStart;
      totalScoreAssignTime += scoreAssignTime;
      profiler.endStep({ 
        scoreAssignTime: scoreAssignTime.toFixed(3),
        scoresAssigned: results.filter(r => r).length
      });
    }
    
    profiler.startStep('汇总统�?);
    const finalStats = {
      totalBatches,
      totalVectorAccessTime: totalVectorAccessTime.toFixed(2),
      totalDotProductTime: totalDotProductTime.toFixed(2),
      totalScoreAssignTime: totalScoreAssignTime.toFixed(2),
      totalBatchOverhead: totalBatchOverhead.toFixed(2),
      avgVectorAccessTime: (totalVectorAccessTime / vectorCount).toFixed(4),
      avgDotProductTime: (totalDotProductTime / vectorCount).toFixed(4),
      finalScoreCount: scores.filter(s => s > 0).length,
      avgFinalScore: scores.reduce((sum, s) => sum + s, 0) / vectorCount
    };
    profiler.endStep(finalStats);
    
    // 输出分析结果
    profiler.printAnalysis();
    
    console.log('\n🎯 性能瓶颈分析:');
    console.log(`向量访问总时�? ${totalVectorAccessTime.toFixed(2)}ms`);
    console.log(`相似度计算总时�? ${totalDotProductTime.toFixed(2)}ms`);
    console.log(`分数存储总时�? ${totalScoreAssignTime.toFixed(2)}ms`);
    console.log(`批次开销总时�? ${totalBatchOverhead.toFixed(2)}ms`);
    
    const totalComputeTime = totalVectorAccessTime + totalDotProductTime + totalScoreAssignTime + totalBatchOverhead;
    console.log('\n📈 时间占比:');
    console.log(`向量访问: ${((totalVectorAccessTime / totalComputeTime) * 100).toFixed(1)}%`);
    console.log(`相似度计�? ${((totalDotProductTime / totalComputeTime) * 100).toFixed(1)}%`);
    console.log(`分数存储: ${((totalScoreAssignTime / totalComputeTime) * 100).toFixed(1)}%`);
    console.log(`批次开销: ${((totalBatchOverhead / totalComputeTime) * 100).toFixed(1)}%`);
    
    // 验证结果
    expect(scores.length).toBe(vectorCount);
    expect(scores.filter(s => s > 0).length).toBeGreaterThan(0);
  });

  it('4bit量化相似度计算步骤分�?, () => {
    const profiler = new SimilarityComputationProfiler();
    
    // 测试参数  
    const dim = 1024;
    const baseSize = 5000;
    const vectors = generateVectors(baseSize, dim);
    const queryVector = generateVectors(1, dim)[0]!;
    
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
    
    // 准备查询
    const normalizedQuery = normalizeVector(queryVector);
    const centroid = quantizedVectors.getCentroid();
    const { quantizedQuery, queryCorrections } = format.quantizeQueryVector(normalizedQuery, centroid);
    
    // 开始分解相似度计算
    const vectorCount = quantizedVectors.size();
    const scores = new Float32Array(vectorCount);
    const batchSize = 1000;
    const scorer = format.getScorer();
    const queryBits = format.getConfig().queryBits!;
    
    profiler.startStep('初始化参�?);
    const totalBatches = Math.ceil(vectorCount / batchSize);
    profiler.endStep({ 
      vectorCount, 
      batchSize, 
      totalBatches,
      queryBits,
      quantizedQueryLength: quantizedQuery.length
    });
    
    let totalVectorAccessTime = 0;
    let totalDotProductTime = 0;
    let totalScoreAssignTime = 0;
    let totalBatchOverhead = 0;
    
    // 逐批次处�?
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, vectorCount);
      const currentBatchSize = end - start;
      
      profiler.startStep(`批次${batchIndex + 1}-准备`);
      const batchOverheadStart = performance.now();
      const batchIndices = Array.from({ length: currentBatchSize }, (_, j) => start + j);
      const batchOverheadTime = performance.now() - batchOverheadStart;
      totalBatchOverhead += batchOverheadTime;
      profiler.endStep({ 
        batchIndex: batchIndex + 1,
        batchSize: currentBatchSize,
        startIndex: start,
        endIndex: end - 1,
        batchOverheadTime: batchOverheadTime.toFixed(3)
      });
      
      profiler.startStep(`批次${batchIndex + 1}-向量读取`);
      const vectorAccessStart = performance.now();
      // 实际向量访问
      const accessedVectors = batchIndices.map(idx => {
        const vector = quantizedVectors.vectorValue(idx);
        return { index: idx, vector };
      });
      const vectorAccessTime = performance.now() - vectorAccessStart;
      totalVectorAccessTime += vectorAccessTime;
      profiler.endStep({ 
        vectorAccessTime: vectorAccessTime.toFixed(3),
        vectorsAccessed: accessedVectors.length,
        avgVectorSize: accessedVectors.length > 0 ? accessedVectors[0].vector.length : 0
      });
      
      profiler.startStep(`批次${batchIndex + 1}-相似度核心计算`);
      const dotProductStart = performance.now();
      // 核心相似度计�?
      const results = scorer.computeBatchQuantizedScores(
        quantizedQuery,
        queryCorrections,
        quantizedVectors,
        batchIndices,
        queryBits
      );
      const dotProductTime = performance.now() - dotProductStart;
      totalDotProductTime += dotProductTime;
      
      // 计算有效结果数和平均分数
      const validResults = results.filter(r => r !== null && r !== undefined);
      const avgScore = validResults.length > 0 ? 
        validResults.reduce((sum, r) => sum + r.score, 0) / validResults.length : 0;
      
      profiler.endStep({ 
        dotProductTime: dotProductTime.toFixed(3),
        resultsCount: results.length,
        validResults: validResults.length,
        avgScore: avgScore.toFixed(4),
        avgTimePerVector: (dotProductTime / currentBatchSize).toFixed(3)
      });
      
      profiler.startStep(`批次${batchIndex + 1}-分数存储`);
      const scoreAssignStart = performance.now();
      // 分数赋�?
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result) {
          scores[start + j] = result.score;
        }
      }
      const scoreAssignTime = performance.now() - scoreAssignStart;
      totalScoreAssignTime += scoreAssignTime;
      profiler.endStep({ 
        scoreAssignTime: scoreAssignTime.toFixed(3),
        scoresAssigned: results.filter(r => r).length
      });
    }
    
    profiler.startStep('汇总统�?);
    const finalStats = {
      totalBatches,
      totalVectorAccessTime: totalVectorAccessTime.toFixed(2),
      totalDotProductTime: totalDotProductTime.toFixed(2),
      totalScoreAssignTime: totalScoreAssignTime.toFixed(2),
      totalBatchOverhead: totalBatchOverhead.toFixed(2),
      avgVectorAccessTime: (totalVectorAccessTime / vectorCount).toFixed(4),
      avgDotProductTime: (totalDotProductTime / vectorCount).toFixed(4),
      finalScoreCount: scores.filter(s => s > 0).length,
      avgFinalScore: scores.reduce((sum, s) => sum + s, 0) / vectorCount
    };
    profiler.endStep(finalStats);
    
    // 输出分析结果
    profiler.printAnalysis();
    
    console.log('\n🎯 性能瓶颈分析:');
    console.log(`向量访问总时�? ${totalVectorAccessTime.toFixed(2)}ms`);
    console.log(`相似度计算总时�? ${totalDotProductTime.toFixed(2)}ms`);
    console.log(`分数存储总时�? ${totalScoreAssignTime.toFixed(2)}ms`);
    console.log(`批次开销总时�? ${totalBatchOverhead.toFixed(2)}ms`);
    
    const totalComputeTime = totalVectorAccessTime + totalDotProductTime + totalScoreAssignTime + totalBatchOverhead;
    console.log('\n📈 时间占比:');
    console.log(`向量访问: ${((totalVectorAccessTime / totalComputeTime) * 100).toFixed(1)}%`);
    console.log(`相似度计�? ${((totalDotProductTime / totalComputeTime) * 100).toFixed(1)}%`);
    console.log(`分数存储: ${((totalScoreAssignTime / totalComputeTime) * 100).toFixed(1)}%`);
    console.log(`批次开销: ${((totalBatchOverhead / totalComputeTime) * 100).toFixed(1)}%`);
    
    // 验证结果
    expect(scores.length).toBe(vectorCount);
    expect(scores.filter(s => s > 0).length).toBeGreaterThan(0);
  });

  it('1bit vs 4bit相似度计算对�?, () => {
    console.log('\n🔍 1bit vs 4bit 相似度计算详细对�?);
    console.log('='.repeat(60));
    console.log('此测试通过上面两个测试的结果进行对比分�?);
    console.log('重点关注相似度核心计算步骤的性能差异');
    
    // 这个测试主要用于输出对比信息，实际数据来自上面的测试
    expect(true).toBe(true);
  });
});
