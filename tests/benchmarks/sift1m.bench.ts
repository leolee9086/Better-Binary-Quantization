import { describe, bench } from 'vitest';
import { join } from 'path';
import {
  loadSiftDataset,
  loadSiftQueries
} from './siftDataLoader';
import {
  BinaryQuantizationFormat,
  VectorSimilarityFunction
} from '../../src/index';
import { computeCosineSimilarity } from '../../src/vectorSimilarity';

/**
 * SIFT1M数据集性能测试
 * 测试重点：
 * 1. 量化性能 - 一次性操作
 * 2. 搜索性能 - 重复操作
 * 3. 内存使用情况
 */
describe('SIFT1M性能测试', () => {
  // 预加载数据 - 不计入性能测试
  const datasetDir = join(__dirname, '../../dataset/sift1m');
  const baseDataset = loadSiftDataset(datasetDir, 'base', 100000);
  const queryData = loadSiftQueries(datasetDir, 100);

  if (!baseDataset.vectors.length || !queryData.queries.length) {
    throw new Error('数据加载失败');
  }

  // 准备数据
  const baseVectors = baseDataset.vectors.map(v => v.values).filter((v): v is Float32Array => v !== undefined);
  const queryVectors = queryData.queries.map(v => v.values).filter((v): v is Float32Array => v !== undefined);

  if (!baseVectors.length || !queryVectors.length) {
    throw new Error('向量数据无效');
  }

  const k = 10; // topK

  // 创建量化格式实例
  const format = new BinaryQuantizationFormat({
    queryBits: 1,
    indexBits: 1,
    quantizer: {
      similarityFunction: VectorSimilarityFunction.COSINE,
      lambda: 0.001,
      iters: 20
    }
  });

  // 预量化基础向量 - 不计入性能测试
  const quantizedData = format.quantizeVectors(baseVectors);

  describe('量化性能', () => {
    bench('量化1000000个128维向量', () => {
      format.quantizeVectors(baseVectors);
    });
  });

  describe('单独搜索性能', () => {
    bench('量化搜索 - 单个查询', () => {
      const query = queryVectors[0];
      if (query) {
        format.searchNearestNeighbors(query, quantizedData.quantizedVectors, k);
      }
    });


    bench('暴力搜索 - 单个查询', () => {
      const scores = new Float32Array(baseVectors.length);
      const indices = new Int32Array(baseVectors.length);

      // 初始化索引
      for (let i = 0; i < baseVectors.length; i++) {
        indices[i] = i;
      }

      // 计算相似度
      const query = queryVectors[0];
      if (query) {
        for (let i = 0; i < baseVectors.length; i++) {
          const baseVector = baseVectors[i];
          if (baseVector) {
            scores[i] = computeCosineSimilarity(query, baseVector);
          } else {
            scores[i] = 0;
          }
        }

        // 选择前k个
        for (let i = 0; i < k; i++) {
          let maxIdx = i;
          for (let j = i + 1; j < baseVectors.length; j++) {
            const idxJ = indices[j];
            const idxMax = indices[maxIdx];
            if (idxJ !== undefined && idxMax !== undefined &&
              scores[idxJ] !== undefined && scores[idxMax] !== undefined &&
              scores[idxJ] > scores[idxMax]) {
              maxIdx = j;
            }
          }
          if (maxIdx !== i) {
            const temp = indices[i];
            const maxIdxValue = indices[maxIdx];
            if (temp !== undefined && maxIdxValue !== undefined) {
              indices[i] = maxIdxValue;
              indices[maxIdx] = temp;
            }
          }
        }
      }
    });
  });

});