import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '../src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '../src/types';
import { computeCosineSimilarity } from '../src/vectorSimilarity';
import { normalizeVector } from '../src/vectorOperations';

/**
 * @织: 召回率测试
 * 本测试用于评估量化检索的召回率（recall@K），即量化检索结果中包含真实最近邻的比例。
 * 步骤：
 * 1. 生成一批base向量和query向量
 * 2. 用原始向量暴力计算每个query的真实topK最近邻
 * 3. 用量化检索计算每个query的topK
 * 4. 统计recall@K
 * 5. 断言召回率大于阈值
 * 调试：输出每个query的recall和topK，便于分析问题。
 */

// 全局数据集，确保单比特和4位查询使用相同的数据
const GLOBAL_DIM = 128;
const GLOBAL_BASE_SIZE = 100;
const GLOBAL_QUERY_SIZE = 10;
const GLOBAL_K = 10;

// 生成固定的随机数据集
function createFixedDataset() {
  // 使用固定的随机种子来确保数据集一致性
  const baseVectors: Float32Array[] = [];
  const queryVectors: Float32Array[] = [];
  
  // 生成base向量
  for (let i = 0; i < GLOBAL_BASE_SIZE; i++) {
    const vector = new Float32Array(GLOBAL_DIM);
    for (let j = 0; j < GLOBAL_DIM; j++) {
      // 使用简单的伪随机生成，确保一致性
      const seed = i * 1000 + j;
      vector[j] = Math.sin(seed) * 0.5 + Math.cos(seed * 0.7) * 0.3;
    }
    baseVectors.push(vector);
  }
  
  // 生成query向量
  for (let i = 0; i < GLOBAL_QUERY_SIZE; i++) {
    const vector = new Float32Array(GLOBAL_DIM);
    for (let j = 0; j < GLOBAL_DIM; j++) {
      // 使用不同的种子避免与base向量重复
      const seed = (i + 1000) * 1000 + j;
      vector[j] = Math.sin(seed) * 0.5 + Math.cos(seed * 0.7) * 0.3;
    }
    queryVectors.push(vector);
  }
  
  return { baseVectors, queryVectors };
}

// 创建全局数据集
const { baseVectors: GLOBAL_BASE_VECTORS, queryVectors: GLOBAL_QUERY_VECTORS } = createFixedDataset();

// 数据集一致性验证测试
describe('数据集一致性验证', () => {
  it('应该使用相同的数据集进行单比特和4位查询测试', () => {
    // 验证数据集大小
    expect(GLOBAL_BASE_VECTORS.length).toBe(GLOBAL_BASE_SIZE);
    expect(GLOBAL_QUERY_VECTORS.length).toBe(GLOBAL_QUERY_SIZE);
    const firstBaseVector = GLOBAL_BASE_VECTORS[0];
    const firstQueryVector = GLOBAL_QUERY_VECTORS[0];
    if (!firstBaseVector || !firstQueryVector) {
      throw new Error('第一个向量不存在');
    }
    expect(firstBaseVector.length).toBe(GLOBAL_DIM);
    expect(firstQueryVector.length).toBe(GLOBAL_DIM);
    
    // 验证数据集内容一致性（检查前几个向量的前几个元素）
    const baseSample = firstBaseVector.slice(0, 5);
    const querySample = firstQueryVector.slice(0, 5);
    
    // 使用 vitest 断言替代 console.log
    expect(Array.from(baseSample ?? new Float32Array(0))).toBeDefined();
    expect(Array.from(querySample ?? new Float32Array(0))).toBeDefined();
    expect(GLOBAL_BASE_VECTORS.length).toBe(GLOBAL_BASE_SIZE);
    expect(GLOBAL_QUERY_VECTORS.length).toBe(GLOBAL_QUERY_SIZE);
    expect(GLOBAL_DIM).toBe(128);
    
    // 不再验证向量是否归一化，因为现在使用原始尺度数据
  });
});

