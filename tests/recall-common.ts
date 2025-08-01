import { BinaryQuantizationFormat } from '../src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '../src/types';
import { computeCosineSimilarity } from '../src/vectorSimilarity';
import { normalizeVector } from '../src/vectorOperations';

/**
 * @织: 通用召回率测试工具
 * 本文件包含所有维度测试的通用函数和配置
 * 提供标准化的测试流程和配置管理
 */

/**
 * 召回率测试配置
 */
export interface RecallTestConfig {
  /** 向量维度 */
  dimension: number;
  /** 基础向量数量 */
  baseSize: number;
  /** 查询向量数量 */
  querySize: number;
  /** TopK值 */
  k: number;
  /** 1位查询召回率阈值 */
  recallThreshold1bit: number;
  /** 4位查询召回率阈值 */
  recallThreshold4bit: number;

  /** 超采样召回率阈值 */
  recallThresholdOversample: number;
  /** 超采样因子 */
  oversampleFactor: number;
  /** 量化器配置 */
  quantizerConfig: {
    lambda: number;
    iters: number;
  };
}

/**
 * 常见嵌入引擎的召回率测试配置
 */
export const RECALL_TEST_CONFIGS: Record<string, RecallTestConfig> = {
  // 384维 - BERT、RoBERTa等
  '384d': {
    dimension: 384,
    baseSize: 1000,
    querySize: 20,
    k: 10,
    recallThreshold1bit: 0.60,
    recallThreshold4bit: 0.75,
    recallThresholdOversample: 0.80,
    oversampleFactor: 3,
    quantizerConfig: {
      lambda: 0.001,
      iters: 20
    }
  },
  
  // 768维 - BERT-large、RoBERTa-large等
  '768d': {
    dimension: 768,
    baseSize: 1000,
    querySize: 20,
    k: 10,
    recallThreshold1bit: 0.55,
    recallThreshold4bit: 0.70,
    recallThresholdOversample: 0.75,
    oversampleFactor: 3,
    quantizerConfig: {
      lambda: 0.001,
      iters: 20
    }
  },
  
  // 1024维 - 一些大型模型
  '1024d': {
    dimension: 1024,
    baseSize: 1000,
    querySize: 20,
    k: 10,
    recallThreshold1bit: 0.50,
    recallThreshold4bit: 0.65,
    recallThresholdOversample: 0.70,
    oversampleFactor: 3,
    quantizerConfig: {
      lambda: 0.001,
      iters: 20
    }
  },
  
  // 1536维 - 更大型模型
  '1536d': {
    dimension: 1536,
    baseSize: 1000,
    querySize: 20,
    k: 10,
    recallThreshold1bit: 0.45,
    recallThreshold4bit: 0.60,
    recallThresholdOversample: 0.65,
    oversampleFactor: 3,
    quantizerConfig: {
      lambda: 0.001,
      iters: 20
    }
  }
};

/**
 * 生成固定的随机数据集
 */
export function createFixedDataset(config: RecallTestConfig) {
  const { dimension, baseSize, querySize } = config;
  const baseVectors: Float32Array[] = [];
  const queryVectors: Float32Array[] = [];
  
  // 生成base向量
  for (let i = 0; i < baseSize; i++) {
    const vector = new Float32Array(dimension);
    for (let j = 0; j < dimension; j++) {
      const seed = i * 1000 + j;
      vector[j] = Math.sin(seed) * 0.5 + Math.cos(seed * 0.7) * 0.3;
    }
    baseVectors.push(normalizeVector(vector));
  }
  
  // 生成query向量
  for (let i = 0; i < querySize; i++) {
    const vector = new Float32Array(dimension);
    for (let j = 0; j < dimension; j++) {
      const seed = (i + 1000) * 1000 + j;
      vector[j] = Math.sin(seed) * 0.5 + Math.cos(seed * 0.7) * 0.3;
    }
    queryVectors.push(normalizeVector(vector));
  }
  
  return { baseVectors, queryVectors };
}

/**
 * 计算真实TopK（暴力法）
 */
export function getTrueTopK(query: Float32Array, base: Float32Array[], k: number) {
  const scores = base.map((vec: Float32Array, idx: number) => ({
    idx,
    score: computeCosineSimilarity(query, vec)
  }));
  return scores.sort((a: { score: number }, b: { score: number }) => b.score - a.score).slice(0, k).map((x: { idx: number }) => x.idx);
}

