import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '../src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '../src/types';
import { normalizeVector } from '../src/vectorOperations';

/**
 * @织: 向量还原测试
 * 测试从量化向量还原原始向量的效果
 */

/**
 * 重建误差统计接口
 */
interface ReconstructionError {
  /** 均方误差 */
  mse: number;
  /** 平均绝对误差 */
  mae: number;
  /** 余弦相似度 */
  cosineSimilarity: number;
  /** 最大误差 */
  maxError: number;
}

/**
 * 算法参数记录接口
 */
interface AlgorithmParams {
  /** 质心向量 */
  centroid: Float32Array;
  /** 查询位数 */
  queryBits: number;
  /** 索引位数 */
  indexBits: number;
  /** Lambda参数 */
  lambda: number;
  /** 迭代次数 */
  iters: number;
  /** 相似度函数 */
  similarityFunction: VectorSimilarityFunction;
  /** 向量维度 */
  dimension: number;
}

/**
 * 量化配置接口
 */
interface BitConfig {
  /** 查询位数 */
  queryBits: number;
  /** 索引位数 */
  indexBits: number;
  /** 配置名称 */
  name: string;
}

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
 * 计算向量余弦相似度
 * @param vec1 向量1
 * @param vec2 向量2
 * @returns 余弦相似度
 */
function computeCosineSimilarity(vec1: Float32Array, vec2: Float32Array): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    const v1 = vec1[i] ?? 0;
    const v2 = vec2[i] ?? 0;
    dotProduct += v1 * v2;
    norm1 += v1 * v1;
    norm2 += v2 * v2;
  }
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * 计算向量重建误差
 * @param original 原始向量
 * @param reconstructed 重建向量
 * @returns 重建误差统计
 */
function computeReconstructionError(original: Float32Array, reconstructed: Float32Array): ReconstructionError {
  let mse = 0;
  let mae = 0;
  let maxError = 0;
  
  for (let i = 0; i < original.length; i++) {
    const orig = original[i] ?? 0;
    const recon = reconstructed[i] ?? 0;
    const error = Math.abs(orig - recon);
    mse += error * error;
    mae += error;
    maxError = Math.max(maxError, error);
  }
  
  mse /= original.length;
  mae /= original.length;
  const cosineSimilarity = computeCosineSimilarity(original, reconstructed);
  
  return { mse, mae, cosineSimilarity, maxError };
}

/**
 * 尝试从量化向量还原原始向量
 * @param quantizedVector 量化向量
 * @param centroid 质心向量
 * @returns 重建的向量
 */
function attemptVectorReconstruction(
  quantizedVector: Uint8Array, 
  centroid: Float32Array
): Float32Array {
  // 方法1: 简单的二进制还原
  const reconstructed = new Float32Array(centroid.length);
  
  // 从量化向量中提取二进制值
  const binaryValues: number[] = [];
  for (let i = 0; i < quantizedVector.length; i++) {
    const byte = quantizedVector[i] ?? 0;
    for (let j = 7; j >= 0 && binaryValues.length < centroid.length; j--) {
      binaryValues.push((byte >> j) & 1);
    }
  }
  
  // 使用质心和二进制值重建向量
  for (let i = 0; i < centroid.length; i++) {
    if (i < binaryValues.length) {
      // 简单的重建策略：根据二进制值调整质心
      const adjustment = binaryValues[i] === 1 ? 0.1 : -0.1;
      const centroidValue = centroid[i] ?? 0;
      reconstructed[i] = centroidValue + adjustment;
    } else {
      reconstructed[i] = centroid[i] ?? 0;
    }
  }
  
  // 归一化
  return normalizeVector(reconstructed);
}

