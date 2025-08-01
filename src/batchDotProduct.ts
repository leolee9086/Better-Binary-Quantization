/**
 * 批量点积计算模块
 * 实现高效的批量点积计算，支持八路循环展开优化
 * 基于Lucene的二值量化实现
 */

import type { QuantizationResult } from './types';
import { VectorSimilarityFunction } from './types';
import { computeInt1BitDotProduct } from './bitwiseDotProduct';
import { FOUR_BIT_SCALE } from './constants';

/**
 * 八路循环展开的批量点积计算（适用于1位量化）
 * 将所有二值化向量连接成一个大缓冲区，使用八路循环展开进行高效计算
 * @param queryVector 查询向量
 * @param concatenatedBuffer 连接的目标向量缓冲区
 * @param numVectors 向量数量
 * @param dimension 向量维度
 * @returns 点积结果数组
 */
export function computeBatchDotProductOptimized(
  queryVector: Uint8Array,
  concatenatedBuffer: Uint8Array,
  numVectors: number,
  dimension: number
): number[] {
  const results: number[] = new Array(numVectors).fill(0);
  const bytesPerVector = queryVector.length;
  const queryLength = queryVector.length;
  const loopCount = Math.floor(queryLength / 8) * 8;
  const remainingStart = loopCount;
  
  for (let vecIndex = 0; vecIndex < numVectors; vecIndex++) {
    let currentDotProduct = 0;
    const vectorOffset = vecIndex * bytesPerVector;
    
    // 主循环：每次处理8个字节
    for (let i = 0; i < loopCount; i += 8) {
      const offset = vectorOffset + i;
      const queryByte0 = queryVector[i]!;
      const dataByte0 = concatenatedBuffer[offset]!;
      const queryByte1 = queryVector[i + 1]!;
      const dataByte1 = concatenatedBuffer[offset + 1]!;
      const queryByte2 = queryVector[i + 2]!;
      const dataByte2 = concatenatedBuffer[offset + 2]!;
      const queryByte3 = queryVector[i + 3]!;
      const dataByte3 = concatenatedBuffer[offset + 3]!;
      const queryByte4 = queryVector[i + 4]!;
      const dataByte4 = concatenatedBuffer[offset + 4]!;
      const queryByte5 = queryVector[i + 5]!;
      const dataByte5 = concatenatedBuffer[offset + 5]!;
      const queryByte6 = queryVector[i + 6]!;
      const dataByte6 = concatenatedBuffer[offset + 6]!;
      const queryByte7 = queryVector[i + 7]!;
      const dataByte7 = concatenatedBuffer[offset + 7]!;
      
      // 并行计算8个字节的直接点积
      currentDotProduct += (
        queryByte0 * dataByte0 +
        queryByte1 * dataByte1 +
        queryByte2 * dataByte2 +
        queryByte3 * dataByte3 +
        queryByte4 * dataByte4 +
        queryByte5 * dataByte5 +
        queryByte6 * dataByte6 +
        queryByte7 * dataByte7
      );
    }
    
    // 处理剩余的字节
    for (let i = remainingStart; i < queryLength; i++) {
      const queryByte = queryVector[i]!;
      const dataByte = concatenatedBuffer[vectorOffset + i]!;
      currentDotProduct += queryByte * dataByte;
    }
    
    results[vecIndex] = currentDotProduct;
  }
  
  return results;
}

/**
 * 八路循环展开的4位量化批量点积计算
 * 4位量化查询向量与1位量化索引向量的批量点积计算
 * @param queryVector 4位量化查询向量
 * @param concatenatedBuffer 连接的目标向量缓冲区
 * @param numVectors 向量数量
 * @param dimension 向量维度
 * @returns 点积结果数组
 */
