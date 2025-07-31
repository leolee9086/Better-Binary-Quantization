import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '../src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '../src/types';
import { normalizeVector } from '../src/vectorOperations';

/**
 * @织: 量化索引构建时间成本测试
 * 详细分析不同规模下量化索引构建的时间成本
 */

/**
 * 生成测试向量
 * @param count 向量数量
 * @param dimension 向量维度
 * @returns 生成的测试向量数组
 */
function generateTestVectors(count: number, dimension: number): Float32Array[] {
  const vectors: Float32Array[] = [];
  for (let i = 0; i < count; i++) {
    const vector = new Float32Array(dimension);
    for (let j = 0; j < dimension; j++) {
      vector[j] = Math.random() * 2 - 1; // [-1, 1]
    }
    vectors.push(normalizeVector(vector));
  }
  return vectors;
}

/**
 * 性能测量结果接口
 */
interface PerformanceResult<T> {
  /** 执行结果 */
  result: T;
  /** 平均执行时间 */
  avgTime: number;
  /** 总执行时间 */
  totalTime: number;
}

/**
 * 性能测量工具
 * @param name 测试名称
 * @param fn 执行函数
 * @param iterations 迭代次数
 * @returns 性能测量结果
 */
function measureBuildTime<T>(name: string, fn: () => T, iterations: number = 1): PerformanceResult<T> {
  const start = performance.now();
  let result: T;
  
  for (let i = 0; i < iterations; i++) {
    result = fn();
  }
  
  const end = performance.now();
  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  
  console.log(`📊 ${name}: ${avgTime.toFixed(2)}ms (${iterations}次迭代, 总计${totalTime.toFixed(2)}ms)`);
  
  return { result: result!, avgTime, totalTime };
}

/**
 * 量化配置接口
 */
interface QuantizationConfig {
  /** 配置名称 */
  name: string;
  /** 查询位数 */
  queryBits: number;
  /** 索引位数 */
  indexBits: number;
}