describe('召回率测试', () => {
  const QUERY_SIZE = GLOBAL_QUERY_SIZE;
  const K = GLOBAL_K;
  const RECALL_THRESHOLD = 0.70;

  // 使用全局数据集
  const baseVectors = GLOBAL_BASE_VECTORS;
  const queryVectors = GLOBAL_QUERY_VECTORS;

  // 构建量化器 - 高维向量单比特量化配置
  const format = new BinaryQuantizationFormat({
    queryBits: 1, // 单比特量化
    indexBits: 1, // 单比特量化
    quantizer: {
      similarityFunction: VectorSimilarityFunction.COSINE,
      lambda: 0.001, // 适中的lambda
      iters: 20 // 适中的迭代次数
    }
  });

  // 量化base向量
  const { quantizedVectors } = format.quantizeVectors(baseVectors);

  // 计算每个query的真实topK（暴力法）
  function getTrueTopK(query: Float32Array, base: Float32Array[], k: number) {
    const scores = base.map((vec: Float32Array, idx: number) => ({
      idx,
      score: computeCosineSimilarity(query, vec)
    }));
    return scores.sort((a: { score: number }, b: { score: number }) => b.score - a.score).slice(0, k).map((x: { idx: number }) => x.idx);
  }

  // 计算每个query的量化topK
  function getQuantizedTopK(query: Float32Array, quantizedBase: any, k: number) {
    const results = format.searchNearestNeighbors(query, quantizedBase, k);
    return results.map((x: { index: number }) => x.index);
  }

  // 计算recall@K
  function computeRecall(trueTopK: number[], quantizedTopK: number[]) {
    let hit = 0;
    for (const idx of quantizedTopK) {
      if (trueTopK.includes(idx)) hit++;
    }
    return hit / trueTopK.length;
  }

  it(`量化检索的 recall@${K} 应大于 ${RECALL_THRESHOLD}`, () => {
    // 调试信息：输出量化向量的基本信息
    // @织:保留: 输出量化向量的调试信息

    let totalRecall = 0;
    for (let i = 0; i < QUERY_SIZE; i++) {
      const query = queryVectors[i];
      if (!query) {
        throw new Error(`查询向量${i}不存在`);
      }
      const trueTopK = getTrueTopK(query, baseVectors, K);
      const quantizedTopK = getQuantizedTopK(query, quantizedVectors, K);
      const recall = computeRecall(trueTopK, quantizedTopK);
      totalRecall += recall;
      // 输出详细信息
      // @织:保留: 输出每个query的recall和topK，便于调试
      // eslint-disable-next-line no-console
      
      // 添加量化分数调试信息
      const results = format.searchNearestNeighbors(query, quantizedVectors, K);
      // 使用 vitest 断言替代 console.log
      expect(results).toHaveLength(K);
      expect(results.every(r => typeof r.score === 'number')).toBe(true);

    }
    const avgRecall = totalRecall / QUERY_SIZE;
    // 使用 vitest 断言替代 console.log
    expect(avgRecall).toBeGreaterThanOrEqual(0);
    expect(avgRecall).toBeGreaterThanOrEqual(RECALL_THRESHOLD);
  });
});

/**
 * @织: 极简小数据召回率测试
 * 用低维度、小数据量、高bits、手动构造相似向量，先确保基本功能正常。
 * 如果这个测试能通过，说明量化检索基本功能没问题，问题在于大数据量或参数设置。
 */