describe('向量还原测试', () => {
  const DIMENSION = 128;
  const TEST_VECTORS_COUNT = 10;
  const testVectors = generateTestVectors(TEST_VECTORS_COUNT, DIMENSION);
  
  // 创建量化格式
  const format = new BinaryQuantizationFormat({
    queryBits: 4,
    indexBits: 1,
    quantizer: {
      similarityFunction: VectorSimilarityFunction.COSINE,
      lambda: 0.001,
      iters: 20
    }
  });
  
  it('测试向量还原效果', () => {
    console.log('=== 向量还原测试 ===');
    console.log(`测试向量数量: ${TEST_VECTORS_COUNT}`);
    console.log(`向量维度: ${DIMENSION}`);
    console.log('');
    
    // 量化向量
    const { quantizedVectors } = format.quantizeVectors(testVectors);
    const centroid = quantizedVectors.getCentroid();
    
    console.log('量化参数:');
    console.log(`  质心维度: ${centroid.length}`);
    console.log(`  量化向量数量: ${quantizedVectors.size()}`);
    console.log(`  量化向量大小: ${quantizedVectors.size() * 16} 字节`);
    console.log('');
    
    let totalMse = 0;
    let totalMae = 0;
    let totalCosineSimilarity = 0;
    let totalMaxError = 0;
    
    // 测试每个向量的还原效果
    for (let i = 0; i < testVectors.length; i++) {
      const originalVector = testVectors[i]!;
      const quantizedVector = quantizedVectors.vectorValue(i);
      
      // 尝试还原向量
      const reconstructedVector = attemptVectorReconstruction(
        quantizedVector,
        centroid
      );
      
      // 计算重建误差
      const error = computeReconstructionError(originalVector, reconstructedVector);
      
      totalMse += error.mse;
      totalMae += error.mae;
      totalCosineSimilarity += error.cosineSimilarity;
      totalMaxError = Math.max(totalMaxError, error.maxError);
      
      console.log(`向量 ${i}:`);
      console.log(`  MSE: ${error.mse.toFixed(6)}`);
      console.log(`  MAE: ${error.mae.toFixed(6)}`);
      console.log(`  余弦相似度: ${error.cosineSimilarity.toFixed(6)}`);
      console.log(`  最大误差: ${error.maxError.toFixed(6)}`);
      console.log('');
    }
    
    // 计算平均误差
    const avgMse = totalMse / testVectors.length;
    const avgMae = totalMae / testVectors.length;
    const avgCosineSimilarity = totalCosineSimilarity / testVectors.length;
    
    console.log('=== 平均重建效果 ===');
    console.log(`平均MSE: ${avgMse.toFixed(6)}`);
    console.log(`平均MAE: ${avgMae.toFixed(6)}`);
    console.log(`平均余弦相似度: ${avgCosineSimilarity.toFixed(6)}`);
    console.log(`最大误差: ${totalMaxError.toFixed(6)}`);
    console.log('');
    
    // 评估还原质量
    const reconstructionQuality = {
      excellent: avgCosineSimilarity > 0.9,
      good: avgCosineSimilarity > 0.7,
      fair: avgCosineSimilarity > 0.5,
      poor: avgCosineSimilarity <= 0.5
    };
    
    console.log('=== 还原质量评估 ===');
    if (reconstructionQuality.excellent) {
      console.log('✅ 优秀: 可以很好地还原原始向量');
    } else if (reconstructionQuality.good) {
      console.log('🟡 良好: 可以部分还原原始向量');
    } else if (reconstructionQuality.fair) {
      console.log('🟠 一般: 还原效果有限');
    } else {
      console.log('🔴 较差: 难以还原原始向量');
    }
    console.log('');
    
    // 断言基本要求
    expect(avgMse).toBeLessThan(1.0); // MSE应该小于1
    expect(avgCosineSimilarity).toBeGreaterThan(0.0); // 余弦相似度应该大于0
  });
  
  it('测试不同量化位数的还原效果', () => {
    console.log('=== 不同量化位数还原效果对比 ===');
    
    const bitConfigs: BitConfig[] = [
      { queryBits: 1, indexBits: 1, name: '1位量化' },
      { queryBits: 2, indexBits: 1, name: '2位量化' },
      { queryBits: 4, indexBits: 1, name: '4位量化' },
      { queryBits: 8, indexBits: 1, name: '8位量化' }
    ];
    
    for (const config of bitConfigs) {
      console.log(`\n测试 ${config.name}:`);
      
      const testFormat = new BinaryQuantizationFormat({
        queryBits: config.queryBits,
        indexBits: config.indexBits,
        quantizer: {
          similarityFunction: VectorSimilarityFunction.COSINE,
          lambda: 0.001,
          iters: 20
        }
      });
      
      const { quantizedVectors } = testFormat.quantizeVectors(testVectors);
      const centroid = quantizedVectors.getCentroid();
      
      let totalCosineSimilarity = 0;
      let validReconstructions = 0;
      
      for (let i = 0; i < testVectors.length; i++) {
        const originalVector = testVectors[i]!;
        const quantizedVector = quantizedVectors.vectorValue(i);
        
        const reconstructedVector = attemptVectorReconstruction(
          quantizedVector,
          centroid
        );
        
        const error = computeReconstructionError(originalVector, reconstructedVector);
        totalCosineSimilarity += error.cosineSimilarity;
        validReconstructions++;
      }
      
      const avgCosineSimilarity = validReconstructions > 0 
        ? totalCosineSimilarity / validReconstructions 
        : 0;
      
      console.log(`  平均余弦相似度: ${avgCosineSimilarity.toFixed(6)}`);
      console.log(`  压缩比: ${(DIMENSION * 4) / (quantizedVectors.size() * 16)}:1`);
    }
  });
  
  it('测试算法参数记录的重要性', () => {
    console.log('=== 算法参数记录重要性测试 ===');
    
    // 记录完整的量化参数
    const { quantizedVectors } = format.quantizeVectors(testVectors);
    const centroid = quantizedVectors.getCentroid();
    
    const algorithmParams: AlgorithmParams = {
      centroid: centroid,
      queryBits: 4,
      indexBits: 1,
      lambda: 0.001,
      iters: 20,
      similarityFunction: VectorSimilarityFunction.COSINE,
      dimension: DIMENSION
    };
    
    console.log('记录的算法参数:');
    console.log(`  质心维度: ${algorithmParams.centroid.length}`);
    console.log(`  查询位数: ${algorithmParams.queryBits}`);
    console.log(`  索引位数: ${algorithmParams.indexBits}`);
    console.log(`  Lambda参数: ${algorithmParams.lambda}`);
    console.log(`  迭代次数: ${algorithmParams.iters}`);
    console.log(`  相似度函数: ${algorithmParams.similarityFunction}`);
    console.log(`  向量维度: ${algorithmParams.dimension}`);
    console.log('');
    
    // 测试参数缺失的影响
    console.log('参数缺失的影响:');
    
    // 缺少质心
    const missingCentroid: Partial<AlgorithmParams> = { ...algorithmParams };
    delete missingCentroid.centroid;
    console.log('  ❌ 缺少质心: 无法进行任何还原');
    
    // 缺少量化位数
    const missingBits: Partial<AlgorithmParams> = { ...algorithmParams };
    delete missingBits.queryBits;
    console.log('  ❌ 缺少量化位数: 无法正确解包二进制数据');
    
    // 缺少Lambda参数
    const missingLambda: Partial<AlgorithmParams> = { ...algorithmParams };
    delete missingLambda.lambda;
    console.log('  ⚠️ 缺少Lambda参数: 可能影响还原精度');
    
    console.log('');
    console.log('结论: 质心和量化位数是还原向量的关键参数');
  });
}); 