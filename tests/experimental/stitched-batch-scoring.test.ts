import { describe, it, expect } from 'vitest';
import {
  computeBatchDotProductOptimized,
  computeBatchDotProductOriginal,
  createConcatenatedBuffer
} from '../../src/batchDotProduct';

/**
 * 预计算的4位二进制向量点积查表（极致优化版本）
 * 使用Uint8Array确保最小内存占用和最快访问
 */
const ULTIMATE_4BIT_LOOKUP_TABLE = new Uint8Array([
  // 0b0000 行 (0)
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  // 0b0001 行 (1)
  0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1,
  // 0b0010 行 (2)
  0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1,
  // 0b0011 行 (3)
  0, 1, 1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 0, 1, 1, 2,
  // 0b0100 行 (4)
  0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1,
  // 0b0101 行 (5)
  0, 1, 0, 1, 1, 2, 1, 2, 0, 1, 0, 1, 1, 2, 1, 2,
  // 0b0110 行 (6)
  0, 0, 1, 1, 1, 1, 2, 2, 0, 0, 1, 1, 1, 1, 2, 2,
  // 0b0111 行 (7)
  0, 1, 1, 2, 1, 2, 2, 3, 0, 1, 1, 2, 1, 2, 2, 3,
  // 0b1000 行 (8)
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1,
  // 0b1001 行 (9)
  0, 1, 0, 1, 0, 1, 0, 1, 1, 2, 1, 2, 1, 2, 1, 2,
  // 0b1010 行 (10)
  0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 2, 2, 1, 1, 2, 2,
  // 0b1011 行 (11)
  0, 1, 1, 2, 0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3,
  // 0b1100 行 (12)
  0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2,
  // 0b1101 行 (13)
  0, 1, 0, 1, 1, 2, 1, 2, 1, 2, 1, 2, 2, 3, 2, 3,
  // 0b1110 行 (14)
  0, 0, 1, 1, 1, 1, 2, 2, 1, 1, 2, 2, 2, 2, 3, 3,
  // 0b1111 行 (15)
  0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4
]);

/**
 * 预计算查询向量的4位量化权重
 * 预计算 (value & 0x0F) * weight 的结果
 */
function precomputeQueryVectorWeights(queryVector: Uint8Array): Uint8Array {
  const weights = new Uint8Array(queryVector.length * 4); // 每个值 * 4个权重(8,4,2,1)
  
  for (let i = 0; i < queryVector.length; i++) {
    const quantized = queryVector[i]! & 0x0F; // 只取低4位
    weights[i * 4 + 0] = quantized * 8;  // weight = 8
    weights[i * 4 + 1] = quantized * 4;  // weight = 4
    weights[i * 4 + 2] = quantized * 2;  // weight = 2
    weights[i * 4 + 3] = quantized * 1;  // weight = 1
  }
  
  return weights;
}

/**
 * 4位量化优化的批量点积计算
 * 专门针对4位量化进行优化，只考虑4位以下的值
 */
