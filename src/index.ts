/**
 * 二值量化系统主入口
 * 基于Lucene的二值量化实现
 * 
 * 本系统实现了完整的二值量化功能，包括：
 * - 优化的标量量化器
 * - 位运算优化的向量操作
 * - 二值量化评分器
 * - 完整的二值量化格式
 * 
 * 主要特性：
 * - 各向异性损失函数
 * - 坐标下降优化算法
 * - 非对称量化策略 (查询4位 vs 索引1位)
 * - 质心中心化优化
 * - SIMD友好的位运算优化
 */

// 类型定义
export * from './types';

// 常量
export * from './constants';

// 工具函数
export * from './utils';

// 核心组件
export { OptimizedScalarQuantizer } from './optimizedScalarQuantizer';
export { BinaryQuantizedScorer } from './binaryQuantizedScorer';
export { BinaryQuantizationFormat } from './binaryQuantizationFormat';

// 向量操作函数
export * from './vectorOperations';
export * from './vectorSimilarity';
export * from './vectorUtils';
export * from './bitwiseDotProduct';

// 本地导入用于函数内部使用
import { BinaryQuantizationFormat } from './binaryQuantizationFormat';
import { VectorSimilarityFunction } from './types';

// 默认配置
export const DEFAULT_CONFIG = {
  queryBits: 4,
  indexBits: 1,
  quantizer: {
    similarityFunction: VectorSimilarityFunction.COSINE,
    lambda: 0.1,
    iters: 5
  }
} as const;

/**
 * 创建二值量化格式实例
 * @param config 配置选项
 * @returns 二值量化格式实例
 */
export function createBinaryQuantizationFormat(config = DEFAULT_CONFIG) {
  return new BinaryQuantizationFormat(config);
}

/**
 * 快速量化向量集合
 * @param vectors 向量集合
 * @param similarityFunction 相似性函数
 * @returns 量化结果
 */
export function quickQuantize(
  vectors: Float32Array[],
  similarityFunction: VectorSimilarityFunction = VectorSimilarityFunction.COSINE
) {
  const format = new BinaryQuantizationFormat({
    quantizer: {
      similarityFunction,
      lambda: 0.1,
      iters: 5
    }
  });
  
  return format.quantizeVectors(vectors);
}

/**
 * 快速搜索最近邻
 * @param queryVector 查询向量
 * @param targetVectors 目标向量集合
 * @param k 返回数量
 * @param similarityFunction 相似性函数
 * @returns 最近邻结果
 */
export function quickSearch(
  queryVector: Float32Array,
  targetVectors: Float32Array[],
  k: number,
  similarityFunction: VectorSimilarityFunction = VectorSimilarityFunction.COSINE
) {
  const format = new BinaryQuantizationFormat({
    quantizer: {
      similarityFunction,
      lambda: 0.1,
      iters: 5
    }
  });
  
  const { quantizedVectors } = format.quantizeVectors(targetVectors);
  return format.searchNearestNeighbors(queryVector, quantizedVectors, k);
}

/**
 * 计算量化精度
 * @param originalVectors 原始向量集合
 * @param queryVectors 查询向量集合
 * @param similarityFunction 相似性函数
 * @returns 量化精度统计
 */
export function computeAccuracy(
  originalVectors: Float32Array[],
  queryVectors: Float32Array[],
  similarityFunction: VectorSimilarityFunction = VectorSimilarityFunction.COSINE
) {
  const format = new BinaryQuantizationFormat({
    quantizer: {
      similarityFunction,
      lambda: 0.1,
      iters: 5
    }
  });
  
  return format.computeQuantizationAccuracy(originalVectors, queryVectors);
}

/**
 * 版本信息
 */
export const VERSION = '1.0.0';

/**
 * 系统信息
 */
export const SYSTEM_INFO = {
  name: 'Binary Quantization System',
  version: VERSION,
  description: '基于Lucene的二值量化实现',
  features: [
    '优化的标量量化器',
    '位运算优化的向量操作',
    '二值量化评分器',
    '完整的二值量化格式',
    '各向异性损失函数',
    '坐标下降优化算法',
    '非对称量化策略',
    '质心中心化优化',
    'SIMD友好的位运算优化'
  ]
} as const; 