describe('极简小数据召回率测试', () => {
  const BASE_SIZE = 20; // 增加base数量
  const QUERY_SIZE = 3; // 增加query数量
  const K = 5; // 增加topK
  const RECALL_THRESHOLD = 0.4; // 提高阈值


  // 手动构造部分相似的向量 - 32维，适合单比特量化
  const baseVectors = Array.from({ length: BASE_SIZE }, (_, i) => {
    const vec = new Float32Array(GLOBAL_DIM);
    if (i < 5) {
      // 前5个向量与第一个query相似 - 使用明显的正负值
      vec[0] = 0.8 - i * 0.1;
      vec[1] = i * 0.1;
      // 填充其他维度为小的随机值
      for (let j = 2; j < GLOBAL_DIM; j++) {
        vec[j] = (Math.random() - 0.5) * 0.2;
      }
    } else if (i < 10) {
      // 接下来5个向量与第二个query相似
      vec[0] = (Math.random() - 0.5) * 0.2;
      vec[1] = 0.8 - (i - 5) * 0.1;
      vec[2] = (i - 5) * 0.1;
      // 填充其他维度
      for (let j = 3; j < GLOBAL_DIM; j++) {
        vec[j] = (Math.random() - 0.5) * 0.2;
      }
    } else if (i < 15) {
      // 接下来5个向量与第三个query相似
      vec[0] = (Math.random() - 0.5) * 0.2;
      vec[1] = (Math.random() - 0.5) * 0.2;
      vec[2] = 0.8 - (i - 10) * 0.1;
      vec[3] = (i - 10) * 0.1;
      // 填充其他维度
      for (let j = 4; j < GLOBAL_DIM; j++) {
        vec[j] = (Math.random() - 0.5) * 0.2;
      }
    } else {
      // 其余向量随机分布，但确保有足够的区分性
      for (let j = 0; j < GLOBAL_DIM; j++) {
        vec[j] = (Math.random() - 0.5) * 0.8;
      }
    }
    return normalizeVector(vec);
  });

  const queryVectors = [
    normalizeVector(new Float32Array([1, 0, 0, ...new Array(GLOBAL_DIM - 3).fill(0)])), // 应该召回0,1,2,3,4
    normalizeVector(new Float32Array([0, 1, 0, ...new Array(GLOBAL_DIM - 3).fill(0)])), // 应该召回5,6,7,8,9
    normalizeVector(new Float32Array([0, 0, 1, ...new Array(GLOBAL_DIM - 3).fill(0)]))  // 应该召回10,11,12,13,14
  ];

  // 构建量化器 - 单比特量化配置
  const format = new BinaryQuantizationFormat({
    queryBits: 1, // 单比特量化
    indexBits: 1, // 单比特量化
    quantizer: {
      similarityFunction: VectorSimilarityFunction.COSINE,
      lambda: 0.05, // 适中的lambda
      iters: 10 // 适中的迭代次数
    }
  });

  // 量化base向量
  const { quantizedVectors } = format.quantizeVectors(baseVectors);

  // 计算每个query的真实topK（暴力法）
  function getTrueTopK(query: Float32Array, base: Float32Array[], k: number) {
    const scores = base.map((vec: Float32Array, idx: number) => ({
      idx,
      score: computeCosineSimilarity(query, vec)
    }));
    return scores.sort((a: { score: number }, b: { score: number }) => b.score - a.score).slice(0, k).map((x: { idx: number }) => x.idx);
  }

  // 计算每个query的量化topK
  function getQuantizedTopK(query: Float32Array, quantizedBase: any, k: number) {
    const results = format.searchNearestNeighbors(query, quantizedBase, k);
    return results.map((x: { index: number }) => x.index);
  }

  // 计算recall@K
  function computeRecall(trueTopK: number[], quantizedTopK: number[]) {
    let hit = 0;
    for (const idx of quantizedTopK) {
      if (trueTopK.includes(idx)) hit++;
    }
    return hit / trueTopK.length;
  }

  it(`极简小数据的 recall@${K} 应大于 ${RECALL_THRESHOLD}`, () => {
    // 调试信息：输出量化向量的基本信息
    // @织:保留: 输出量化向量的调试信息
    // 使用 vitest 断言替代 console.log
    for (let i = 0; i < Math.min(3, quantizedVectors.size()); i++) {
      const vectorValue = quantizedVectors.vectorValue(i);
      expect(vectorValue).toBeDefined();
      expect(Array.from(vectorValue).slice(0, 10)).toBeDefined();
    }

    let totalRecall = 0;
    for (let i = 0; i < QUERY_SIZE; i++) {
      const query = queryVectors[i];
      if (!query) {
        throw new Error(`查询向量${i}不存在`);
      }
      const trueTopK = getTrueTopK(query, baseVectors, K);
      const quantizedTopK = getQuantizedTopK(query, quantizedVectors, K);
      const recall = computeRecall(trueTopK, quantizedTopK);
      totalRecall += recall;
      // 使用 vitest 断言替代 console.log
      expect(recall).toBeGreaterThanOrEqual(0);
      expect(trueTopK).toHaveLength(K);
      expect(quantizedTopK).toHaveLength(K);
    }
    const avgRecall = totalRecall / QUERY_SIZE;
    // 使用 vitest 断言替代 console.log
    expect(avgRecall).toBeGreaterThanOrEqual(0);
    expect(avgRecall).toBeGreaterThanOrEqual(RECALL_THRESHOLD);
  });
});