describe('量化索引构建时间成本测试', () => {
  describe('不同规模向量的构建时间', () => {
    const dimensions = [64, 128, 256, 512];
    const vectorCounts = [100, 1000, 10000, 50000];
    
    for (const dim of dimensions) {
      for (const count of vectorCounts) {
        // 限制大规模测试以避免内存问题
        if (count * dim > 10000000) continue; // 限制内存使用
        
        it(`构建 ${count}个${dim}维向量的量化索引`, () => {
          const vectors = generateTestVectors(count, dim);
          
          const { result } = measureBuildTime(
            `构建${count}个${dim}维向量量化索引`,
            () => {
              const format = new BinaryQuantizationFormat({
                queryBits: 4,
                indexBits: 1,
                quantizer: {
                  similarityFunction: VectorSimilarityFunction.COSINE,
                  lambda: 0.001,
                  iters: 20
                }
              });
              
              return format.quantizeVectors(vectors);
            },
            1 // 大规模测试只运行一次
          );
          
          // 验证结果
          expect(result).toHaveProperty('quantizedVectors');
          expect(result).toHaveProperty('queryQuantizer');
          expect(result.quantizedVectors.size()).toBe(count);
          
          // 计算构建速度
          console.log(`  内存压缩比: ${(dim * 4) / (dim / 8)}:1 (${dim}维浮点 -> ${dim/8}字节)`);
        });
      }
    }
  });
  
  describe('不同量化配置的构建时间', () => {
    const vectors = generateTestVectors(1000, 128);
    
    const configs: QuantizationConfig[] = [
      { name: '1位查询+1位索引', queryBits: 1, indexBits: 1 },
      { name: '4位查询+1位索引', queryBits: 4, indexBits: 1 },
      { name: '4位查询+2位索引', queryBits: 4, indexBits: 2 },
      { name: '8位查询+1位索引', queryBits: 8, indexBits: 1 }
    ];
    
    for (const config of configs) {
      it(`${config.name}配置的构建时间`, () => {
        const { result } = measureBuildTime(
          `${config.name}配置构建`,
          () => {
            const format = new BinaryQuantizationFormat({
              queryBits: config.queryBits,
              indexBits: config.indexBits,
              quantizer: {
                similarityFunction: VectorSimilarityFunction.COSINE,
                lambda: 0.001,
                iters: 20
              }
            });
            
            return format.quantizeVectors(vectors);
          },
          5 // 运行5次取平均
        );
        
        expect(result).toHaveProperty('quantizedVectors');
        
        // 计算压缩比
        const originalSize = 128 * 4; // 128维 * 4字节
        const compressedSize = 128 / 8; // 128位 / 8位每字节
        const compressionRatio = originalSize / compressedSize;
        
        console.log(`  压缩比: ${compressionRatio}:1`);
        console.log(`  压缩后大小: ${compressedSize}字节/向量`);
      });
    }
  });
  
  describe('质心计算时间分析', () => {
    const vectors = generateTestVectors(10000, 128);
    
    it('精确质心计算时间', () => {
      const { avgTime } = measureBuildTime(
        '精确质心计算',
        () => {
          const dimension = vectors[0]!.length;
          const centroid = new Float32Array(dimension);
          
          for (const vector of vectors) {
            for (let d = 0; d < dimension; d++) {
              const value = vector[d] ?? 0;
              centroid[d] = (centroid[d] ?? 0) + value;
            }
          }
          
          for (let d = 0; d < dimension; d++) {
            centroid[d] = (centroid[d] ?? 0) / vectors.length;
          }
          
          return centroid;
        },
        10
      );
      
      console.log(`  质心计算速度: ${(vectors.length / avgTime * 1000).toFixed(0)} 向量/秒`);
    });
    
    it('蒙特卡洛质心估算时间', () => {
      const sampleSizes = [100, 500, 1000, 2000];
      
      for (const sampleSize of sampleSizes) {
        const { avgTime } = measureBuildTime(
          `蒙特卡洛质心估算(采样${sampleSize})`,
          () => {
            const dimension = vectors[0]!.length;
            const estimatedCentroid = new Float32Array(dimension);
            
            // 随机采样
            const sampledIndices = new Set<number>();
            while (sampledIndices.size < sampleSize) {
              sampledIndices.add(Math.floor(Math.random() * vectors.length));
            }
            
            // 计算采样质心
            for (const index of sampledIndices) {
              const vector = vectors[index]!;
              for (let d = 0; d < dimension; d++) {
                const value = vector[d] ?? 0;
                estimatedCentroid[d] = (estimatedCentroid[d] ?? 0) + value;
              }
            }
            
            for (let d = 0; d < dimension; d++) {
              estimatedCentroid[d] = (estimatedCentroid[d] ?? 0) / sampleSize;
            }
            
            return estimatedCentroid;
          },
          10
        );
        
        const speedup = (vectors.length / avgTime) / (vectors.length / 0.1); // 假设精确计算0.1ms
        console.log(`  采样${sampleSize}: ${speedup.toFixed(1)}x加速`);
      }
    });
  });
  
  describe('增量构建时间分析', () => {
    const baseVectors = generateTestVectors(5000, 128);
    const newVectors = generateTestVectors(1000, 128);
    
    it('全量重建 vs 增量构建时间对比', () => {
      // 全量重建
      const { avgTime: fullRebuildTime } = measureBuildTime(
        '全量重建(6000向量)',
        () => {
          const format = new BinaryQuantizationFormat({
            queryBits: 4,
            indexBits: 1,
            quantizer: {
              similarityFunction: VectorSimilarityFunction.COSINE,
              lambda: 0.001,
              iters: 20
            }
          });
          
          return format.quantizeVectors([...baseVectors, ...newVectors]);
        },
        3
      );
      
      // 基础构建
      const { avgTime: baseBuildTime } = measureBuildTime(
        '基础构建(5000向量)',
        () => {
          const format = new BinaryQuantizationFormat({
            queryBits: 4,
            indexBits: 1,
            quantizer: {
              similarityFunction: VectorSimilarityFunction.COSINE,
              lambda: 0.001,
              iters: 20
            }
          });
          
          return format.quantizeVectors(baseVectors);
        },
        3
      );
      
      // 增量构建（模拟）
      const { avgTime: incrementalTime } = measureBuildTime(
        '增量构建(1000向量)',
        () => {
          // 模拟增量构建：只处理新向量
          const format = new BinaryQuantizationFormat({
            queryBits: 4,
            indexBits: 1,
            quantizer: {
              similarityFunction: VectorSimilarityFunction.COSINE,
              lambda: 0.001,
              iters: 20
            }
          });
          
          return format.quantizeVectors(newVectors);
        },
        3
      );
      
      console.log(`  全量重建时间: ${fullRebuildTime.toFixed(2)}ms`);
      console.log(`  基础构建时间: ${baseBuildTime.toFixed(2)}ms`);
      console.log(`  增量构建时间: ${incrementalTime.toFixed(2)}ms`);
      console.log(`  增量构建节省: ${((fullRebuildTime - incrementalTime) / fullRebuildTime * 100).toFixed(1)}%`);
    });
  });
  
  describe('内存使用分析', () => {
    const vectors = generateTestVectors(10000, 128);
    
    it('构建过程中的内存使用', () => {
      const initialMemory = (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
      
      const { result } = measureBuildTime(
        '内存使用测试',
        () => {
          const format = new BinaryQuantizationFormat({
            queryBits: 4,
            indexBits: 1,
            quantizer: {
              similarityFunction: VectorSimilarityFunction.COSINE,
              lambda: 0.001,
              iters: 20
            }
          });
          
          return format.quantizeVectors(vectors);
        },
        1
      );
      
      const finalMemory = (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      if ((performance as any).memory) {
        console.log(`  内存增加: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  原始数据大小: ${(vectors.length * 128 * 4 / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  量化后大小: ${(result.quantizedVectors.size() * 128 / 8 / 1024 / 1024).toFixed(2)}MB`);
      }
      
      expect(result).toHaveProperty('quantizedVectors');
    });
  });
}); 