function compute4BitQuantizedBatchDotProduct(
  queryVector: Uint8Array,
  concatenatedBuffer: ArrayBuffer,
  numVectors: number,
  dimension: number,
  threshold: number = 512
): number[] {
  const results: number[] = new Array(numVectors).fill(0);
  const dataView = new DataView(concatenatedBuffer);

  for (let vecIndex = 0; vecIndex < numVectors; vecIndex++) {
    let currentDotProduct = 0;
    const vectorOffset = vecIndex * dimension;

    if (dimension < threshold) {
      // Small dimension: use direct calculation
      const mainLoopEnd = dimension - (dimension % 8);
      for (let i = 0; i < mainLoopEnd; i += 8) {
        currentDotProduct += queryVector[i]! * dataView.getUint8(vectorOffset + i);
        currentDotProduct += queryVector[i + 1]! * dataView.getUint8(vectorOffset + i + 1);
        currentDotProduct += queryVector[i + 2]! * dataView.getUint8(vectorOffset + i + 2);
        currentDotProduct += queryVector[i + 3]! * dataView.getUint8(vectorOffset + i + 3);
        currentDotProduct += queryVector[i + 4]! * dataView.getUint8(vectorOffset + i + 4);
        currentDotProduct += queryVector[i + 5]! * dataView.getUint8(vectorOffset + i + 5);
        currentDotProduct += queryVector[i + 6]! * dataView.getUint8(vectorOffset + i + 6);
        currentDotProduct += queryVector[i + 7]! * dataView.getUint8(vectorOffset + i + 7);
      }
      for (let i = mainLoopEnd; i < dimension; i++) {
        currentDotProduct += queryVector[i]! * dataView.getUint8(vectorOffset + i);
      }
    } else {
      // Large dimension: use 4-bit quantized lookup table
      const mainLoopEnd = dimension - (dimension % 32); // 8组 * 4位 = 32位
      for (let i = 0; i < mainLoopEnd; i += 32) {
        // 4位量化：只取低4位，忽略高4位
        const q0 = ((queryVector[i] ?? 0) & 0x0F) * 8 + ((queryVector[i + 1] ?? 0) & 0x0F) * 4 + ((queryVector[i + 2] ?? 0) & 0x0F) * 2 + ((queryVector[i + 3] ?? 0) & 0x0F);
        const t0 = (dataView.getUint8(vectorOffset + i) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 1) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 2) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 3) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q0 * 16 + t0]!;
        
        const q1 = ((queryVector[i + 4] ?? 0) & 0x0F) * 8 + ((queryVector[i + 5] ?? 0) & 0x0F) * 4 + ((queryVector[i + 6] ?? 0) & 0x0F) * 2 + ((queryVector[i + 7] ?? 0) & 0x0F);
        const t1 = (dataView.getUint8(vectorOffset + i + 4) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 5) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 6) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 7) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q1 * 16 + t1]!;
        
        const q2 = ((queryVector[i + 8] ?? 0) & 0x0F) * 8 + ((queryVector[i + 9] ?? 0) & 0x0F) * 4 + ((queryVector[i + 10] ?? 0) & 0x0F) * 2 + ((queryVector[i + 11] ?? 0) & 0x0F);
        const t2 = (dataView.getUint8(vectorOffset + i + 8) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 9) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 10) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 11) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q2 * 16 + t2]!;
        
        const q3 = ((queryVector[i + 12] ?? 0) & 0x0F) * 8 + ((queryVector[i + 13] ?? 0) & 0x0F) * 4 + ((queryVector[i + 14] ?? 0) & 0x0F) * 2 + ((queryVector[i + 15] ?? 0) & 0x0F);
        const t3 = (dataView.getUint8(vectorOffset + i + 12) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 13) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 14) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 15) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q3 * 16 + t3]!;
        
        const q4 = ((queryVector[i + 16] ?? 0) & 0x0F) * 8 + ((queryVector[i + 17] ?? 0) & 0x0F) * 4 + ((queryVector[i + 18] ?? 0) & 0x0F) * 2 + ((queryVector[i + 19] ?? 0) & 0x0F);
        const t4 = (dataView.getUint8(vectorOffset + i + 16) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 17) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 18) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 19) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q4 * 16 + t4]!;
        
        const q5 = ((queryVector[i + 20] ?? 0) & 0x0F) * 8 + ((queryVector[i + 21] ?? 0) & 0x0F) * 4 + ((queryVector[i + 22] ?? 0) & 0x0F) * 2 + ((queryVector[i + 23] ?? 0) & 0x0F);
        const t5 = (dataView.getUint8(vectorOffset + i + 20) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 21) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 22) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 23) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q5 * 16 + t5]!;
        
        const q6 = ((queryVector[i + 24] ?? 0) & 0x0F) * 8 + ((queryVector[i + 25] ?? 0) & 0x0F) * 4 + ((queryVector[i + 26] ?? 0) & 0x0F) * 2 + ((queryVector[i + 27] ?? 0) & 0x0F);
        const t6 = (dataView.getUint8(vectorOffset + i + 24) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 25) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 26) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 27) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q6 * 16 + t6]!;
        
        const q7 = ((queryVector[i + 28] ?? 0) & 0x0F) * 8 + ((queryVector[i + 29] ?? 0) & 0x0F) * 4 + ((queryVector[i + 30] ?? 0) & 0x0F) * 2 + ((queryVector[i + 31] ?? 0) & 0x0F);
        const t7 = (dataView.getUint8(vectorOffset + i + 28) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 29) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 30) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 31) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q7 * 16 + t7]!;
      }
      
      // 处理剩余的元素 - 使用4位查表
      const remainingEnd = dimension - (dimension % 4);
      for (let i = mainLoopEnd; i < remainingEnd; i += 4) {
        const q = ((queryVector[i] ?? 0) & 0x0F) * 8 + ((queryVector[i + 1] ?? 0) & 0x0F) * 4 + ((queryVector[i + 2] ?? 0) & 0x0F) * 2 + ((queryVector[i + 3] ?? 0) & 0x0F);
        const t = (dataView.getUint8(vectorOffset + i) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 1) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 2) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 3) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q * 16 + t]!;
      }
      
      // 处理最后的单个元素
      for (let i = remainingEnd; i < dimension; i++) {
        currentDotProduct += (queryVector[i] ?? 0) * dataView.getUint8(vectorOffset + i);
      }
    }
    results[vecIndex] = currentDotProduct;
  }
  return results;
}

