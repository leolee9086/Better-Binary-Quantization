import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { 
  loadSiftDataset, 
  loadSiftQueries
} from './siftDataLoader';
import { 
  quickQuantize, 
  quickSearch 
} from '../../src/index';

describe('SIFT1M简单功能测试', () => {
  const datasetDir = join(__dirname, '../../dataset/sift1m');

  it('应该能正确量化和搜索', () => {
    // 加载少量数据进行测试
    const baseDataset = loadSiftDataset(datasetDir, 'base', 100);
    const queryData = loadSiftQueries(datasetDir, 10);
    
    console.log(`📊 基础向量: ${baseDataset.count} 个 ${baseDataset.dimension} 维`);
    console.log(`📊 查询向量: ${queryData.queries.length} 个`);
    
    // 测试量化
    const vectors = baseDataset.vectors.map(v => v.values);
    const quantizedResult = quickQuantize(vectors);
    console.log('📊 量化结果:', quantizedResult);
    
    // 测试搜索
    const queryVector = queryData.queries[0]?.values;
    if (!queryVector) {
      throw new Error('查询向量为空');
    }
    const searchResult = quickSearch(queryVector, vectors, 5);
    console.log('📊 搜索结果:', searchResult);
    
    expect(quantizedResult).toBeDefined();
    expect(searchResult).toBeDefined();
    expect(searchResult.length).toBeGreaterThan(0);
  });
}); 