import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { 
  loadSiftDataset, 
  loadSiftQueries, 
  type SiftVector 
} from './siftDataLoader';

describe('SIFT1M数据加载测试', () => {
  const datasetDir = join(__dirname, '../../dataset/sift1m');

  it('应该能加载基础向量', () => {
    const baseDataset = loadSiftDataset(datasetDir, 'base', 100);
    expect(baseDataset.count).toBe(100);
    expect(baseDataset.dimension).toBeGreaterThan(0);
    expect(baseDataset.vectors.length).toBe(100);
    expect(baseDataset.vectors[0]?.values).toBeInstanceOf(Float32Array);
  });

  it('应该能加载查询向量', () => {
    const queryDataset = loadSiftDataset(datasetDir, 'query', 10);
    expect(queryDataset.count).toBe(10);
    expect(queryDataset.dimension).toBeGreaterThan(0);
    expect(queryDataset.vectors.length).toBe(10);
  });

  it('应该能加载查询向量和真实标签', () => {
    const queryData = loadSiftQueries(datasetDir, 10);
    expect(queryData.queries.length).toBe(10);
    expect(queryData.groundtruth.length).toBe(10);
    expect(queryData.groundtruth[0]?.length).toBeGreaterThan(0);
  });
}); 