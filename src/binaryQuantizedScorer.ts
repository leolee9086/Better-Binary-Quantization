/**
 * 二值量化评分器
 * 实现量化向量的相似性计算
 * 基于Lucene的二值量化实现
 */

import { VectorSimilarityFunction } from './types';
import type {
  QuantizationResult,
  BinarizedByteVectorValues,
  QuantizedScoreResult
} from './types';
import { FOUR_BIT_SCALE } from './constants';
import {
  computeInt1BitDotProduct,
  computeInt4BitDotProduct
} from './bitwiseDotProduct';
import { computeSimilarity } from './vectorSimilarity';
import {
  computeBatchDotProductOptimized,
  computeBatchFourBitDotProductOptimized,
  createConcatenatedBuffer,
  computeBatchOneBitSimilarityScores,
  computeBatchFourBitSimilarityScores
} from './batchDotProduct';


/**
 * 缩放最大内积分数
 * 将最大内积分数缩放到合理范围，与Lucene保持一致
 * @param score 原始分数
 * @returns 缩放后的分数
 */
function scaleMaxInnerProductScore(score: number): number {
  if (score < 0) {
    return 1 / (1 - score);
  }
  return score + 1;
}

/**
 * 二值量化评分器类
 * 实现量化向量的相似性计算和评分
 */
export class BinaryQuantizedScorer {
  private readonly similarityFunction: VectorSimilarityFunction;

  /**
   * 构造函数
   * @param similarityFunction 相似性函数
   */
  constructor(similarityFunction: VectorSimilarityFunction) {
    this.similarityFunction = similarityFunction;
  }



  /**
   * 计算量化相似性分数
   * @param quantizedQuery 量化的查询向量
   * @param queryCorrections 查询向量修正因子
   * @param targetVectors 目标向量集合
   * @param targetOrd 目标向量序号
   * @param queryBits 查询向量位数（1或4）
   * @param originalQueryVector 原始查询向量（可选）
   * @returns 量化评分结果
   */
  public computeQuantizedScore(
    quantizedQuery: Uint8Array,
    queryCorrections: QuantizationResult,
    targetVectors: BinarizedByteVectorValues,
    targetOrd: number,
    queryBits: number,
    originalQueryVector?: Float32Array
  ): QuantizedScoreResult {
    // 2. 根据查询位数选择正确的处理方法
    if (queryBits === 1) {
      // 单比特量化：使用单比特相似性计算
      return this.computeOneBitQuantizedScore(
        quantizedQuery,
        queryCorrections,
        targetVectors,
        targetOrd
      );
    } else if (queryBits === 4) {
      // 4位查询 + 1位索引：使用4位-1位相似性计算
      return this.computeFourBitQuantizedScore(
        quantizedQuery,
        queryCorrections,
        targetVectors,
        targetOrd,
        originalQueryVector
      );
    } else {
      throw new Error(`不支持的查询位数: ${queryBits}，只支持1位和4位`);
    }
  }

  /**
   * 计算1位量化相似性分数
   * 按照Lucene二值量化原始实现，不使用FOUR_BIT_SCALE
   * @param qcDist 位运算点积
   * @param queryCorrections 查询向量修正因子
   * @param indexCorrections 索引向量修正因子
   * @param dimension 向量维度
   * @param centroidDP 质心点积
   * @returns 相似性分数
   */
  private computeOneBitSimilarityScore(
    qcDist: number,
    queryCorrections: QuantizationResult,
    indexCorrections: QuantizationResult,
    dimension: number,
    centroidDP: number
  ): number {

    // 按照Lucene二值量化原始实现计算分数
    // 参考 Lucene102BinaryFlatVectorsScorer.quantizedScore 方法
    const x1 = indexCorrections.quantizedComponentSum;
    const ax = indexCorrections.lowerInterval;
    const lx = indexCorrections.upperInterval - ax;
    const ay = queryCorrections.lowerInterval;

    // 1位量化：查询向量是1bit的，所以不需要使用FOUR_BIT_SCALE
    const ly = queryCorrections.upperInterval - ay;
    const y1 = queryCorrections.quantizedComponentSum;

    // 计算基础分数
    let score = ax * ay * dimension +
      ay * lx * x1 +
      ax * ly * y1 +
      lx * ly * qcDist;

    // 根据相似性函数调整分数
    switch (this.similarityFunction) {
      case VectorSimilarityFunction.EUCLIDEAN:
        score = queryCorrections.additionalCorrection +
          indexCorrections.additionalCorrection -
          2 * score;
        return Math.max(1 / (1 + score), 0);

      case VectorSimilarityFunction.COSINE:
        // 严格按照Java原版实现：不使用FOUR_BIT_SCALE
        score += queryCorrections.additionalCorrection +
          indexCorrections.additionalCorrection -
          centroidDP;
        const finalScore = Math.max((1 + score) / 2, 0);
        return finalScore;

      case VectorSimilarityFunction.MAXIMUM_INNER_PRODUCT:
        score += queryCorrections.additionalCorrection +
          indexCorrections.additionalCorrection -
          centroidDP;
        // 1位量化：不使用FOUR_BIT_SCALE
        return scaleMaxInnerProductScore(score);

      default:
        throw new Error(`不支持的相似性函数: ${this.similarityFunction}`);
    }
  }

