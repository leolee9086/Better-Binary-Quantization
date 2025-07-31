/**
 * TopK选择工具函数
 * 使用最小堆进行高效的topK选择算法
 */

import { MinHeap } from './minHeap';
import { BinaryQuantizationFormat } from './binaryQuantizationFormat';
import { computeCosineSimilarity } from './vectorSimilarity';

/**
 * TopK候选结果接口
 */
export interface TopKCandidate {
  index: number;
  quantizedScore: number;
  trueScore: number;
}

/**
 * 使用最小堆优化的超采样topK选择
 * @param query 查询向量
 * @param quantizedVectors 量化向量集合
 * @param vectors 原始向量集合
 * @param k 需要的topK数量
 * @param oversampleFactor 超采样因子
 * @param format 量化格式
 * @returns topK候选结果数组
 */
export function getOversampledTopKWithHeap(
  query: Float32Array, 
  quantizedVectors: any, 
  vectors: Float32Array[], 
  k: number, 
  oversampleFactor: number, 
  format: BinaryQuantizationFormat
): TopKCandidate[] {
  const oversampledK = k * oversampleFactor;
  const oversampledResults = format.searchNearestNeighbors(query, quantizedVectors, oversampledK);
  
  // 使用最小堆维护topK
  const minHeap = new MinHeap<TopKCandidate>((a, b) => a.trueScore - b.trueScore);
  
  for (const result of oversampledResults) {
    const vector = vectors[result.index];
    if (!vector) continue;
    
    const trueScore = computeCosineSimilarity(query, vector);
    const candidate: TopKCandidate = {
      index: result.index,
      quantizedScore: result.score,
      trueScore: trueScore
    };
    
    if (minHeap.size() < k) {
      minHeap.push(candidate);
    } else {
      const peek = minHeap.peek();
      if (peek && trueScore > peek.trueScore) {
        minHeap.pop();
        minHeap.push(candidate);
      }
    }
  }
  
  // 从堆中提取结果并排序
  const topK: TopKCandidate[] = [];
  while (!minHeap.isEmpty()) {
    const item = minHeap.pop();
    if (item) {
      topK.push(item);
    }
  }
  
  // 按真实分数降序排列
  topK.sort((a, b) => b.trueScore - a.trueScore);
  
  return topK;
}

/**
 * 传统的排序方法进行topK选择（用于性能对比）
 * @param query 查询向量
 * @param quantizedVectors 量化向量集合
 * @param vectors 原始向量集合
 * @param k 需要的topK数量
 * @param oversampleFactor 超采样因子
 * @param format 量化格式
 * @returns topK候选结果数组
 */
export function getOversampledTopKWithSort(
  query: Float32Array, 
  quantizedVectors: any, 
  vectors: Float32Array[], 
  k: number, 
  oversampleFactor: number, 
  format: BinaryQuantizationFormat
): TopKCandidate[] {
  const oversampledK = k * oversampleFactor;
  const oversampledResults = format.searchNearestNeighbors(query, quantizedVectors, oversampledK);
  
  const candidateScores = oversampledResults.map(result => {
    const vector = vectors[result.index];
    if (!vector) return null;
    
    return {
      index: result.index,
      quantizedScore: result.score,
      trueScore: computeCosineSimilarity(query, vector)
    };
  }).filter((candidate): candidate is TopKCandidate => candidate !== null);
  
  // 按真实分数排序并返回topK
  candidateScores.sort((a, b) => b.trueScore - a.trueScore);
  return candidateScores.slice(0, k);
} 