/**
 * 预计算优化的4位量化批量点积计算
 * 使用预计算的查询向量权重，避免运行时的位运算和乘法
 */
function computePrecomputed4BitQuantizedBatchDotProduct(
  queryVector: Uint8Array,
  concatenatedBuffer: ArrayBuffer,
  numVectors: number,
  dimension: number,
  threshold: number = 512
): number[] {
  const results: number[] = new Array(numVectors).fill(0);
  const dataView = new DataView(concatenatedBuffer);
  
  // 预计算查询向量的4位量化权重
  const queryWeights = precomputeQueryVectorWeights(queryVector);

  for (let vecIndex = 0; vecIndex < numVectors; vecIndex++) {
    let currentDotProduct = 0;
    const vectorOffset = vecIndex * dimension;

    if (dimension < threshold) {
      // Small dimension: use direct calculation
      const mainLoopEnd = dimension - (dimension % 8);
      for (let i = 0; i < mainLoopEnd; i += 8) {
        currentDotProduct += queryVector[i]! * dataView.getUint8(vectorOffset + i);
        currentDotProduct += queryVector[i + 1]! * dataView.getUint8(vectorOffset + i + 1);
        currentDotProduct += queryVector[i + 2]! * dataView.getUint8(vectorOffset + i + 2);
        currentDotProduct += queryVector[i + 3]! * dataView.getUint8(vectorOffset + i + 3);
        currentDotProduct += queryVector[i + 4]! * dataView.getUint8(vectorOffset + i + 4);
        currentDotProduct += queryVector[i + 5]! * dataView.getUint8(vectorOffset + i + 5);
        currentDotProduct += queryVector[i + 6]! * dataView.getUint8(vectorOffset + i + 6);
        currentDotProduct += queryVector[i + 7]! * dataView.getUint8(vectorOffset + i + 7);
      }
      for (let i = mainLoopEnd; i < dimension; i++) {
        currentDotProduct += queryVector[i]! * dataView.getUint8(vectorOffset + i);
      }
    } else {
      // Large dimension: use precomputed 4-bit quantized lookup table
      const mainLoopEnd = dimension - (dimension % 32); // 8组 * 4位 = 32位
      for (let i = 0; i < mainLoopEnd; i += 32) {
        // 使用预计算的查询向量权重，避免运行时的位运算和乘法
        const q0 = queryWeights[i * 4 + 0]! + queryWeights[(i + 1) * 4 + 1]! + queryWeights[(i + 2) * 4 + 2]! + queryWeights[(i + 3) * 4 + 3]!;
        const t0 = (dataView.getUint8(vectorOffset + i) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 1) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 2) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 3) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q0 * 16 + t0]!;
        
        const q1 = queryWeights[(i + 4) * 4 + 0]! + queryWeights[(i + 5) * 4 + 1]! + queryWeights[(i + 6) * 4 + 2]! + queryWeights[(i + 7) * 4 + 3]!;
        const t1 = (dataView.getUint8(vectorOffset + i + 4) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 5) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 6) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 7) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q1 * 16 + t1]!;
        
        const q2 = queryWeights[(i + 8) * 4 + 0]! + queryWeights[(i + 9) * 4 + 1]! + queryWeights[(i + 10) * 4 + 2]! + queryWeights[(i + 11) * 4 + 3]!;
        const t2 = (dataView.getUint8(vectorOffset + i + 8) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 9) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 10) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 11) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q2 * 16 + t2]!;
        
        const q3 = queryWeights[(i + 12) * 4 + 0]! + queryWeights[(i + 13) * 4 + 1]! + queryWeights[(i + 14) * 4 + 2]! + queryWeights[(i + 15) * 4 + 3]!;
        const t3 = (dataView.getUint8(vectorOffset + i + 12) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 13) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 14) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 15) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q3 * 16 + t3]!;
        
        const q4 = queryWeights[(i + 16) * 4 + 0]! + queryWeights[(i + 17) * 4 + 1]! + queryWeights[(i + 18) * 4 + 2]! + queryWeights[(i + 19) * 4 + 3]!;
        const t4 = (dataView.getUint8(vectorOffset + i + 16) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 17) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 18) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 19) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q4 * 16 + t4]!;
        
        const q5 = queryWeights[(i + 20) * 4 + 0]! + queryWeights[(i + 21) * 4 + 1]! + queryWeights[(i + 22) * 4 + 2]! + queryWeights[(i + 23) * 4 + 3]!;
        const t5 = (dataView.getUint8(vectorOffset + i + 20) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 21) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 22) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 23) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q5 * 16 + t5]!;
        
        const q6 = queryWeights[(i + 24) * 4 + 0]! + queryWeights[(i + 25) * 4 + 1]! + queryWeights[(i + 26) * 4 + 2]! + queryWeights[(i + 27) * 4 + 3]!;
        const t6 = (dataView.getUint8(vectorOffset + i + 24) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 25) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 26) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 27) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q6 * 16 + t6]!;
        
        const q7 = queryWeights[(i + 28) * 4 + 0]! + queryWeights[(i + 29) * 4 + 1]! + queryWeights[(i + 30) * 4 + 2]! + queryWeights[(i + 31) * 4 + 3]!;
        const t7 = (dataView.getUint8(vectorOffset + i + 28) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 29) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 30) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 31) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q7 * 16 + t7]!;
      }
      
      // 处理剩余的元素 - 使用预计算的4位查表
      const remainingEnd = dimension - (dimension % 4);
      for (let i = mainLoopEnd; i < remainingEnd; i += 4) {
        const q = queryWeights[i * 4 + 0]! + queryWeights[(i + 1) * 4 + 1]! + queryWeights[(i + 2) * 4 + 2]! + queryWeights[(i + 3) * 4 + 3]!;
        const t = (dataView.getUint8(vectorOffset + i) & 0x0F) * 8 + (dataView.getUint8(vectorOffset + i + 1) & 0x0F) * 4 + (dataView.getUint8(vectorOffset + i + 2) & 0x0F) * 2 + (dataView.getUint8(vectorOffset + i + 3) & 0x0F);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q * 16 + t]!;
      }
      
      // 处理最后的单个元素
      for (let i = remainingEnd; i < dimension; i++) {
        currentDotProduct += queryVector[i]! * dataView.getUint8(vectorOffset + i);
      }
    }
    results[vecIndex] = currentDotProduct;
  }
  return results;
}