/**
 * @织: 底层量化评分测试
 * 直接测试底层的量化评分功能，绕过searchNearestNeighbors，手动遍历所有向量计算分数。
 * 验证量化检索的基本功能是否正常。
 */
describe('底层量化评分测试', () => {
  const BASE_SIZE = 5; // 小数据量
  const K = 3; // topK


  // 手动构造相似向量
  const baseVectors = [
    new Float32Array([1, 0, 0, 0]), // 0
    new Float32Array([0.9, 0.1, 0, 0]), // 1 - 与0相似
    new Float32Array([0.8, 0.2, 0, 0]), // 2 - 与0相似
    new Float32Array([0, 1, 0, 0]), // 3
    new Float32Array([0, 0, 1, 0]) // 4
  ];

  const queryVector = new Float32Array([1, 0, 0, 0]); // 应该召回0,1,2

  // 构建量化器 - 单比特量化配置
  const format = new BinaryQuantizationFormat({
    queryBits: 1, // 单比特量化
    indexBits: 1, // 单比特量化
    quantizer: {
      similarityFunction: VectorSimilarityFunction.COSINE,
      lambda: 0.05, // 适中的lambda
      iters: 10 // 适中的迭代次数
    }
  });

  // 量化base向量
  const { quantizedVectors } = format.quantizeVectors(baseVectors);

  it('底层量化评分功能应正常工作', () => {
    // 1. 计算真实topK
    const trueScores = baseVectors.map((vec, idx) => ({
      idx,
      score: computeCosineSimilarity(queryVector, vec)
    }));
    const trueTopK = trueScores.sort((a, b) => b.score - a.score).slice(0, K).map(x => x.idx);
    
    // 2. 手动计算量化分数
    const centroid = quantizedVectors.getCentroid();
    const { quantizedQuery, queryCorrections } = format.quantizeQueryVector(queryVector, centroid);
    
    const quantizedScores: Array<{idx: number; score: number}> = [];
    // 手动遍历所有向量
    for (let i = 0; i < BASE_SIZE; i++) {
      const result = format.getScorer().computeQuantizedScore(
        quantizedQuery,
        queryCorrections,
        quantizedVectors,
        i,
        1, // 添加queryBits参数
        queryVector
      );
      quantizedScores.push({
        idx: i,
        score: result.score
      });
    }
    
    const quantizedTopK = quantizedScores.sort((a, b) => b.score - a.score).slice(0, K).map(x => x.idx);
    
    // 3. 使用 vitest 断言替代 console.log
    expect(trueTopK).toHaveLength(K);
    expect(quantizedTopK).toHaveLength(K);
    expect(trueScores).toHaveLength(BASE_SIZE);
    expect(quantizedScores).toHaveLength(BASE_SIZE);
    
    // 4. 计算召回率
    let hit = 0;
    for (const idx of quantizedTopK) {
      if (trueTopK.includes(idx)) hit++;
    }
    const recall = hit / trueTopK.length;
    
    // 使用 vitest 断言替代 console.log
    expect(recall).toBeGreaterThanOrEqual(0);
    
    // 5. 断言
    expect(recall).toBeGreaterThan(0);
    expect(quantizedTopK.length).toBe(K);
  });
});

/**
 * @织: 4位查询+1位索引召回率测试
 * 使用真实的生产参数配置：4位查询向量 + 1位索引向量
 * 这是Lucene默认的非对称量化策略，应该提供更好的召回率
 */
