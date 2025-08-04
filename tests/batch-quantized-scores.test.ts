import { describe, it, expect, beforeAll } from 'vitest';
import { BinaryQuantizedScorer } from '../src/binaryQuantizedScorer';
import { BinaryQuantizationFormat } from '../src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '../src/types';
import type { QuantizedScoreResult } from '../src/types';
import { createRandomVector } from '../src/vectorUtils';
import {
  computeBatchDotProductOptimized,
  createConcatenatedBuffer,
  computeBatchOneBitSimilarityScores,
  computeBatchFourBitSimilarityScores,
  computeBatchDotProductTrueOriginal,
  createDirectPackedBufferFourBit,
  computeBatchFourBitDotProductDirectPacked
} from '../src/batchDotProduct';

describe('Batch Quantized Scores Test', () => {
  const DIMENSION = 1024;
  const NUM_VECTORS = 5000; // 增加数据规模
  let format: BinaryQuantizationFormat;
  let scorer: BinaryQuantizedScorer;
  let queryVector: Float32Array;
  let targetVectors: Float32Array[];

  beforeAll(() => {
    // 创建1位量化的格式
    format = new BinaryQuantizationFormat({
      queryBits: 1,
      indexBits: 1,
      quantizer: {
        similarityFunction: VectorSimilarityFunction.COSINE
      }
    });

    // 创建评分器
    scorer = format.getScorer();

    // 生成查询向量
    queryVector = createRandomVector(DIMENSION);

    // 生成目标向量
    targetVectors = [];
    for (let i = 0; i < NUM_VECTORS; i++) {
      targetVectors.push(createRandomVector(DIMENSION));
    }
  });

  it('should compute batch quantized scores correctly', () => {
    // 构建量化索引
    const { quantizedVectors } = format.quantizeVectors(targetVectors);

    // 量化查询向量
    const centroid = quantizedVectors.getCentroid();
    const { quantizedQuery, queryCorrections } = format.quantizeQueryVector(queryVector, centroid);

    // 生成目标向量序号数组
    const targetOrds = Array.from({ length: NUM_VECTORS }, (_, i) => i);

    // 预创建连接缓冲区（一次性操作，不计入算法时间）
    const concatenatedBuffer = createConcatenatedBuffer(quantizedVectors, targetOrds);

    // 测试批量计算（只计算核心算法时间）
    const startTime = performance.now();
    const qcDists = computeBatchDotProductOptimized(
      quantizedQuery,
      concatenatedBuffer,
      targetOrds.length,
      quantizedVectors.dimension()
    );
    
    // 批量计算相似性分数
    const scores = computeBatchOneBitSimilarityScores(
      qcDists,
      queryCorrections,
      quantizedVectors,
      targetOrds,
      quantizedVectors.dimension(),
      quantizedVectors.getCentroidDP(), // 1位量化不需要传递原始查询向量
      scorer.getSimilarityFunction()
    );
    
    // 构建结果数组
    const batchResults: QuantizedScoreResult[] = [];
    for (let i = 0; i < targetOrds.length; i++) {
      const indexCorrections = quantizedVectors.getCorrectiveTerms(targetOrds[i]!);
      batchResults.push({
        score: scores[i]!,
        bitDotProduct: qcDists[i]!,
        corrections: {
          query: queryCorrections,
          index: indexCorrections
        }
      });
    }
    const endTime = performance.now();
    const batchTime = endTime - startTime;

    // 测试真正的原始算法（逐个调用computeInt1BitDotProduct）
    const startTimeTrueOriginal = performance.now();
    const trueOriginalDotProducts = computeBatchDotProductTrueOriginal(
      quantizedQuery,
      quantizedVectors,
      targetOrds
    );
    const endTimeTrueOriginal = performance.now();
    const trueOriginalTime = endTimeTrueOriginal - startTimeTrueOriginal;

    // 测试单个计算（用于对比）
    const startTimeSingle = performance.now();
    const singleResults = [];
    for (const targetOrd of targetOrds) {
      const result = scorer.computeQuantizedScore(
        quantizedQuery,
        queryCorrections,
        quantizedVectors,
        targetOrd,
        1
      );
      singleResults.push(result);
    }
    const endTimeSingle = performance.now();
    const singleTime = endTimeSingle - startTimeSingle;

    console.log(`\n=== 批量量化评分性能测试 ===`);
    console.log(`八路循环展开批量计算时间: ${batchTime.toFixed(3)}ms`);
    console.log(`真正原始算法时间: ${trueOriginalTime.toFixed(3)}ms`);
    console.log(`单个计算时间: ${singleTime.toFixed(3)}ms`);
    console.log(`八路循环展开 vs 真正原始算法: ${((trueOriginalTime / batchTime)).toFixed(2)}x`);
    console.log(`八路循环展开 vs 单个计算: ${((singleTime / batchTime)).toFixed(2)}x`);

    // 验证结果一致性
    let consistencyCount = 0;
    const checkCount = Math.min(100, NUM_VECTORS);
    for (let i = 0; i < checkCount; i++) {
      if (Math.abs(batchResults[i]!.score - singleResults[i]!.score) < 1e-10) {
        consistencyCount++;
      }
    }
    console.log(`结果一致性检查: ${consistencyCount}/${checkCount} 个结果完全一致`);

    // 验证结果数量
    expect(batchResults.length).toBe(NUM_VECTORS);
    expect(singleResults.length).toBe(NUM_VECTORS);

    // 验证结果一致性
    expect(consistencyCount).toBe(checkCount);
    
    // 验证点积计算的一致性
    let dotProductConsistencyCount = 0;
    for (let i = 0; i < checkCount; i++) {
      if (qcDists[i] === trueOriginalDotProducts[i]) {
        dotProductConsistencyCount++;
      }
    }
    console.log(`点积计算一致性检查: ${dotProductConsistencyCount}/${checkCount} 个结果完全一致`);

    // 对于小规模数据，批量计算可能因为开销而不如单个计算
    // 但在大规模数据中，批量计算应该更有优势
    console.log(`\n📊 性能分析:`);
    console.log(`  数据规模: ${NUM_VECTORS} 个向量`);
    console.log(`  八路循环展开开销: ${(batchTime / NUM_VECTORS).toFixed(6)}ms/向量`);
    console.log(`  真正原始算法开销: ${(trueOriginalTime / NUM_VECTORS).toFixed(6)}ms/向量`);
    console.log(`  单个计算开销: ${(singleTime / NUM_VECTORS).toFixed(6)}ms/向量`);
    
    // 验证结果结构

    // 验证结果结构
    for (const result of batchResults) {
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('bitDotProduct');
      expect(result).toHaveProperty('corrections');
      expect(result.corrections).toHaveProperty('query');
      expect(result.corrections).toHaveProperty('index');
      expect(typeof result.score).toBe('number');
      expect(typeof result.bitDotProduct).toBe('number');
    }
  });

  it('should handle empty target ords array', () => {
    // 量化查询向量
    const { quantizedVectors } = format.quantizeVectors(targetVectors);
    const centroid = quantizedVectors.getCentroid();
    const { quantizedQuery, queryCorrections } = format.quantizeQueryVector(queryVector, centroid);

    // 测试空数组
    const emptyResults = scorer.computeBatchQuantizedScores(
      quantizedQuery,
      queryCorrections,
      quantizedVectors,
      [],
      1
    );

    expect(emptyResults).toEqual([]);
  });

  it('should compute batch quantized scores for 4-bit quantization', () => {
    // 创建4位量化的格式
    const format4bit = new BinaryQuantizationFormat({
      queryBits: 4,
      indexBits: 1,
      quantizer: {
        similarityFunction: VectorSimilarityFunction.COSINE
      }
    });

    const scorer4bit = format4bit.getScorer();

    // 构建量化索引
    const { quantizedVectors: quantizedVectors4bit } = format4bit.quantizeVectors(targetVectors);

    // 量化查询向量
    const centroid = quantizedVectors4bit.getCentroid();
    const { quantizedQuery, queryCorrections } = format4bit.quantizeQueryVector(queryVector, centroid);

    // 生成目标向量序号数组
    const targetOrds = Array.from({ length: 100 }, (_, i) => i);

    // 预创建连接缓冲区（一次性操作，不计入算法时间）
    const concatenatedBuffer = createDirectPackedBufferFourBit(quantizedVectors4bit, targetOrds,quantizedQuery.length);

    // 测试4位量化的批量计算
    const startTime = performance.now();
    const qcDists = computeBatchFourBitDotProductDirectPacked(
      quantizedQuery,
      concatenatedBuffer,
      targetOrds.length,
      quantizedVectors4bit.dimension()
    );
    
         // 批量计算相似性分数
     const scores = computeBatchFourBitSimilarityScores(
       qcDists,
       queryCorrections,
       quantizedVectors4bit,
       targetOrds,
       quantizedVectors4bit.dimension(),
       quantizedVectors4bit.getCentroidDP(queryVector), // 传递原始查询向量
       scorer4bit.getSimilarityFunction()
     );
    
    // 构建结果数组
    const batchResults: QuantizedScoreResult[] = [];
    for (let i = 0; i < targetOrds.length; i++) {
      const indexCorrections = quantizedVectors4bit.getCorrectiveTerms(targetOrds[i]!);
      batchResults.push({
        score: scores[i]!,
        bitDotProduct: qcDists[i]!,
        corrections: {
          query: queryCorrections,
          index: indexCorrections
        }
      });
    }
    const endTime = performance.now();
    const batchTime = endTime - startTime;

         // 测试单个计算（用于对比）
     const startTimeSingle = performance.now();
     const singleResults = [];
     for (const targetOrd of targetOrds) {
       const result = scorer4bit.computeQuantizedScore(
         quantizedQuery,
         queryCorrections,
         quantizedVectors4bit,
         targetOrd,
         4,
         queryVector // 传递原始查询向量
       );
       singleResults.push(result);
     }
    const endTimeSingle = performance.now();
    const singleTime = endTimeSingle - startTimeSingle;

    console.log(`\n=== 4位量化批量评分性能测试 ===`);
    console.log(`批量计算时间: ${batchTime.toFixed(3)}ms`);
    console.log(`单个计算时间: ${singleTime.toFixed(3)}ms`);
    console.log(`性能提升: ${((singleTime / batchTime)).toFixed(2)}x`);

    // 验证结果一致性
    let consistencyCount = 0;
    const checkCount = Math.min(50, targetOrds.length);
    for (let i = 0; i < checkCount; i++) {
      if (Math.abs(batchResults[i]!.score - singleResults[i]!.score) < 1e-10) {
        consistencyCount++;
      }
    }
    console.log(`结果一致性检查: ${consistencyCount}/${checkCount} 个结果完全一致`);

    // 验证结果
    expect(batchResults.length).toBe(100);
    expect(singleResults.length).toBe(100);
    expect(consistencyCount).toBe(checkCount);
    
    for (const result of batchResults) {
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('bitDotProduct');
      expect(result).toHaveProperty('corrections');
      expect(result.corrections).toHaveProperty('query');
      expect(result.corrections).toHaveProperty('index');
      expect(typeof result.score).toBe('number');
      expect(typeof result.bitDotProduct).toBe('number');
    }
  });
}); 