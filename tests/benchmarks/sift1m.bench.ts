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
  const baseDataset = loadSiftDataset(datasetDir, 'base', 10000);
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
    queryBits: 4,
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
    bench('量化10000个128维向量', () => {
      format.quantizeVectors(baseVectors);
    });
  });

  describe('搜索性能', () => {
    bench('量化搜索 - 单个查询', () => {
      format.searchNearestNeighbors(queryVectors[0], quantizedData.quantizedVectors, k);
    });

    bench('量化搜索 - 批量查询', () => {
      for (const query of queryVectors) {
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
      for (let i = 0; i < baseVectors.length; i++) {
        scores[i] = computeCosineSimilarity(queryVectors[0], baseVectors[i]);
      }

      // 选择前k个
      for (let i = 0; i < k; i++) {
        let maxIdx = i;
        for (let j = i + 1; j < baseVectors.length; j++) {
          if (scores[indices[j]] > scores[indices[maxIdx]]) {
            maxIdx = j;
          }
        }
        if (maxIdx !== i) {
          const temp = indices[i];
          indices[i] = indices[maxIdx];
          indices[maxIdx] = temp;
        }
      }
    });

    bench('暴力搜索 - 批量查询', () => {
      const scores = new Float32Array(baseVectors.length);
      const indices = new Int32Array(baseVectors.length);
      
      // 初始化索引
      for (let i = 0; i < baseVectors.length; i++) {
        indices[i] = i;
      }

      for (const query of queryVectors) {
        // 计算相似度
        for (let i = 0; i < baseVectors.length; i++) {
          scores[i] = computeCosineSimilarity(query, baseVectors[i]);
        }

        // 选择前k个
        for (let i = 0; i < k; i++) {
          let maxIdx = i;
          for (let j = i + 1; j < baseVectors.length; j++) {
            if (scores[indices[j]] > scores[indices[maxIdx]]) {
              maxIdx = j;
            }
          }
          if (maxIdx !== i) {
            const temp = indices[i];
            indices[i] = indices[maxIdx];
            indices[maxIdx] = temp;
          }
        }
      }
    });
  });

  describe('内存分析', () => {
    bench('内存压缩比', () => {
      // 原始数据大小（字节）
      const originalSize = baseVectors.length * baseVectors[0].length * 4; // 4字节/浮点数
      
      // 量化数据大小（字节）
      const quantizedSize = quantizedData.quantizedVectors.size() * quantizedData.quantizedVectors.vectorValue(0).length;
      
      console.log(`压缩比: ${(originalSize / quantizedSize).toFixed(2)}:1`);
    });
  });
});