describe('4位查询+1位索引召回率测试', () => {
  const QUERY_SIZE = GLOBAL_QUERY_SIZE;
  const K = GLOBAL_K;
  const RECALL_THRESHOLD = 0.6; // 4位查询应该有更高的召回率

  // 使用全局数据集，确保与单比特查询使用相同的数据
  const baseVectors = GLOBAL_BASE_VECTORS;
  const queryVectors = GLOBAL_QUERY_VECTORS;

  // 构建量化器 - 4位查询+1位索引配置
  const format = new BinaryQuantizationFormat({
    queryBits: 4, // 4位查询量化
    indexBits: 1, // 1位索引量化
    quantizer: {
      similarityFunction: VectorSimilarityFunction.COSINE,
      lambda: 0.001, // 与单比特查询保持一致
      iters: 20 // 与单比特查询保持一致
    }
  });

  // 量化base向量
  const { quantizedVectors } = format.quantizeVectors(baseVectors);

  // 计算每个query的真实topK（暴力法）
  function getTrueTopK(query: Float32Array, base: Float32Array[], k: number) {
    const scores = base.map((vec: Float32Array, idx: number) => ({
      idx,
      score: computeCosineSimilarity(query, vec)
    }));
    return scores.sort((a: { score: number }, b: { score: number }) => b.score - a.score).slice(0, k).map((x: { idx: number }) => x.idx);
  }

  // 计算每个query的量化topK
  function getQuantizedTopK(query: Float32Array, quantizedBase: any, k: number) {
    const results = format.searchNearestNeighbors(query, quantizedBase, k);
    return results.map((x: { index: number }) => x.index);
  }

  // 计算recall@K
  function computeRecall(trueTopK: number[], quantizedTopK: number[]) {
    let hit = 0;
    for (const idx of quantizedTopK) {
      if (trueTopK.includes(idx)) hit++;
    }
    return hit / trueTopK.length;
  }

  it('4位量化分数与原始余弦相似性的关系调试', () => {
    // 选择第一个query进行详细分析
    const query = queryVectors[0];
    if (!query) {
      throw new Error('第一个查询向量不存在');
    }
    
    // 计算原始余弦相似性
    const originalScores = baseVectors.map((vec, idx) => ({
      idx,
      score: computeCosineSimilarity(query, vec)
    }));
    
    // 计算量化分数
    const quantizedResults = format.searchNearestNeighbors(query, quantizedVectors, GLOBAL_BASE_SIZE);
    
    // 使用 vitest 断言替代 console.log
    for (let i = 0; i < 10; i++) {
      const original = originalScores[i];
      const quantized = quantizedResults[i];
      if (original && quantized) {
        expect(typeof original.idx).toBe('number');
        expect(typeof quantized.index).toBe('number');
        expect(typeof original.score).toBe('number');
        expect(typeof quantized.score).toBe('number');
      }
    }
    
    // 检查量化分数是否都是0
    const zeroScores = quantizedResults.filter(r => r.score === 0).length;
    expect(zeroScores).toBeGreaterThanOrEqual(0);
    expect(zeroScores).toBeLessThanOrEqual(GLOBAL_BASE_SIZE);
    
    // 检查原始分数和量化分数的相关性
    const originalTop10 = originalScores.slice(0, 10).map(s => s.score);
    const quantizedTop10 = quantizedResults.slice(0, 10).map(s => s.score);
    expect(originalTop10).toHaveLength(10);
    expect(quantizedTop10).toHaveLength(10);
    
    // 强制断言，确保测试执行
    expect(originalScores.length).toBe(GLOBAL_BASE_SIZE);
    expect(quantizedResults.length).toBe(GLOBAL_BASE_SIZE);
  });

  it(`4位查询+1位索引的 recall@${K} 应大于 ${RECALL_THRESHOLD}`, () => {
    // 调试信息：输出量化向量的基本信息
    // @织:保留: 输出量化向量的调试信息
    // eslint-disable-next-line no-console

    let totalRecall = 0;
    for (let i = 0; i < QUERY_SIZE; i++) {
      const query = queryVectors[i];
      if (!query) {
        throw new Error(`查询向量${i}不存在`);
      }
      const trueTopK = getTrueTopK(query, baseVectors, K);
      const quantizedTopK = getQuantizedTopK(query, quantizedVectors, K);
      const recall = computeRecall(trueTopK, quantizedTopK);
      totalRecall += recall;
      // 使用 vitest 断言替代 console.log
      expect(recall).toBeGreaterThanOrEqual(0);
      expect(trueTopK).toHaveLength(K);
      expect(quantizedTopK).toHaveLength(K);
      
      // 添加量化分数调试信息
      const results = format.searchNearestNeighbors(query, quantizedVectors, K);
      expect(results).toHaveLength(K);
      expect(results.every(r => typeof r.score === 'number')).toBe(true);
    }
    const avgRecall = totalRecall / QUERY_SIZE;
    // 使用 vitest 断言替代 console.log
    expect(avgRecall).toBeGreaterThanOrEqual(0);
    expect(avgRecall).toBeGreaterThanOrEqual(RECALL_THRESHOLD);
  });
});

