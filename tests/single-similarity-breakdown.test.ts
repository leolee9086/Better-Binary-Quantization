import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '../src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '../src/types';
import { normalizeVector } from '../src/vectorOperations';
import { computeInt1BitDotProduct, computeInt4BitDotProduct } from '../src/bitwiseDotProduct';

/**
 * @织: 单个相似度计算步骤分解测试
 * 分解单个相似度计算的内部步骤并计时
 */

/**
 * 生成测试向量
 */
function generateVectors(count: number, dimension: number): Float32Array[] {
  const vectors: Float32Array[] = [];
  for (let i = 0; i < count; i++) {
    const vector = new Float32Array(dimension);
    for (let j = 0; j < dimension; j++) {
      vector[j] = (Math.random() - 0.5) * 2; // [-1, 1]
    }
    vectors.push(vector);
  }
  return vectors;
}

describe('单个相似度计算步骤分解测试', () => {
  it('1bit量化单个相似度计算步骤分解', () => {
    // 测试参数
    const dim = 1024;
    const baseSize = 100;
    const vectors = generateVectors(baseSize, dim);
    const queryVector = generateVectors(1, dim)[0]!;
    
    // 构建量化索引
    const format = new BinaryQuantizationFormat({
      queryBits: 1,
      indexBits: 1,
      quantizer: {
        similarityFunction: VectorSimilarityFunction.COSINE,
        lambda: 0.01,
        iters: 20
      }
    });
    const { quantizedVectors } = format.quantizeVectors(vectors);
    
    // 准备查询
    const normalizedQuery = normalizeVector(queryVector);
    const centroid = quantizedVectors.getCentroid();
    const { quantizedQuery, queryCorrections } = format.quantizeQueryVector(normalizedQuery, centroid);
    
    // 选择第一个向量进行测试
    const targetOrd = 0;
    
    console.log('\n🔍 1bit量化单个相似度计算步骤分解');
    console.log('='.repeat(60));
    
    // 步骤1: 获取未打包的索引向量
    const step1Start = performance.now();
    const unpackedBinaryCode = quantizedVectors.getUnpackedVector(targetOrd);
    const step1Time = performance.now() - step1Start;
    console.log(`步骤1 - 获取未打包索引向量: ${step1Time.toFixed(3)}ms`);
    console.log(`  向量长度: ${unpackedBinaryCode.length} 字节`);
    
    // 步骤2: 1bit点积计算
    const step2Start = performance.now();
    const qcDist = computeInt1BitDotProduct(quantizedQuery, unpackedBinaryCode);
    const step2Time = performance.now() - step2Start;
    console.log(`步骤2 - 1bit点积计算: ${step2Time.toFixed(3)}ms`);
    console.log(`  点积结果: ${qcDist}`);
    
    // 步骤3: 获取索引向量修正因子
    const step3Start = performance.now();
    const indexCorrections = quantizedVectors.getCorrectiveTerms(targetOrd);
    const step3Time = performance.now() - step3Start;
    console.log(`步骤3 - 获取索引修正因子: ${step3Time.toFixed(3)}ms`);
    console.log(`  修正因子: ${JSON.stringify(indexCorrections)}`);
    
    // 步骤4: 获取质心点积
    const step4Start = performance.now();
    const centroidDP = quantizedVectors.getCentroidDP();
    const step4Time = performance.now() - step4Start;
    console.log(`步骤4 - 获取质心点积: ${step4Time.toFixed(3)}ms`);
    console.log(`  质心点积: ${centroidDP}`);
    
    // 步骤5: 相似度分数计算（四项公式）
    const step5Start = performance.now();
    
    // 手动实现四项公式计算
    const x1 = indexCorrections.quantizedComponentSum;
    const ax = indexCorrections.lowerInterval;
    const lx = indexCorrections.upperInterval - ax;
    const ay = queryCorrections.lowerInterval;
    const ly = queryCorrections.upperInterval - ay;
    const y1 = queryCorrections.quantizedComponentSum;
    
    // 四项公式：score = ax * ay * dimension + ay * lx * x1 + ax * ly * y1 + lx * ly * qcDist
    let score = ax * ay * dim + ay * lx * x1 + ax * ly * y1 + lx * ly * qcDist;
    
    // 余弦相似度调整
    score += queryCorrections.additionalCorrection + indexCorrections.additionalCorrection - centroidDP;
    const finalScore = Math.max((1 + score) / 2, 0);
    
    const step5Time = performance.now() - step5Start;
    console.log(`步骤5 - 相似度分数计算: ${step5Time.toFixed(3)}ms`);
    console.log(`  最终分数: ${finalScore.toFixed(6)}`);
    
    // 总时间统计
    const totalTime = step1Time + step2Time + step3Time + step4Time + step5Time;
    console.log('\n📊 时间分布:');
    console.log(`总时间: ${totalTime.toFixed(3)}ms`);
    console.log(`步骤1 (向量获取): ${((step1Time / totalTime) * 100).toFixed(1)}%`);
    console.log(`步骤2 (点积计算): ${((step2Time / totalTime) * 100).toFixed(1)}%`);
    console.log(`步骤3 (修正获取): ${((step3Time / totalTime) * 100).toFixed(1)}%`);
    console.log(`步骤4 (质心获取): ${((step4Time / totalTime) * 100).toFixed(1)}%`);
    console.log(`步骤5 (分数计算): ${((step5Time / totalTime) * 100).toFixed(1)}%`);
    
    // 验证结果
    const scorer = format.getScorer();
    const expectedResult = scorer.computeQuantizedScore(
      quantizedQuery,
      queryCorrections,
      quantizedVectors,
      targetOrd,
      1
    );
    
    console.log(`\n✅ 验证结果:`);
    console.log(`期望分数: ${expectedResult.score.toFixed(6)}`);
    console.log(`计算分数: ${finalScore.toFixed(6)}`);
    console.log(`差异: ${Math.abs(expectedResult.score - finalScore).toFixed(8)}`);
    
    expect(Math.abs(expectedResult.score - finalScore)).toBeLessThan(1e-6);
  });

  it('4bit量化单个相似度计算步骤分解', () => {
    // 测试参数
    const dim = 1024;
    const baseSize = 100;
    const vectors = generateVectors(baseSize, dim);
    const queryVector = generateVectors(1, dim)[0]!;
    
    // 构建量化索引
    const format = new BinaryQuantizationFormat({
      queryBits: 4,
      indexBits: 1,
      quantizer: {
        similarityFunction: VectorSimilarityFunction.COSINE,
        lambda: 0.01,
        iters: 20
      }
    });
    const { quantizedVectors } = format.quantizeVectors(vectors);
    
    // 准备查询
    const normalizedQuery = normalizeVector(queryVector);
    const centroid = quantizedVectors.getCentroid();
    const { quantizedQuery, queryCorrections } = format.quantizeQueryVector(normalizedQuery, centroid);
    
    // 选择第一个向量进行测试
    const targetOrd = 0;
    
    console.log('\n🔍 4bit量化单个相似度计算步骤分解');
    console.log('='.repeat(60));
    
    // 步骤1: 获取未打包的索引向量
    const step1Start = performance.now();
    const unpackedBinaryCode = quantizedVectors.getUnpackedVector(targetOrd);
    const step1Time = performance.now() - step1Start;
    console.log(`步骤1 - 获取未打包索引向量: ${step1Time.toFixed(3)}ms`);
    console.log(`  向量长度: ${unpackedBinaryCode.length} 字节`);
    
    // 步骤3: 4bit点积计算
    const step3Start = performance.now();
    const qcDist = computeInt4BitDotProduct(quantizedQuery, unpackedBinaryCode);
    const step3Time = performance.now() - step3Start;
    console.log(`步骤3 - 4bit点积计算: ${step3Time.toFixed(3)}ms`);
    console.log(`  点积结果: ${qcDist}`);
    
    // 步骤4: 获取索引向量修正因子
    const step4Start = performance.now();
    const indexCorrections = quantizedVectors.getCorrectiveTerms(targetOrd);
    const step4Time = performance.now() - step4Start;
    console.log(`步骤4 - 获取索引修正因子: ${step4Time.toFixed(3)}ms`);
    console.log(`  修正因子: ${JSON.stringify(indexCorrections)}`);
    
    // 步骤5: 获取质心点积
    const step5Start = performance.now();
    const centroidDP = quantizedVectors.getCentroidDP();
    const step5Time = performance.now() - step5Start;
    console.log(`步骤5 - 获取质心点积: ${step5Time.toFixed(3)}ms`);
    console.log(`  质心点积: ${centroidDP}`);
    
    // 步骤6: 相似度分数计算（四项公式）
    const step6Start = performance.now();
    
    // 手动实现四项公式计算（4bit版本）
    const x1 = indexCorrections.quantizedComponentSum;
    const ax = indexCorrections.lowerInterval;
    const lx = indexCorrections.upperInterval - ax;
    const ay = queryCorrections.lowerInterval;
    const ly = (queryCorrections.upperInterval - ay) * 0.25; // FOUR_BIT_SCALE
    const y1 = queryCorrections.quantizedComponentSum;
    
    // 四项公式：score = ax * ay * dimension + ay * lx * x1 + ax * ly * y1 + lx * ly * qcDist
    let score = ax * ay * dim + ay * lx * x1 + ax * ly * y1 + lx * ly * qcDist;
    
    // 余弦相似度调整
    score += queryCorrections.additionalCorrection + indexCorrections.additionalCorrection - centroidDP;
    const finalScore = Math.max((1 + score) / 2, 0);
    
    const step6Time = performance.now() - step6Start;
    console.log(`步骤6 - 相似度分数计算: ${step6Time.toFixed(3)}ms`);
    console.log(`  最终分数: ${finalScore.toFixed(6)}`);
    
    // 总时间统计
    const totalTime = step1Time + step3Time + step4Time + step5Time + step6Time;
    console.log('\n📊 时间分布:');
    console.log(`总时间: ${totalTime.toFixed(3)}ms`);
    console.log(`步骤1 (向量获取): ${((step1Time / totalTime) * 100).toFixed(1)}%`);
    console.log(`步骤3 (点积计算): ${((step3Time / totalTime) * 100).toFixed(1)}%`);
    console.log(`步骤4 (修正获取): ${((step4Time / totalTime) * 100).toFixed(1)}%`);
    console.log(`步骤5 (质心获取): ${((step5Time / totalTime) * 100).toFixed(1)}%`);
    console.log(`步骤6 (分数计算): ${((step6Time / totalTime) * 100).toFixed(1)}%`);
    
    // 验证结果
    const expectedResult = format.getScorer().computeQuantizedScore(
      quantizedQuery,
      queryCorrections,
      quantizedVectors,
      targetOrd,
      4
    );
    
    console.log(`\n✅ 验证结果:`);
    console.log(`期望分数: ${expectedResult.score.toFixed(6)}`);
    console.log(`计算分数: ${finalScore.toFixed(6)}`);
    console.log(`差异: ${Math.abs(expectedResult.score - finalScore).toFixed(8)}`);
    
    expect(Math.abs(expectedResult.score - finalScore)).toBeLessThan(1e-6);
  });

  it('1bit vs 4bit单步计算对比', () => {
    // 测试参数
    const dim = 1024;
    const baseSize = 100;
    const vectors = generateVectors(baseSize, dim);
    const queryVector = generateVectors(1, dim)[0]!;
    
    // 1bit测试
    const format1bit = new BinaryQuantizationFormat({
      queryBits: 1,
      indexBits: 1,
      quantizer: {
        similarityFunction: VectorSimilarityFunction.COSINE,
        lambda: 0.01,
        iters: 20
      }
    });
    const { quantizedVectors: quantizedVectors1bit } = format1bit.quantizeVectors(vectors);
    const normalizedQuery = normalizeVector(queryVector);
    const centroid = quantizedVectors1bit.getCentroid();
    const { quantizedQuery: quantizedQuery1bit, queryCorrections: queryCorrections1bit } = 
      format1bit.quantizeQueryVector(normalizedQuery, centroid);
    
    const targetOrd = 0;
    const scorer1bit = format1bit.getScorer();
    
    // 1bit单步计算
    const start1bit = performance.now();
    const unpacked1bit = quantizedVectors1bit.getUnpackedVector(targetOrd);
    const qcDist1bit = computeInt1BitDotProduct(quantizedQuery1bit, unpacked1bit);
    const indexCorrections1bit = quantizedVectors1bit.getCorrectiveTerms(targetOrd);
    const centroidDP1bit = quantizedVectors1bit.getCentroidDP();
    
    // 四项公式计算
    const x1_1bit = indexCorrections1bit.quantizedComponentSum;
    const ax_1bit = indexCorrections1bit.lowerInterval;
    const lx_1bit = indexCorrections1bit.upperInterval - ax_1bit;
    const ay_1bit = queryCorrections1bit.lowerInterval;
    const ly_1bit = queryCorrections1bit.upperInterval - ay_1bit;
    const y1_1bit = queryCorrections1bit.quantizedComponentSum;
    
    let score1bit = ax_1bit * ay_1bit * dim + ay_1bit * lx_1bit * x1_1bit + 
                   ax_1bit * ly_1bit * y1_1bit + lx_1bit * ly_1bit * qcDist1bit;
    score1bit += queryCorrections1bit.additionalCorrection + 
                indexCorrections1bit.additionalCorrection - centroidDP1bit;
    const finalScore1bit = Math.max((1 + score1bit) / 2, 0);
    const time1bit = performance.now() - start1bit;
    
    // 4bit测试
    const format4bit = new BinaryQuantizationFormat({
      queryBits: 4,
      indexBits: 1,
      quantizer: {
        similarityFunction: VectorSimilarityFunction.COSINE,
        lambda: 0.01,
        iters: 20
      }
    });
    const { quantizedVectors: quantizedVectors4bit } = format4bit.quantizeVectors(vectors);
    const { quantizedQuery: quantizedQuery4bit, queryCorrections: queryCorrections4bit } = 
      format4bit.quantizeQueryVector(normalizedQuery, centroid);
    
    const scorer4bit = format4bit.getScorer();
    
    // 4bit单步计算
    const start4bit = performance.now();
    const unpacked4bit = quantizedVectors4bit.getUnpackedVector(targetOrd);
    const qcDist4bit = computeInt4BitDotProduct(quantizedQuery4bit, unpacked4bit);
    const indexCorrections4bit = quantizedVectors4bit.getCorrectiveTerms(targetOrd);
    const centroidDP4bit = quantizedVectors4bit.getCentroidDP();
    
    // 四项公式计算（4bit版本）
    const x1_4bit = indexCorrections4bit.quantizedComponentSum;
    const ax_4bit = indexCorrections4bit.lowerInterval;
    const lx_4bit = indexCorrections4bit.upperInterval - ax_4bit;
    const ay_4bit = queryCorrections4bit.lowerInterval;
    const ly_4bit = (queryCorrections4bit.upperInterval - ay_4bit) * 0.25;
    const y1_4bit = queryCorrections4bit.quantizedComponentSum;
    
    let score4bit = ax_4bit * ay_4bit * dim + ay_4bit * lx_4bit * x1_4bit + 
                   ax_4bit * ly_4bit * y1_4bit + lx_4bit * ly_4bit * qcDist4bit;
    score4bit += queryCorrections4bit.additionalCorrection + 
                indexCorrections4bit.additionalCorrection - centroidDP4bit;
    const finalScore4bit = Math.max((1 + score4bit) / 2, 0);
    const time4bit = performance.now() - start4bit;
    
    console.log('\n🔍 1bit vs 4bit单步计算对比');
    console.log('='.repeat(60));
    console.log(`1bit单步时间: ${time1bit.toFixed(3)}ms`);
    console.log(`4bit单步时间: ${time4bit.toFixed(3)}ms`);
    console.log(`加速比: ${(time4bit / time1bit).toFixed(2)}x`);
    console.log(`性能提升: ${(((time4bit - time1bit) / time4bit) * 100).toFixed(1)}%`);
    
    console.log(`\n📊 分数对比:`);
    console.log(`1bit分数: ${finalScore1bit.toFixed(6)}`);
    console.log(`4bit分数: ${finalScore4bit.toFixed(6)}`);
    console.log(`分数差异: ${Math.abs(finalScore1bit - finalScore4bit).toFixed(6)}`);
    
    // 验证结果
    expect(time1bit).toBeLessThan(time4bit);
    expect(finalScore1bit).toBeGreaterThan(0);
    expect(finalScore4bit).toBeGreaterThan(0);
  });
}); 