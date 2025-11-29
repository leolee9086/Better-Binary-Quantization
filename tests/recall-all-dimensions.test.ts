import { describe, it, expect } from 'vitest';
import { 
  RECALL_TEST_CONFIGS, 
  createFixedDataset, 
  executeRecallTest, 
  executeOversampledRecallTest 
} from './recall-common';

/**
 * @织: 全维度召回率测试
 * 本测试使用通用工具测试所有常见嵌入引擎维度的召回率
 * 包括：384d、768d、1024d、1536d
 * 测试配置：1位、4位、8位查询 + 超采样策略
 */

describe('全维度召回率测试', () => {
  // 为每个维度创建数据集
  const datasets: Record<string, { baseVectors: Float32Array[]; queryVectors: Float32Array[] }> = {};
  
  // 初始化所有数据集
  for (const [dimensionKey, config] of Object.entries(RECALL_TEST_CONFIGS)) {
    datasets[dimensionKey] = createFixedDataset(config);
  }

  // 测试每个维度
  for (const [dimensionKey, config] of Object.entries(RECALL_TEST_CONFIGS)) {
    const dataset = datasets[dimensionKey];
    if (!dataset) continue;
    const { baseVectors, queryVectors } = dataset;
    
    describe(`${dimensionKey}维度测试`, () => {
      it('数据集验证', () => {
        expect(baseVectors.length).toBe(config.baseSize);
        expect(queryVectors.length).toBe(config.querySize);
        expect(baseVectors[0]?.length).toBe(config.dimension);
        expect(queryVectors[0]?.length).toBe(config.dimension);
        
        // eslint-disable-next-line no-console
        console.log(`${dimensionKey}数据集信息:`);
        // eslint-disable-next-line no-console
        console.log('- 维度:', config.dimension);
        // eslint-disable-next-line no-console
        console.log('- Base向量数量:', config.baseSize);
        // eslint-disable-next-line no-console
        console.log('- Query向量数量:', config.querySize);
      });

      describe('1位查询 + 1位索引', () => {
        it(`1位查询的 recall@${config.k} 应大于 ${config.recallThreshold1bit}`, () => {
          const avgRecall = executeRecallTest(
            config,
            1, // queryBits
            1, // indexBits
            baseVectors,
            queryVectors,
            `${dimensionKey}-1bit`
          );
          expect(avgRecall).toBeGreaterThanOrEqual(config.recallThreshold1bit);
        });
      });

      describe('4位查询 + 1位索引', () => {
        it(`4位查询的 recall@${config.k} 应大于 ${config.recallThreshold4bit}`, () => {
          const avgRecall = executeRecallTest(
            config,
            4, // queryBits
            1, // indexBits
            baseVectors,
            queryVectors,
            `${dimensionKey}-4bit`
          );
          expect(avgRecall).toBeGreaterThanOrEqual(config.recallThreshold4bit);
        });
      });



      describe('超采样4位查询', () => {
        it(`超采样4位查询的 recall@${config.k} 应大于 ${config.recallThresholdOversample}`, () => {
          const avgRecall = executeOversampledRecallTest(
            config,
            baseVectors,
            queryVectors,
            `${dimensionKey}-oversample`
          );
          expect(avgRecall).toBeGreaterThanOrEqual(config.recallThresholdOversample);
        });
      });
    });
  }

  // 跨维度性能对比测试
  describe('跨维度性能对比', () => {
    it('不同维度的4位查询召回率对比', () => {
      const results: Record<string, number> = {};
      
      for (const [dimensionKey, config] of Object.entries(RECALL_TEST_CONFIGS)) {
        const dataset = datasets[dimensionKey];
        if (!dataset) continue;
        const { baseVectors, queryVectors } = dataset;
        const avgRecall = executeRecallTest(
          config,
          4, // queryBits
          1, // indexBits
          baseVectors,
          queryVectors,
          `${dimensionKey}-4bit-comparison`
        );
        results[dimensionKey] = avgRecall;
      }
      
      // eslint-disable-next-line no-console
      console.log('=== 跨维度4位查询召回率对比 ===');
      for (const [dimensionKey, recall] of Object.entries(results)) {
        // eslint-disable-next-line no-console
        console.log(`${dimensionKey}: ${recall.toFixed(3)}`);
      }
      
      // 验证召回率随维度增加而降低的趋势
      const dimensions = Object.keys(results).sort();
      for (let i = 1; i < dimensions.length; i++) {
        const prevDimension = dimensions[i - 1];
        const currDimension = dimensions[i];
        if (!prevDimension || !currDimension) continue;
        const prevRecall = results[prevDimension];
        const currRecall = results[currDimension];
        if (prevRecall !== undefined && currRecall !== undefined) {
          // 高维度召回率应该低于或等于低维度（考虑到随机性，允许相等）
          expect(currRecall).toBeLessThanOrEqual(prevRecall + 0.1); // 允许10%的容差
        }
      }
    });

    it('不同维度的超采样召回率对比', () => {
      const results: Record<string, number> = {};
      
      for (const [dimensionKey, config] of Object.entries(RECALL_TEST_CONFIGS)) {
        const dataset = datasets[dimensionKey];
        if (!dataset) continue;
        const { baseVectors, queryVectors } = dataset;
        const avgRecall = executeOversampledRecallTest(
          config,
          baseVectors,
          queryVectors,
          `${dimensionKey}-oversample-comparison`
        );
        results[dimensionKey] = avgRecall;
      }
      
      // eslint-disable-next-line no-console
      console.log('=== 跨维度超采样召回率对比 ===');
      for (const [dimensionKey, recall] of Object.entries(results)) {
        // eslint-disable-next-line no-console
        console.log(`${dimensionKey}: ${recall.toFixed(3)}`);
      }
      
      // 验证超采样能提高召回率
      for (const [dimensionKey, config] of Object.entries(RECALL_TEST_CONFIGS)) {
        const dataset = datasets[dimensionKey];
        if (!dataset) continue;
        const { baseVectors, queryVectors } = dataset;
        const normalRecall = executeRecallTest(
          config,
          4, // queryBits
          1, // indexBits
          baseVectors,
          queryVectors,
          `${dimensionKey}-4bit-vs-oversample`
        );
        const oversampledRecall = results[dimensionKey];
        
        // 超采样召回率应该大于等于普通4位查询
        expect(oversampledRecall).toBeGreaterThanOrEqual(normalRecall - 0.05); // 允许5%的容差
      }
    });
  });
}); 