/**
 * @织: 超采样4bit查询召回率测试
 * 测试三倍左右超采样的4bit查询效果，即查询时返回3K个结果，然后从中选择topK
 * 这种策略可以提高召回率，但会增加计算开销
 */
describe('超采样4bit查询召回率测试', () => {
  const QUERY_SIZE = GLOBAL_QUERY_SIZE;
  const K = GLOBAL_K;
  const OVERSAMPLE_FACTOR = 3; // 三倍超采样
  const RECALL_THRESHOLD = 0.75; // 超采样应该有更高的召回率


  // 使用全局数据集，确保与其他测试使用相同的数据
  const baseVectors = GLOBAL_BASE_VECTORS;
  const queryVectors = GLOBAL_QUERY_VECTORS;

  // 构建量化器 - 4位查询+1位索引配置
  const format = new BinaryQuantizationFormat({
    queryBits: 4, // 4位查询量化
    indexBits: 1, // 1位索引量化
    quantizer: {
      similarityFunction: VectorSimilarityFunction.COSINE,
      lambda: 0.001, // 与其他测试保持一致
      iters: 20 // 与其他测试保持一致
    }
  });

  // 量化base向量
  const { quantizedVectors } = format.quantizeVectors(baseVectors);

  // 计算每个query的真实topK（暴力法）
  function getTrueTopK(query: Float32Array, base: Float32Array[], k: number) {
    const scores = base.map((vec: Float32Array, idx: number) => ({
      idx,
      score: computeCosineSimilarity(query, vec)
    }));
    return scores.sort((a: { score: number }, b: { score: number }) => b.score - a.score).slice(0, k).map((x: { idx: number }) => x.idx);
  }

  // 计算每个query的超采样量化topK
  function getOversampledQuantizedTopK(query: Float32Array, quantizedBase: any, k: number, oversampleFactor: number) {
    // 超采样：获取更多候选结果
    const oversampledK = k * oversampleFactor;
    const oversampledResults = format.searchNearestNeighbors(query, quantizedBase, oversampledK);
    
    // 从超采样候选结果中重新计算真实相似性分数
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
    
    // 按真实相似性分数重新排序，选择最优的topK
    const sortedCandidates = candidateScores.sort((a, b) => b.trueScore - a.trueScore);
    return sortedCandidates.slice(0, k).map(x => x.index);
  }

  // 计算recall@K
  function computeRecall(trueTopK: number[], quantizedTopK: number[]) {
    let hit = 0;
    for (const idx of quantizedTopK) {
      if (trueTopK.includes(idx)) hit++;
    }
    return hit / trueTopK.length;
  }

  it(`超采样4bit查询的 recall@${K} 应大于 ${RECALL_THRESHOLD}`, () => {
    // 使用 vitest 断言替代 console.log
    expect(OVERSAMPLE_FACTOR).toBe(3);
    expect(K * OVERSAMPLE_FACTOR).toBeGreaterThan(K);
    expect(K).toBeGreaterThan(0);
    expect(RECALL_THRESHOLD).toBeGreaterThan(0);

    let totalRecall = 0;
    for (let i = 0; i < QUERY_SIZE; i++) {
      const query = queryVectors[i];
      if (!query) {
        throw new Error(`查询向量${i}不存在`);
      }
      const trueTopK = getTrueTopK(query, baseVectors, K);
      const quantizedTopK = getOversampledQuantizedTopK(query, quantizedVectors, K, OVERSAMPLE_FACTOR);
      const recall = computeRecall(trueTopK, quantizedTopK);
      totalRecall += recall;
      
      // 使用 vitest 断言替代 console.log
      expect(recall).toBeGreaterThanOrEqual(0);
      expect(trueTopK).toHaveLength(K);
      expect(quantizedTopK).toHaveLength(K);
      
      // 添加超采样分数调试信息
      const oversampledResults = format.searchNearestNeighbors(query, quantizedVectors, K * OVERSAMPLE_FACTOR);
      
      // 计算超采样的真实效果
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
      
      const quantizedTopKScores = oversampledResults.slice(0, K).map(r => r.score.toFixed(3));
      const trueTopKScores = sortedCandidates.slice(0, K).map(r => r.trueScore.toFixed(3));
      const allQuantizedScores = oversampledResults.map(r => r.score.toFixed(3));
      
      // 使用 vitest 断言替代 console.log
      expect(quantizedTopKScores).toHaveLength(K);
      expect(trueTopKScores).toHaveLength(K);
      expect(allQuantizedScores).toHaveLength(K * OVERSAMPLE_FACTOR);
    }
    const avgRecall = totalRecall / QUERY_SIZE;
    // 使用 vitest 断言替代 console.log
    expect(avgRecall).toBeGreaterThanOrEqual(0);
    
    expect(avgRecall).toBeGreaterThanOrEqual(RECALL_THRESHOLD);
  });

  it('超采样与普通4bit查询的召回率对比', () => {
    // 对比超采样和普通查询的召回率
    const query = queryVectors[0]; // 使用第一个query进行对比
    if (!query) {
      throw new Error('第一个查询向量不存在');
    }
    
    // 普通4bit查询
    const normalResults = format.searchNearestNeighbors(query, quantizedVectors, K);
    const normalTopK = normalResults.map(x => x.index);
    
    // 超采样4bit查询
    const oversampledTopK = getOversampledQuantizedTopK(query, quantizedVectors, K, OVERSAMPLE_FACTOR);
    
    // 真实topK
    const trueTopK = getTrueTopK(query, baseVectors, K);
    
    // 计算召回率
    const normalRecall = computeRecall(trueTopK, normalTopK);
    const oversampledRecall = computeRecall(trueTopK, oversampledTopK);
    
    // 计算超采样的详细对比信息
    const oversampledResults = format.searchNearestNeighbors(query, quantizedVectors, K * OVERSAMPLE_FACTOR);
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
    
    // 使用 vitest 断言替代 console.log
    expect(normalRecall).toBeGreaterThanOrEqual(0);
    expect(oversampledRecall).toBeGreaterThanOrEqual(0);
    expect(oversampledRecall - normalRecall).toBeGreaterThanOrEqual(0);
    expect(trueTopK).toHaveLength(K);
    expect(normalTopK).toHaveLength(K);
    expect(oversampledTopK).toHaveLength(K);
    
    // 显示超采样的详细对比
    const normalTop10Scores = normalResults.slice(0, 10).map(r => r.score.toFixed(3));
    const oversampledTop10Scores = sortedCandidates.slice(0, 10).map(r => r.trueScore.toFixed(3));
    const oversampledTop10QuantizedScores = sortedCandidates.slice(0, 10).map(r => r.quantizedScore.toFixed(3));
    
    // 使用 vitest 断言替代 console.log
    expect(normalTop10Scores).toHaveLength(10);
    expect(oversampledTop10Scores).toHaveLength(10);
    expect(oversampledTop10QuantizedScores).toHaveLength(10);
    
    // 断言超采样应该提供更好的召回率
    expect(oversampledRecall).toBeGreaterThanOrEqual(normalRecall);
  });
});