export function computeBatchFourBitDotProductOptimized(
  queryVector: Uint8Array,
  concatenatedBuffer: Uint8Array,
  numVectors: number,
  dimension: number
): number[] {
  const results: number[] = new Array(numVectors).fill(0);
  const bytesPerVector = queryVector.length;
  const queryLength = queryVector.length;
  const loopCount = Math.floor(queryLength / 8) * 8;
  const remainingStart = loopCount;
  
  for (let vecIndex = 0; vecIndex < numVectors; vecIndex++) {
    let currentDotProduct = 0;
    const vectorOffset = vecIndex * bytesPerVector;
    
    // 主循环：每次处理8个字节
    for (let i = 0; i < loopCount; i += 8) {
      const offset = vectorOffset + i;
      const queryByte0 = queryVector[i]!;
      const dataByte0 = concatenatedBuffer[offset]!;
      const queryByte1 = queryVector[i + 1]!;
      const dataByte1 = concatenatedBuffer[offset + 1]!;
      const queryByte2 = queryVector[i + 2]!;
      const dataByte2 = concatenatedBuffer[offset + 2]!;
      const queryByte3 = queryVector[i + 3]!;
      const dataByte3 = concatenatedBuffer[offset + 3]!;
      const queryByte4 = queryVector[i + 4]!;
      const dataByte4 = concatenatedBuffer[offset + 4]!;
      const queryByte5 = queryVector[i + 5]!;
      const dataByte5 = concatenatedBuffer[offset + 5]!;
      const queryByte6 = queryVector[i + 6]!;
      const dataByte6 = concatenatedBuffer[offset + 6]!;
      const queryByte7 = queryVector[i + 7]!;
      const dataByte7 = concatenatedBuffer[offset + 7]!;
      
      // 并行计算8个字节的直接点积
      currentDotProduct += (
        queryByte0 * dataByte0 +
        queryByte1 * dataByte1 +
        queryByte2 * dataByte2 +
        queryByte3 * dataByte3 +
        queryByte4 * dataByte4 +
        queryByte5 * dataByte5 +
        queryByte6 * dataByte6 +
        queryByte7 * dataByte7
      );
    }
    
    // 处理剩余的字节
    for (let i = remainingStart; i < queryLength; i++) {
      const queryByte = queryVector[i]!;
      const dataByte = concatenatedBuffer[vectorOffset + i]!;
      currentDotProduct += queryByte * dataByte;
    }
    
    results[vecIndex] = currentDotProduct;
  }
  
  return results;
}

/**
 * 真正的原始算法：逐个调用computeInt1BitDotProduct
 * @param queryVector 查询向量
 * @param targetVectors 目标向量集合
 * @param targetOrds 目标向量序号数组
 * @returns 点积结果数组
 */
export function computeBatchDotProductTrueOriginal(
  queryVector: Uint8Array,
  targetVectors: { getUnpackedVector: (ord: number) => Uint8Array },
  targetOrds: number[]
): number[] {
  const results: number[] = new Array(targetOrds.length).fill(0);
  
  for (let i = 0; i < targetOrds.length; i++) {
    const unpackedBinaryCode = targetVectors.getUnpackedVector(targetOrds[i]!);
    results[i] = computeInt1BitDotProduct(queryVector, unpackedBinaryCode);
  }
  
  return results;
}

/**
 * 批量点积计算的原始方法（直接点积计算）
 * @param queryVector 查询向量
 * @param concatenatedBuffer 连接的目标向量缓冲区
 * @param numVectors 向量数量
 * @param dimension 向量维度
 * @returns 点积结果数组
 */
export function computeBatchDotProductOriginal(
  queryVector: Uint8Array,
  concatenatedBuffer: Uint8Array,
  numVectors: number,
  dimension: number
): number[] {
  const results: number[] = new Array(numVectors).fill(0);
  const bytesPerVector = queryVector.length;
  const queryLength = queryVector.length;
  
  for (let vecIndex = 0; vecIndex < numVectors; vecIndex++) {
    let currentDotProduct = 0;
    const vectorOffset = vecIndex * bytesPerVector;
    
    for (let i = 0; i < queryLength; i++) {
      const queryByte = queryVector[i]!;
      const dataByte = concatenatedBuffer[vectorOffset + i]!;
      
      // 直接点积计算
      currentDotProduct += queryByte * dataByte;
    }
    
    results[vecIndex] = currentDotProduct;
  }
  
  return results;
}

/**
 * 创建连接的目标向量缓冲区
 * 将所有目标向量连接成一个大的连续缓冲区，用于批量计算
 * @param targetVectors 目标向量集合
 * @param targetOrds 目标向量序号数组
 * @returns 连接的目标向量缓冲区
 */
export function createConcatenatedBuffer(
  targetVectors: { getUnpackedVector: (ord: number) => Uint8Array },
  targetOrds: number[]
): Uint8Array {
  if (targetOrds.length === 0) {
    return new Uint8Array(0);
  }
  
  // 获取第一个向量的长度作为基准
  const firstVector = targetVectors.getUnpackedVector(targetOrds[0]!);
  const vectorLength = firstVector.length;
  const totalLength = vectorLength * targetOrds.length;
  
  // 创建连接缓冲区
  const concatenatedBuffer = new Uint8Array(totalLength);
  
  // 连接所有向量
  for (let i = 0; i < targetOrds.length; i++) {
    const vector = targetVectors.getUnpackedVector(targetOrds[i]!);
    const offset = i * vectorLength;
    concatenatedBuffer.set(vector, offset);
  }
  
  return concatenatedBuffer;
}

/**
 * 批量计算1位量化相似性分数
 * @param qcDists 批量点积结果
 * @param queryCorrections 查询向量修正因子
 * @param targetVectors 目标向量集合
 * @param targetOrds 目标向量序号数组
 * @param dimension 向量维度
 * @param centroidDP 质心点积
 * @param similarityFunction 相似性函数
 * @returns 相似性分数数组
 */