  /**
   * 计算4位查询+1位索引相似性分数
   * 按照Lucene二值量化原始实现，使用FOUR_BIT_SCALE
   * @param qcDist 位运算点积
   * @param queryCorrections 查询向量修正因子
   * @param indexCorrections 索引向量修正因子
   * @param dimension 向量维度
   * @param centroidDP 质心点积
   * @returns 相似性分数
   */
  private computeFourBitSimilarityScore(
    qcDist: number,
    queryCorrections: QuantizationResult,
    indexCorrections: QuantizationResult,
    dimension: number,
    centroidDP: number
  ): number {
    // 4位查询的相似性分数计算
    // 严格按照Java原版实现四项公式

    const x1 = indexCorrections.quantizedComponentSum;
    const ax = indexCorrections.lowerInterval;
    const lx = indexCorrections.upperInterval - ax;
    const ay = queryCorrections.lowerInterval;
    const ly = (queryCorrections.upperInterval - ay) * FOUR_BIT_SCALE;
    const y1 = queryCorrections.quantizedComponentSum;

    // 四项公式：score = ax * ay * dimension + ay * lx * x1 + ax * ly * y1 + lx * ly * qcDist
    const score = ax * ay * dimension + ay * lx * x1 + ax * ly * y1 + lx * ly * qcDist;

    switch (this.similarityFunction) {
      case VectorSimilarityFunction.EUCLIDEAN:
        const euclideanScore = queryCorrections.additionalCorrection +
          indexCorrections.additionalCorrection -
          2 * score;
        return Math.max(1 / (1 + euclideanScore), 0);

      case VectorSimilarityFunction.COSINE:
      case VectorSimilarityFunction.MAXIMUM_INNER_PRODUCT:
        const adjustedScore = score + queryCorrections.additionalCorrection +
          indexCorrections.additionalCorrection -
          centroidDP;


        if (this.similarityFunction === VectorSimilarityFunction.MAXIMUM_INNER_PRODUCT) {
          return scaleMaxInnerProductScore(adjustedScore);
        }

        const finalScore = Math.max((1 + adjustedScore) / 2, 0);
        return finalScore;

      default:
        throw new Error(`不支持的相似性函数: ${this.similarityFunction}`);
    }
  }

  /**
   * 计算1位量化相似性分数
   * @param quantizedQuery 1位量化的查询向量
   * @param queryCorrections 查询向量修正因子
   * @param targetVectors 目标向量集合
   * @param targetOrd 目标向量序号
   * @returns 量化评分结果
   */
  private computeOneBitQuantizedScore(
    quantizedQuery: Uint8Array,
    queryCorrections: QuantizationResult,
    targetVectors: BinarizedByteVectorValues,
    targetOrd: number
  ): QuantizedScoreResult {
    // 2. 1位-1位点积计算（使用未打包的索引向量）
    // 修复：使用未打包的1bit索引向量与未打包的1bit查询向量进行点积
    const unpackedBinaryCode = targetVectors.getUnpackedVector(targetOrd);
    const qcDist = computeInt1BitDotProduct(quantizedQuery, unpackedBinaryCode);

    // 3. 获取目标向量的修正因子
    const indexCorrections = targetVectors.getCorrectiveTerms(targetOrd);

    // 4. 计算1位量化相似性分数
    const score = this.computeOneBitSimilarityScore(
      qcDist,
      queryCorrections,
      indexCorrections,
      targetVectors.dimension(),
      targetVectors.getCentroidDP()
    );

    return {
      score,
      bitDotProduct: qcDist,
      corrections: {
        query: queryCorrections,
        index: indexCorrections
      }
    };
  }