/**
 * 直接操作内存的缝合版批量点积计算
 * 使用 ArrayBuffer 和 DataView 进行底层内存操作
 */
function computeStitchedBatchDotProductDirectMemory(
  queryVector: Uint8Array,
  concatenatedBuffer: ArrayBuffer,
  numVectors: number,
  dimension: number,
  threshold: number = 512
): number[] {
  const results: number[] = new Array(numVectors).fill(0);
  const dataView = new DataView(concatenatedBuffer);

  for (let vecIndex = 0; vecIndex < numVectors; vecIndex++) {
    let currentDotProduct = 0;
    const vectorOffset = vecIndex * dimension;

    if (dimension < threshold) {
      // Small dimension: use direct calculation with DataView
      const mainLoopEnd = dimension - (dimension % 8);
      for (let i = 0; i < mainLoopEnd; i += 8) {
        currentDotProduct += queryVector[i]! * dataView.getUint8(vectorOffset + i);
        currentDotProduct += queryVector[i + 1]! * dataView.getUint8(vectorOffset + i + 1);
        currentDotProduct += queryVector[i + 2]! * dataView.getUint8(vectorOffset + i + 2);
        currentDotProduct += queryVector[i + 3]! * dataView.getUint8(vectorOffset + i + 3);
        currentDotProduct += queryVector[i + 4]! * dataView.getUint8(vectorOffset + i + 4);
        currentDotProduct += queryVector[i + 5]! * dataView.getUint8(vectorOffset + i + 5);
        currentDotProduct += queryVector[i + 6]! * dataView.getUint8(vectorOffset + i + 6);
        currentDotProduct += queryVector[i + 7]! * dataView.getUint8(vectorOffset + i + 7);
      }
      for (let i = mainLoopEnd; i < dimension; i++) {
        currentDotProduct += queryVector[i]! * dataView.getUint8(vectorOffset + i);
      }
    } else {
      // Large dimension: use lookup table with DataView
      const mainLoopEnd = dimension - (dimension % 32); // 8组 * 4位 = 32位
      for (let i = 0; i < mainLoopEnd; i += 32) {
        const q0 = (queryVector[i] ?? 0) * 8 + (queryVector[i + 1] ?? 0) * 4 + (queryVector[i + 2] ?? 0) * 2 + (queryVector[i + 3] ?? 0);
        const t0 = dataView.getUint8(vectorOffset + i) * 8 + dataView.getUint8(vectorOffset + i + 1) * 4 + dataView.getUint8(vectorOffset + i + 2) * 2 + dataView.getUint8(vectorOffset + i + 3);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q0 * 16 + t0]!;
        
        const q1 = (queryVector[i + 4] ?? 0) * 8 + (queryVector[i + 5] ?? 0) * 4 + (queryVector[i + 6] ?? 0) * 2 + (queryVector[i + 7] ?? 0);
        const t1 = dataView.getUint8(vectorOffset + i + 4) * 8 + dataView.getUint8(vectorOffset + i + 5) * 4 + dataView.getUint8(vectorOffset + i + 6) * 2 + dataView.getUint8(vectorOffset + i + 7);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q1 * 16 + t1]!;
        
        const q2 = (queryVector[i + 8] ?? 0) * 8 + (queryVector[i + 9] ?? 0) * 4 + (queryVector[i + 10] ?? 0) * 2 + (queryVector[i + 11] ?? 0);
        const t2 = dataView.getUint8(vectorOffset + i + 8) * 8 + dataView.getUint8(vectorOffset + i + 9) * 4 + dataView.getUint8(vectorOffset + i + 10) * 2 + dataView.getUint8(vectorOffset + i + 11);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q2 * 16 + t2]!;
        
        const q3 = (queryVector[i + 12] ?? 0) * 8 + (queryVector[i + 13] ?? 0) * 4 + (queryVector[i + 14] ?? 0) * 2 + (queryVector[i + 15] ?? 0);
        const t3 = dataView.getUint8(vectorOffset + i + 12) * 8 + dataView.getUint8(vectorOffset + i + 13) * 4 + dataView.getUint8(vectorOffset + i + 14) * 2 + dataView.getUint8(vectorOffset + i + 15);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q3 * 16 + t3]!;
        
        const q4 = (queryVector[i + 16] ?? 0) * 8 + (queryVector[i + 17] ?? 0) * 4 + (queryVector[i + 18] ?? 0) * 2 + (queryVector[i + 19] ?? 0);
        const t4 = dataView.getUint8(vectorOffset + i + 16) * 8 + dataView.getUint8(vectorOffset + i + 17) * 4 + dataView.getUint8(vectorOffset + i + 18) * 2 + dataView.getUint8(vectorOffset + i + 19);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q4 * 16 + t4]!;
        
        const q5 = (queryVector[i + 20] ?? 0) * 8 + (queryVector[i + 21] ?? 0) * 4 + (queryVector[i + 22] ?? 0) * 2 + (queryVector[i + 23] ?? 0);
        const t5 = dataView.getUint8(vectorOffset + i + 20) * 8 + dataView.getUint8(vectorOffset + i + 21) * 4 + dataView.getUint8(vectorOffset + i + 22) * 2 + dataView.getUint8(vectorOffset + i + 23);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q5 * 16 + t5]!;
        
        const q6 = (queryVector[i + 24] ?? 0) * 8 + (queryVector[i + 25] ?? 0) * 4 + (queryVector[i + 26] ?? 0) * 2 + (queryVector[i + 27] ?? 0);
        const t6 = dataView.getUint8(vectorOffset + i + 24) * 8 + dataView.getUint8(vectorOffset + i + 25) * 4 + dataView.getUint8(vectorOffset + i + 26) * 2 + dataView.getUint8(vectorOffset + i + 27);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q6 * 16 + t6]!;
        
        const q7 = (queryVector[i + 28] ?? 0) * 8 + (queryVector[i + 29] ?? 0) * 4 + (queryVector[i + 30] ?? 0) * 2 + (queryVector[i + 31] ?? 0);
        const t7 = dataView.getUint8(vectorOffset + i + 28) * 8 + dataView.getUint8(vectorOffset + i + 29) * 4 + dataView.getUint8(vectorOffset + i + 30) * 2 + dataView.getUint8(vectorOffset + i + 31);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q7 * 16 + t7]!;
      }
      
      // 处理剩余的元素 - 使用4位查表
      const remainingEnd = dimension - (dimension % 4);
      for (let i = mainLoopEnd; i < remainingEnd; i += 4) {
        const q = (queryVector[i] ?? 0) * 8 + (queryVector[i + 1] ?? 0) * 4 + (queryVector[i + 2] ?? 0) * 2 + (queryVector[i + 3] ?? 0);
        const t = dataView.getUint8(vectorOffset + i) * 8 + dataView.getUint8(vectorOffset + i + 1) * 4 + dataView.getUint8(vectorOffset + i + 2) * 2 + dataView.getUint8(vectorOffset + i + 3);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q * 16 + t]!;
      }
      
      // 处理最后的单个元素
      for (let i = remainingEnd; i < dimension; i++) {
        currentDotProduct += (queryVector[i] ?? 0) * dataView.getUint8(vectorOffset + i);
      }
    }
    results[vecIndex] = currentDotProduct;
  }
  return results;
}