export function computeBatchOneBitSimilarityScores(
  qcDists: number[],
  queryCorrections: QuantizationResult,
  targetVectors: { getCorrectiveTerms: (ord: number) => QuantizationResult },
  targetOrds: number[],
  dimension: number,
  centroidDP: number,
  similarityFunction: VectorSimilarityFunction
): number[] {
  const scores: number[] = [];
  
  for (let i = 0; i < targetOrds.length; i++) {
    const qcDist = qcDists[i]!;
    const indexCorrections = targetVectors.getCorrectiveTerms(targetOrds[i]!);
    
    // 按照Lucene二值量化原始实现计算分数
    const x1 = indexCorrections.quantizedComponentSum;
    const ax = indexCorrections.lowerInterval;
    const lx = indexCorrections.upperInterval - ax;
    const ay = queryCorrections.lowerInterval;
    const ly = queryCorrections.upperInterval - ay;
    const y1 = queryCorrections.quantizedComponentSum;

    // 计算基础分数
    let score = ax * ay * dimension +
      ay * lx * x1 +
      ax * ly * y1 +
      lx * ly * qcDist;

    // 根据相似性函数调整分数
    switch (similarityFunction) {
      case VectorSimilarityFunction.EUCLIDEAN:
        score = queryCorrections.additionalCorrection +
          indexCorrections.additionalCorrection -
          2 * score;
        scores.push(Math.max(1 / (1 + score), 0));
        break;

      case VectorSimilarityFunction.COSINE:
        score += queryCorrections.additionalCorrection +
          indexCorrections.additionalCorrection -
          centroidDP;
        scores.push(Math.max((1 + score) / 2, 0));
        break;

      case VectorSimilarityFunction.MAXIMUM_INNER_PRODUCT:
        score += queryCorrections.additionalCorrection +
          indexCorrections.additionalCorrection -
          centroidDP;
        // 1位量化：不使用FOUR_BIT_SCALE
        if (score < 0) {
          scores.push(1 / (1 - score));
        } else {
          scores.push(score + 1);
        }
        break;

      default:
        throw new Error(`不支持的相似性函数: ${similarityFunction}`);
    }
  }
  
  return scores;
}

/**
 * 批量计算4位量化相似性分数
 * @param qcDists 批量点积结果
 * @param queryCorrections 查询向量修正因子
 * @param targetVectors 目标向量集合
 * @param targetOrds 目标向量序号数组
 * @param dimension 向量维度
 * @param centroidDP 质心点积
 * @param similarityFunction 相似性函数
 * @returns 相似性分数数组
 */
export function computeBatchFourBitSimilarityScores(
  qcDists: number[],
  queryCorrections: QuantizationResult,
  targetVectors: { getCorrectiveTerms: (ord: number) => QuantizationResult },
  targetOrds: number[],
  dimension: number,
  centroidDP: number,
  similarityFunction: VectorSimilarityFunction
): number[] {
  const scores: number[] = [];
  
  for (let i = 0; i < targetOrds.length; i++) {
    const qcDist = qcDists[i]!;
    const indexCorrections = targetVectors.getCorrectiveTerms(targetOrds[i]!);
    
    // 按照Lucene二值量化原始实现计算分数
    const x1 = indexCorrections.quantizedComponentSum;
    const ax = indexCorrections.lowerInterval;
    const lx = indexCorrections.upperInterval - ax;
    const ay = queryCorrections.lowerInterval;
    const ly = (queryCorrections.upperInterval - ay) * FOUR_BIT_SCALE; // 4位量化使用FOUR_BIT_SCALE
    const y1 = queryCorrections.quantizedComponentSum;

    // 计算基础分数
    let score = ax * ay * dimension +
      ay * lx * x1 +
      ax * ly * y1 +
      lx * ly * qcDist;

    // 根据相似性函数调整分数
    switch (similarityFunction) {
      case VectorSimilarityFunction.EUCLIDEAN:
        const euclideanScore = queryCorrections.additionalCorrection +
          indexCorrections.additionalCorrection -
          2 * score;
        scores.push(Math.max(1 / (1 + euclideanScore), 0));
        break;

      case VectorSimilarityFunction.COSINE:
      case VectorSimilarityFunction.MAXIMUM_INNER_PRODUCT:
        const adjustedScore = score + queryCorrections.additionalCorrection +
          indexCorrections.additionalCorrection -
          centroidDP;

        if (similarityFunction === VectorSimilarityFunction.MAXIMUM_INNER_PRODUCT) {
          // 使用scaleMaxInnerProductScore函数
          if (adjustedScore < 0) {
            scores.push(1 / (1 - adjustedScore / FOUR_BIT_SCALE));
          } else {
            scores.push(adjustedScore / FOUR_BIT_SCALE + 1);
          }
        } else {
          // COSINE
          scores.push(Math.max((1 + adjustedScore) / 2, 0));
        }
        break;

      default:
        throw new Error(`不支持的相似性函数: ${similarityFunction}`);
    }
  }
  
  return scores;
} 