  /**
   * 计算4位查询+1位索引相似性分数
   * @param quantizedQuery 4位量化的查询向量（转置后的格式）
   * @param queryCorrections 查询向量修正因子
   * @param targetVectors 目标向量集合
   * @param targetOrd 目标向量序号
   * @returns 量化评分结果
   */
  private computeFourBitQuantizedScore(
    quantizedQuery: Uint8Array,
    queryCorrections: QuantizationResult,
    targetVectors: BinarizedByteVectorValues,
    targetOrd: number,
    originalQueryVector?: Float32Array
  ): QuantizedScoreResult {
    // 2. 4位-1位点积计算（使用未打包的索引向量）
    const unpackedBinaryCode = targetVectors.getUnpackedVector(targetOrd);

    // 计算点积
    const qcDist = computeInt4BitDotProduct(quantizedQuery, unpackedBinaryCode);

    // 3. 获取目标向量的修正因子
    const indexCorrections = targetVectors.getCorrectiveTerms(targetOrd);

    // 4. 计算4位查询+1位索引相似性分数
    const score = this.computeFourBitSimilarityScore(
      qcDist,
      queryCorrections,
      indexCorrections,
      targetVectors.dimension(),
      originalQueryVector ? targetVectors.getCentroidDP(originalQueryVector) : 0
    );

    return {
      score,
      bitDotProduct: qcDist,
      corrections: {
        query: queryCorrections,
        index: indexCorrections
      }
    };
  }



  /**
   * 批量计算量化相似性分数
   * 使用八路循环展开的批量点积算法，显著提升性能
   * @param quantizedQuery 量化的查询向量
   * @param queryCorrections 查询向量修正因子
   * @param targetVectors 目标向量集合
   * @param targetOrds 目标向量序号数组
   * @param queryBits 查询向量位数（1或4）
   * @returns 量化评分结果数组
   */
  public computeBatchQuantizedScores(
    quantizedQuery: Uint8Array,
    queryCorrections: QuantizationResult,
    targetVectors: BinarizedByteVectorValues,
    targetOrds: number[],
    queryBits: number,
    originalQueryVector?: Float32Array
  ): QuantizedScoreResult[] {



    // 批量计算（1位和4位量化）
    try {
      // 1. 创建连接的目标向量缓冲区
      const concatenatedBuffer = createConcatenatedBuffer(targetVectors, targetOrds);

      // 2. 使用八路循环展开进行批量点积计算
      let qcDists: number[];
      qcDists = computeBatchDotProductOptimized(
        quantizedQuery,
        concatenatedBuffer,
        targetOrds.length,
        targetVectors.dimension()
      );


      // 3. 批量计算相似性分数
      let scores: number[];
      if (queryBits === 1) {
        scores = computeBatchOneBitSimilarityScores(
          qcDists,
          queryCorrections,
          targetVectors,
          targetOrds,
          targetVectors.dimension(),
          targetVectors.getCentroidDP(),
          this.similarityFunction
        );
      } else {
        // 4位量化：需要传递原始查询向量给getCentroidDP
        scores = computeBatchFourBitSimilarityScores(
          qcDists,
          queryCorrections,
          targetVectors,
          targetOrds,
          targetVectors.dimension(),
          targetVectors.getCentroidDP(originalQueryVector),
          this.similarityFunction
        );
      }

      // 4. 构建结果数组
      const results: QuantizedScoreResult[] = [];
      for (let i = 0; i < targetOrds.length; i++) {
        const indexCorrections = targetVectors.getCorrectiveTerms(targetOrds[i]!);
        results.push({
          score: scores[i]!,
          bitDotProduct: qcDists[i]!,
          corrections: {
            query: queryCorrections,
            index: indexCorrections
          }
        });
      }

      return results;
    } catch (error) {
      // 如果批量计算失败，回退到原始方法
      console.warn('批量计算失败，回退到原始方法:', error);
      const results: QuantizedScoreResult[] = [];
      for (const targetOrd of targetOrds) {
        const result = this.computeQuantizedScore(
          quantizedQuery,
          queryCorrections,
          targetVectors,
          targetOrd,
          queryBits,
          originalQueryVector
        );
        results.push(result);
      }
      return results;
    }
  }