/**
 * 缝合版批量点积计算
 * 结合了项目中的批量处理思想和极致优化算法
 */
function computeStitchedBatchDotProduct(
  queryVector: Uint8Array,
  concatenatedBuffer: Uint8Array,
  numVectors: number,
  dimension: number,
  threshold: number = 512
): number[] {
  const results: number[] = new Array(numVectors).fill(0);

  for (let vecIndex = 0; vecIndex < numVectors; vecIndex++) {
    let currentDotProduct = 0;
    const vectorOffset = vecIndex * dimension;

    
      // Large dimension: use lookup table (computeUltimate4BitDotProduct logic)
      const mainLoopEnd = dimension - (dimension % 32); // 8组 * 4位 = 32位
      for (let i = 0; i < mainLoopEnd; i += 32) {
        const q0 = (queryVector[i] ?? 0) * 8 + (queryVector[i + 1] ?? 0) * 4 + (queryVector[i + 2] ?? 0) * 2 + (queryVector[i + 3] ?? 0);
        const t0 = (concatenatedBuffer[vectorOffset + i] ?? 0) * 8 + (concatenatedBuffer[vectorOffset + i + 1] ?? 0) * 4 + (concatenatedBuffer[vectorOffset + i + 2] ?? 0) * 2 + (concatenatedBuffer[vectorOffset + i + 3] ?? 0);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q0 * 16 + t0]!;
        
        const q1 = (queryVector[i + 4] ?? 0) * 8 + (queryVector[i + 5] ?? 0) * 4 + (queryVector[i + 6] ?? 0) * 2 + (queryVector[i + 7] ?? 0);
        const t1 = (concatenatedBuffer[vectorOffset + i + 4] ?? 0) * 8 + (concatenatedBuffer[vectorOffset + i + 5] ?? 0) * 4 + (concatenatedBuffer[vectorOffset + i + 6] ?? 0) * 2 + (concatenatedBuffer[vectorOffset + i + 7] ?? 0);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q1 * 16 + t1]!;
        
        const q2 = (queryVector[i + 8] ?? 0) * 8 + (queryVector[i + 9] ?? 0) * 4 + (queryVector[i + 10] ?? 0) * 2 + (queryVector[i + 11] ?? 0);
        const t2 = (concatenatedBuffer[vectorOffset + i + 8] ?? 0) * 8 + (concatenatedBuffer[vectorOffset + i + 9] ?? 0) * 4 + (concatenatedBuffer[vectorOffset + i + 10] ?? 0) * 2 + (concatenatedBuffer[vectorOffset + i + 11] ?? 0);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q2 * 16 + t2]!;
        
        const q3 = (queryVector[i + 12] ?? 0) * 8 + (queryVector[i + 13] ?? 0) * 4 + (queryVector[i + 14] ?? 0) * 2 + (queryVector[i + 15] ?? 0);
        const t3 = (concatenatedBuffer[vectorOffset + i + 12] ?? 0) * 8 + (concatenatedBuffer[vectorOffset + i + 13] ?? 0) * 4 + (concatenatedBuffer[vectorOffset + i + 14] ?? 0) * 2 + (concatenatedBuffer[vectorOffset + i + 15] ?? 0);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q3 * 16 + t3]!;
        
        const q4 = (queryVector[i + 16] ?? 0) * 8 + (queryVector[i + 17] ?? 0) * 4 + (queryVector[i + 18] ?? 0) * 2 + (queryVector[i + 19] ?? 0);
        const t4 = (concatenatedBuffer[vectorOffset + i + 16] ?? 0) * 8 + (concatenatedBuffer[vectorOffset + i + 17] ?? 0) * 4 + (concatenatedBuffer[vectorOffset + i + 18] ?? 0) * 2 + (concatenatedBuffer[vectorOffset + i + 19] ?? 0);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q4 * 16 + t4]!;
        
        const q5 = (queryVector[i + 20] ?? 0) * 8 + (queryVector[i + 21] ?? 0) * 4 + (queryVector[i + 22] ?? 0) * 2 + (queryVector[i + 23] ?? 0);
        const t5 = (concatenatedBuffer[vectorOffset + i + 20] ?? 0) * 8 + (concatenatedBuffer[vectorOffset + i + 21] ?? 0) * 4 + (concatenatedBuffer[vectorOffset + i + 22] ?? 0) * 2 + (concatenatedBuffer[vectorOffset + i + 23] ?? 0);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q5 * 16 + t5]!;
        
        const q6 = (queryVector[i + 24] ?? 0) * 8 + (queryVector[i + 25] ?? 0) * 4 + (queryVector[i + 26] ?? 0) * 2 + (queryVector[i + 27] ?? 0);
        const t6 = (concatenatedBuffer[vectorOffset + i + 24] ?? 0) * 8 + (concatenatedBuffer[vectorOffset + i + 25] ?? 0) * 4 + (concatenatedBuffer[vectorOffset + i + 26] ?? 0) * 2 + (concatenatedBuffer[vectorOffset + i + 27] ?? 0);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q6 * 16 + t6]!;
        
        const q7 = (queryVector[i + 28] ?? 0) * 8 + (queryVector[i + 29] ?? 0) * 4 + (queryVector[i + 30] ?? 0) * 2 + (queryVector[i + 31] ?? 0);
        const t7 = (concatenatedBuffer[vectorOffset + i + 28] ?? 0) * 8 + (concatenatedBuffer[vectorOffset + i + 29] ?? 0) * 4 + (concatenatedBuffer[vectorOffset + i + 30] ?? 0) * 2 + (concatenatedBuffer[vectorOffset + i + 31] ?? 0);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q7 * 16 + t7]!;
      }
      
      // 处理剩余的元素 - 使用4位查表
      const remainingEnd = dimension - (dimension % 4);
      for (let i = mainLoopEnd; i < remainingEnd; i += 4) {
        const q = (queryVector[i] ?? 0) * 8 + (queryVector[i + 1] ?? 0) * 4 + (queryVector[i + 2] ?? 0) * 2 + (queryVector[i + 3] ?? 0);
        const t = (concatenatedBuffer[vectorOffset + i] ?? 0) * 8 + (concatenatedBuffer[vectorOffset + i + 1] ?? 0) * 4 + (concatenatedBuffer[vectorOffset + i + 2] ?? 0) * 2 + (concatenatedBuffer[vectorOffset + i + 3] ?? 0);
        currentDotProduct += ULTIMATE_4BIT_LOOKUP_TABLE[q * 16 + t]!;
      }
      
      // 处理最后的单个元素
      for (let i = remainingEnd; i < dimension; i++) {
        currentDotProduct += (queryVector[i] ?? 0) * (concatenatedBuffer[vectorOffset + i] ?? 0);
      }
    
    results[vecIndex] = currentDotProduct;
  }
  return results;
}