/**
 * 计算量化TopK
 */
export function getQuantizedTopK(query: Float32Array, quantizedBase: any, k: number, format: BinaryQuantizationFormat) {
  const results = format.searchNearestNeighbors(query, quantizedBase, k);
  return results.map((x: { index: number }) => x.index);
}

/**
 * 计算召回率
 */
export function computeRecall(trueTopK: number[], quantizedTopK: number[]) {
  let hit = 0;
  for (const idx of quantizedTopK) {
    if (trueTopK.includes(idx)) hit++;
  }
  return hit / trueTopK.length;
}

/**
 * 创建量化格式
 */
export function createQuantizationFormat(queryBits: number, indexBits: number, config: RecallTestConfig) {
  return new BinaryQuantizationFormat({
    queryBits,
    indexBits,
    quantizer: {
      similarityFunction: VectorSimilarityFunction.COSINE,
      lambda: config.quantizerConfig.lambda,
      iters: config.quantizerConfig.iters
    }
  });
}

/**
 * 超采样量化TopK计算
 */
export function getOversampledQuantizedTopK(
  query: Float32Array, 
  quantizedBase: any, 
  k: number, 
  oversampleFactor: number, 
  format: BinaryQuantizationFormat,
  baseVectors: Float32Array[]
) {
  const oversampledK = k * oversampleFactor;
  const oversampledResults = format.searchNearestNeighbors(query, quantizedBase, oversampledK);
  
  const candidateScores = oversampledResults.map(result => {
    const baseVector = baseVectors[result.index];
    if (!baseVector) {
      throw new Error(`基础向量${result.index}不存在`);
    }
    return {
      index: result.index,
      quantizedScore: result.score,
      trueScore: computeCosineSimilarity(query, baseVector)
    };
  });
  
  const sortedCandidates = candidateScores.sort((a, b) => b.trueScore - a.trueScore);
  return sortedCandidates.slice(0, k).map(x => x.index);
}

/**
 * 执行召回率测试
 */
export function executeRecallTest(
  config: RecallTestConfig,
  queryBits: number,
  indexBits: number,
  baseVectors: Float32Array[],
  queryVectors: Float32Array[],
  testName: string
) {
  const format = createQuantizationFormat(queryBits, indexBits, config);
  const { quantizedVectors } = format.quantizeVectors(baseVectors);
  
  let totalRecall = 0;
  for (let i = 0; i < config.querySize; i++) {
    const query = queryVectors[i];
    if (!query) {
      throw new Error(`查询向量${i}不存在`);
    }
    const trueTopK = getTrueTopK(query, baseVectors, config.k);
    const quantizedTopK = getQuantizedTopK(query, quantizedVectors, config.k, format);
    const recall = computeRecall(trueTopK, quantizedTopK);
    totalRecall += recall;
    
    // eslint-disable-next-line no-console
    console.log(`${testName} query#${i}: recall=${recall.toFixed(3)}`);
  }
  
  const avgRecall = totalRecall / config.querySize;
  // eslint-disable-next-line no-console
  console.log(`${testName} avgRecall:`, avgRecall.toFixed(3));
  
  return avgRecall;
}

/**
 * 执行超采样召回率测试
 */
export function executeOversampledRecallTest(
  config: RecallTestConfig,
  baseVectors: Float32Array[],
  queryVectors: Float32Array[],
  testName: string
) {
  const format = createQuantizationFormat(4, 1, config); // 4位查询 + 1位索引
  const { quantizedVectors } = format.quantizeVectors(baseVectors);
  
  let totalRecall = 0;
  for (let i = 0; i < config.querySize; i++) {
    const query = queryVectors[i];
    if (!query) {
      throw new Error(`查询向量${i}不存在`);
    }
    const trueTopK = getTrueTopK(query, baseVectors, config.k);
    const quantizedTopK = getOversampledQuantizedTopK(
      query, 
      quantizedVectors, 
      config.k, 
      config.oversampleFactor, 
      format, 
      baseVectors
    );
    const recall = computeRecall(trueTopK, quantizedTopK);
    totalRecall += recall;
    
    // eslint-disable-next-line no-console
    console.log(`${testName} query#${i}: recall=${recall.toFixed(3)}`);
  }
  
  const avgRecall = totalRecall / config.querySize;
  // eslint-disable-next-line no-console
  console.log(`${testName} avgRecall:`, avgRecall.toFixed(3));
  
  return avgRecall;
} 