  /**
   * 计算原始向量和量化向量的相似性分数
   * @param originalQuery 原始查询向量
   * @param targetVector 目标向量
   * @param similarityFunction 相似性函数
   * @returns 原始相似性分数
   */
  public computeOriginalScore(
    originalQuery: Float32Array,
    targetVector: Float32Array,
    similarityFunction: VectorSimilarityFunction
  ): number {
    switch (similarityFunction) {
      case VectorSimilarityFunction.EUCLIDEAN:
        return computeSimilarity(originalQuery, targetVector, 'EUCLIDEAN');

      case VectorSimilarityFunction.COSINE:
        return computeSimilarity(originalQuery, targetVector, 'COSINE');

      case VectorSimilarityFunction.MAXIMUM_INNER_PRODUCT:
        return computeSimilarity(originalQuery, targetVector, 'MAXIMUM_INNER_PRODUCT');

      default:
        throw new Error(`不支持的相似性函数: ${similarityFunction}`);
    }
  }

  /**
   * 比较原始分数和量化分数
   * @param originalScore 原始分数
   * @param quantizedScore 量化分数
   * @returns 比较结果
   */
  public compareScores(originalScore: number, quantizedScore: number): {
    difference: number;
    relativeError: number;
    correlation: number;
  } {
    const difference = Math.abs(originalScore - quantizedScore);

    // 处理零值情况
    let relativeError: number;
    if (originalScore === 0) {
      relativeError = quantizedScore === 0 ? 0 : Infinity;
    } else {
      relativeError = difference / Math.abs(originalScore);
    }

    // 改进的相关性计算
    const correlation = this.computeCorrelation(originalScore, quantizedScore);

    return {
      difference,
      relativeError,
      correlation
    };
  }

  /**
   * 计算相关性
   * @param a 值a
   * @param b 值b
   * @returns 相关性系数
   */
  private computeCorrelation(a: number, b: number): number {
    // 如果两个值相同，相关性为1
    if (a === b) {
      return 1;
    }

    // 如果其中一个为0，另一个不为0，相关性为0
    if ((a === 0 && b !== 0) || (a !== 0 && b === 0)) {
      return 0;
    }

    // 如果两个都为0，相关性为1
    if (a === 0 && b === 0) {
      return 1;
    }

    // 计算相关系数
    const meanA = a;
    const meanB = b;
    const diffA = a - meanA;
    const diffB = b - meanB;

    const numerator = diffA * diffB;
    const denominator = Math.abs(diffA) * Math.abs(diffB);

    if (denominator === 0) {
      return 0;
    }

    return numerator / denominator;
  }

  /**
   * 计算量化精度
   * @param originalScores 原始分数数组
   * @param quantizedScores 量化分数数组
   * @returns 量化精度统计
   */
  public computeQuantizationAccuracy(
    originalScores: number[],
    quantizedScores: number[]
  ): {
    meanError: number;
    maxError: number;
    minError: number;
    stdError: number;
    correlation: number;
  } {
    if (originalScores.length !== quantizedScores.length) {
      throw new Error('原始分数和量化分数数组长度不匹配');
    }

    const errors: number[] = [];
    let sumError = 0;
    let maxError = 0;
    let minError = Infinity;

    for (let i = 0; i < originalScores.length; i++) {
      const orig = originalScores[i];
      const quant = quantizedScores[i];
      if (orig !== undefined && quant !== undefined) {
        const error = Math.abs(orig - quant);
        errors.push(error);
        sumError += error;
        maxError = Math.max(maxError, error);
        minError = Math.min(minError, error);
      }
    }

    const meanError = sumError / errors.length;
    const stdError = this.computeStandardDeviation(errors, meanError);
    const correlation = this.computePearsonCorrelation(originalScores, quantizedScores);

    return {
      meanError,
      maxError,
      minError,
      stdError,
      correlation
    };
  }

  /**
   * 计算标准差
   * @param values 数值数组
   * @param mean 均值
   * @returns 标准差
   */
  private computeStandardDeviation(values: number[], mean: number): number {
    let sum = 0;
    for (const value of values) {
      const diff = value - mean;
      sum += diff * diff;
    }
    return Math.sqrt(sum / values.length);
  }

  /**
   * 计算皮尔逊相关系数
   * @param x 数组x
   * @param y 数组y
   * @returns 相关系数
   */
  private computePearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length) {
      throw new Error('数组长度不匹配');
    }

    const n = x.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    for (let i = 0; i < n; i++) {
      const xv = x[i];
      const yv = y[i];
      if (xv !== undefined && yv !== undefined) {
        sumX += xv;
        sumY += yv;
        sumXY += xv * yv;
        sumX2 += xv * xv;
        sumY2 += yv * yv;
      }
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) {
      return 0;
    }

    return numerator / denominator;
  }

  /**
   * 获取相似性函数类型
   * @returns 相似性函数类型
   */
  public getSimilarityFunction(): VectorSimilarityFunction {
    return this.similarityFunction;
  }
} 