/**
 * 创建测试向量
 */
function createTestVectors(dimension: number): { query: Uint8Array; target: Uint8Array } {
  const query = new Uint8Array(dimension);
  const target = new Uint8Array(dimension);
  
  for (let i = 0; i < dimension; i++) {
    query[i] = Math.random() > 0.5 ? 1 : 0;
    target[i] = Math.random() > 0.5 ? 1 : 0;
  }
  
  return { query, target };
}

/**
 * 创建直接内存操作的连接缓冲区
 */
function createDirectMemoryConcatenatedBuffer(targetVectors: Uint8Array[], dimension: number): ArrayBuffer {
  const bufferSize = dimension * targetVectors.length;
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const dataView = new DataView(arrayBuffer);
  
        for (let i = 0; i < targetVectors.length; i++) {
        const vectorOffset = i * dimension;
        for (let j = 0; j < dimension; j++) {
          dataView.setUint8(vectorOffset + j, targetVectors[i]![j]!);
        }
      }
  
  return arrayBuffer;
}

describe('缝合版批量评分计算性能对比', () => {
  const dimensions = [64, 256, 512, 1024, 2048, 4096];
  const numTargetVectors = 10000; // 目标向量数量

  dimensions.forEach(dimension => {
    it(`维度 ${dimension} 下的批量点积性能对比`, () => {
      console.log(`\n=== 维度 ${dimension} 批量点积性能对比 ===`);

      // 生成查询向量
      const queryVector = createTestVectors(dimension).query;

      // 生成目标向量集合
      const targetVectors: Uint8Array[] = [];
      for (let i = 0; i < numTargetVectors; i++) {
        targetVectors.push(createTestVectors(dimension).target);
      }

      // 创建连接缓冲区 - 使用直接内存操作
      const concatenatedBuffer = createDirectMemoryConcatenatedBuffer(targetVectors, dimension);
      
      // 为了兼容性，也创建 Uint8Array 版本
      const concatenatedBufferUint8 = new Uint8Array(dimension * numTargetVectors);
      for (let i = 0; i < numTargetVectors; i++) {
        concatenatedBufferUint8.set(targetVectors[i]!, i * dimension);
      }

      // 预热
      for (let i = 0; i < 5; i++) {
        computePrecomputed4BitQuantizedBatchDotProduct(queryVector, concatenatedBuffer, numTargetVectors, dimension);
        compute4BitQuantizedBatchDotProduct(queryVector, concatenatedBuffer, numTargetVectors, dimension);
        computeStitchedBatchDotProductDirectMemory(queryVector, concatenatedBuffer, numTargetVectors, dimension);
        computeStitchedBatchDotProduct(queryVector, concatenatedBufferUint8, numTargetVectors, dimension);
        computeBatchDotProductOptimized(queryVector, concatenatedBufferUint8, numTargetVectors, dimension);
        computeBatchDotProductOriginal(queryVector, concatenatedBufferUint8, numTargetVectors, dimension);
      }

      const iterations = 10; // 运行多次取平均

      // 测试预计算4位量化版算法
      const precomputed4BitStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        computePrecomputed4BitQuantizedBatchDotProduct(queryVector, concatenatedBuffer, numTargetVectors, dimension);
      }
      const precomputed4BitTime = (performance.now() - precomputed4BitStart) / iterations;

      // 测试4位量化版算法
      const quantized4BitStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        compute4BitQuantizedBatchDotProduct(queryVector, concatenatedBuffer, numTargetVectors, dimension);
      }
      const quantized4BitTime = (performance.now() - quantized4BitStart) / iterations;

      // 测试直接内存操作版算法
      const directMemoryStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        computeStitchedBatchDotProductDirectMemory(queryVector, concatenatedBuffer, numTargetVectors, dimension);
      }
      const directMemoryTime = (performance.now() - directMemoryStart) / iterations;

      // 测试缝合版算法
      const stitchedStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        computeStitchedBatchDotProduct(queryVector, concatenatedBufferUint8, numTargetVectors, dimension);
      }
      const stitchedTime = (performance.now() - stitchedStart) / iterations;

      // 测试项目优化版算法
      const optimizedStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        computeBatchDotProductOptimized(queryVector, concatenatedBufferUint8, numTargetVectors, dimension);
      }
      const optimizedTime = (performance.now() - optimizedStart) / iterations;

      // 测试项目原始版算法
      const originalStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        computeBatchDotProductOriginal(queryVector, concatenatedBufferUint8, numTargetVectors, dimension);
      }
      const originalTime = (performance.now() - originalStart) / iterations;

      console.log(`  预计算4位量化版算法: ${precomputed4BitTime.toFixed(3)}ms`);
      console.log(`  4位量化版算法: ${quantized4BitTime.toFixed(3)}ms`);
      console.log(`  直接内存操作版算法: ${directMemoryTime.toFixed(3)}ms`);
      console.log(`  缝合版算法: ${stitchedTime.toFixed(3)}ms`);
      console.log(`  项目优化版算法: ${optimizedTime.toFixed(3)}ms`);
      console.log(`  项目原始版算法: ${originalTime.toFixed(3)}ms`);
      console.log(`  预计算4位量化版相对于4位量化版加速比: ${(quantized4BitTime / precomputed4BitTime).toFixed(2)}x`);
      console.log(`  预计算4位量化版相对于直接内存版加速比: ${(directMemoryTime / precomputed4BitTime).toFixed(2)}x`);
      console.log(`  预计算4位量化版相对于缝合版加速比: ${(stitchedTime / precomputed4BitTime).toFixed(2)}x`);
      console.log(`  预计算4位量化版相对于项目优化版加速比: ${(optimizedTime / precomputed4BitTime).toFixed(2)}x`);
      console.log(`  预计算4位量化版相对于项目原始版加速比: ${(originalTime / precomputed4BitTime).toFixed(2)}x`);

      // 验证结果一致性 (只验证一次，因为性能测试会运行多次)
      const precomputed4BitResults = computePrecomputed4BitQuantizedBatchDotProduct(queryVector, concatenatedBuffer, numTargetVectors, dimension);
      const quantized4BitResults = compute4BitQuantizedBatchDotProduct(queryVector, concatenatedBuffer, numTargetVectors, dimension);
      const directMemoryResults = computeStitchedBatchDotProductDirectMemory(queryVector, concatenatedBuffer, numTargetVectors, dimension);
      const stitchedResults = computeStitchedBatchDotProduct(queryVector, concatenatedBufferUint8, numTargetVectors, dimension);
      const optimizedResults = computeBatchDotProductOptimized(queryVector, concatenatedBufferUint8, numTargetVectors, dimension);
      const originalResults = computeBatchDotProductOriginal(queryVector, concatenatedBufferUint8, numTargetVectors, dimension);

      expect(precomputed4BitResults).toEqual(quantized4BitResults);
      expect(precomputed4BitResults).toEqual(directMemoryResults);
      expect(precomputed4BitResults).toEqual(stitchedResults);
      expect(precomputed4BitResults).toEqual(optimizedResults);
      expect(precomputed4BitResults).toEqual(originalResults);
      console.log('  结果一致性验证通过 ✅');
    });
  });
});
