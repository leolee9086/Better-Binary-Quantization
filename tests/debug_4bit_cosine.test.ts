import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '../src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '../src/types';
import { computeInt4BitDotProduct, computeInt1BitDotProduct } from '../src/bitwiseDotProduct';
import { FOUR_BIT_SCALE } from '../src/constants';
import { OptimizedScalarQuantizer } from '../src/optimizedScalarQuantizer';

describe('4bit查询COSINE分支调试', () => {
  it('调试4bit查询COSINE分支的所有中间变量', () => {
    // 创建简单的测试数据
    const dimension = 8;
    const baseVectors = [
      new Float32Array([1, 0, 0, 0, 0, 0, 0, 0]), // 0
      new Float32Array([0, 1, 0, 0, 0, 0, 0, 0]), // 1
      new Float32Array([0, 0, 1, 0, 0, 0, 0, 0]), // 2
      new Float32Array([0, 0, 0, 1, 0, 0, 0, 0])  // 3
    ];

    const queryVector = new Float32Array([1, 0, 0, 0, 0, 0, 0, 0]);

    // 构建4bit查询+1位索引配置
    const format = new BinaryQuantizationFormat({
      queryBits: 4,
      indexBits: 1,
      quantizer: {
        similarityFunction: VectorSimilarityFunction.COSINE,
        lambda: 0.01,
        iters: 10
      }
    });

    // 量化base向量
    const { quantizedVectors } = format.quantizeVectors(baseVectors);

    // 量化查询向量
    const centroid = quantizedVectors.getCentroid();
    const { quantizedQuery, queryCorrections } = format.quantizeQueryVector(queryVector, centroid);

    // 测试第一个base向量
    const targetOrd = 0;
    const unpackedBinaryCode = quantizedVectors.getUnpackedVector(targetOrd);
    const indexCorrections = quantizedVectors.getCorrectiveTerms(targetOrd);

    // 计算4bit-1位点积
    // 修复：需要先对4bit查询向量进行转置
    const transposedQuery = new Uint8Array(Math.ceil(quantizedQuery.length / 8) * 4);
    OptimizedScalarQuantizer.transposeHalfByte(quantizedQuery, transposedQuery);
    const qcDist = computeInt4BitDotProduct(transposedQuery, unpackedBinaryCode);

    console.log('=== 4bit查询COSINE分支调试 ===');
    console.log('输入参数:');
    console.log('- dimension:', dimension);
    console.log('- qcDist (4bit-1位点积):', qcDist);
    console.log('- queryCorrections:', queryCorrections);
    console.log('- indexCorrections:', indexCorrections);

    // 手动计算COSINE分支的所有中间变量
    const x1 = indexCorrections.quantizedComponentSum;
    const ax = indexCorrections.lowerInterval;
    const lx = indexCorrections.upperInterval - ax;
    const ay = queryCorrections.lowerInterval;
    const ly = (queryCorrections.upperInterval - ay) * FOUR_BIT_SCALE;
    const y1 = queryCorrections.quantizedComponentSum;

    console.log('四项公式参数:');
    console.log('- x1 (indexCorrections.quantizedComponentSum):', x1);
    console.log('- ax (indexCorrections.lowerInterval):', ax);
    console.log('- lx (indexCorrections.upperInterval - ax):', lx);
    console.log('- ay (queryCorrections.lowerInterval):', ay);
    console.log('- ly ((queryCorrections.upperInterval - ay) * FOUR_BIT_SCALE):', ly);
    console.log('- y1 (queryCorrections.quantizedComponentSum):', y1);
    console.log('- FOUR_BIT_SCALE:', FOUR_BIT_SCALE);

    // 四项公式：score = ax * ay * dimension + ay * lx * x1 + ax * ly * y1 + lx * ly * qcDist
    const term1 = ax * ay * dimension;
    const term2 = ay * lx * x1;
    const term3 = ax * ly * y1;
    const term4 = lx * ly * qcDist;

    console.log('四项公式分解:');
    console.log('- term1 (ax * ay * dimension):', term1);
    console.log('- term2 (ay * lx * x1):', term2);
    console.log('- term3 (ax * ly * y1):', term3);
    console.log('- term4 (lx * ly * qcDist):', term4);

    const score = term1 + term2 + term3 + term4;
    console.log('- 基础分数 (四项公式):', score);

    // COSINE分支的调整
    const centroidDP = quantizedVectors.getCentroidDP(queryVector);
    console.log('- centroidDP:', centroidDP);
    console.log('- queryCorrections.additionalCorrection:', queryCorrections.additionalCorrection);
    console.log('- indexCorrections.additionalCorrection:', indexCorrections.additionalCorrection);

    const adjustedScore = score + 
                         queryCorrections.additionalCorrection + 
                         indexCorrections.additionalCorrection - 
                         centroidDP;
    console.log('- adjustedScore:', adjustedScore);

    const finalScore = Math.max((1 + adjustedScore) / 2, 0);
    console.log('- finalScore (Math.max((1 + adjustedScore) / 2, 0)):', finalScore);

    // 使用scorer计算分数进行对比
    const scorer = format.getScorer();
    const result = scorer.computeQuantizedScore(
      quantizedQuery,
      queryCorrections,
      quantizedVectors,
      targetOrd,
      4, // 添加queryBits参数
      queryVector
    );

    console.log('Scorer计算的分数:', result.score);
    console.log('=== 调试结束 ===');

    // 断言
    expect(qcDist).toBeGreaterThan(0);
    expect(finalScore).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(0);
  });

  it('调试大数据量4bit查询COSINE分支', () => {
    // 创建128维的测试数据，模拟大数据量情况
    const dimension = 128;
    
    // 创建多个base向量，避免质心计算问题
    const baseVectors: Float32Array[] = [];
    for (let vecIdx = 0; vecIdx < 10; vecIdx++) {
      const baseVector = new Float32Array(dimension);
      for (let i = 0; i < dimension; i++) {
        // 使用不同的种子生成不同的向量
        const seed = vecIdx * 1000 + i;
        baseVector[i] = Math.sin(seed * 0.1) * 0.5 + Math.cos(seed * 0.2) * 0.3;
      }
      baseVectors.push(baseVector);
    }
    
    const queryVector = new Float32Array(dimension);
    for (let i = 0; i < dimension; i++) {
      // 使用余弦波生成query向量，与base向量有相关性但不完全相同
      queryVector[i] = Math.cos(i * 0.1) * 0.5 + Math.sin(i * 0.2) * 0.3;
    }

    // 添加一些随机噪声，确保向量有足够的差异性
    for (let i = 0; i < dimension; i++) {
      const currentValue = queryVector[i];
      if (currentValue !== undefined) {
        queryVector[i] = currentValue + (Math.random() - 0.5) * 0.1;
      }
    }

    // 构建4bit查询+1位索引配置
    const format = new BinaryQuantizationFormat({
      queryBits: 4,
      indexBits: 1,
      quantizer: {
        similarityFunction: VectorSimilarityFunction.COSINE,
        lambda: 0.001,
        iters: 20
      }
    });

    // 量化base向量
    const { quantizedVectors } = format.quantizeVectors(baseVectors);

    // 量化查询向量
    const centroid = quantizedVectors.getCentroid();
    const { quantizedQuery, queryCorrections } = format.quantizeQueryVector(queryVector, centroid);

    // 测试第一个base向量
    const targetOrd = 0;
    const unpackedBinaryCode = quantizedVectors.getUnpackedVector(targetOrd);
    const indexCorrections = quantizedVectors.getCorrectiveTerms(targetOrd);

    // 计算4bit-1位点积
    // 修复：需要先对4bit查询向量进行转置
    const transposedQuery = new Uint8Array(Math.ceil(quantizedQuery.length / 8) * 4);
    OptimizedScalarQuantizer.transposeHalfByte(quantizedQuery, transposedQuery);
    const qcDist = computeInt4BitDotProduct(transposedQuery, unpackedBinaryCode);

    console.log('=== 大数据量4bit查询COSINE分支调试 ===');
    console.log('输入参数:');
    console.log('- dimension:', dimension);
    console.log('- qcDist (4bit-1位点积):', qcDist);
    console.log('- queryCorrections:', queryCorrections);
    console.log('- indexCorrections:', indexCorrections);

    // 手动计算COSINE分支的所有中间变量
    const x1 = indexCorrections.quantizedComponentSum;
    const ax = indexCorrections.lowerInterval;
    const lx = indexCorrections.upperInterval - ax;
    const ay = queryCorrections.lowerInterval;
    const ly = (queryCorrections.upperInterval - ay) * FOUR_BIT_SCALE;
    const y1 = queryCorrections.quantizedComponentSum;

    console.log('四项公式参数:');
    console.log('- x1 (indexCorrections.quantizedComponentSum):', x1);
    console.log('- ax (indexCorrections.lowerInterval):', ax);
    console.log('- lx (indexCorrections.upperInterval - ax):', lx);
    console.log('- ay (queryCorrections.lowerInterval):', ay);
    console.log('- ly ((queryCorrections.upperInterval - ay) * FOUR_BIT_SCALE):', ly);
    console.log('- y1 (queryCorrections.quantizedComponentSum):', y1);
    console.log('- FOUR_BIT_SCALE:', FOUR_BIT_SCALE);

    // 四项公式：score = ax * ay * dimension + ay * lx * x1 + ax * ly * y1 + lx * ly * qcDist
    const term1 = ax * ay * dimension;
    const term2 = ay * lx * x1;
    const term3 = ax * ly * y1;
    const term4 = lx * ly * qcDist;

    console.log('四项公式分解:');
    console.log('- term1 (ax * ay * dimension):', term1);
    console.log('- term2 (ay * lx * x1):', term2);
    console.log('- term3 (ax * ly * y1):', term3);
    console.log('- term4 (lx * ly * qcDist):', term4);

    const score = term1 + term2 + term3 + term4;
    console.log('- 基础分数 (四项公式):', score);

    // COSINE分支的调整
    const centroidDP = quantizedVectors.getCentroidDP(queryVector);
    console.log('- centroidDP:', centroidDP);
    console.log('- queryCorrections.additionalCorrection:', queryCorrections.additionalCorrection);
    console.log('- indexCorrections.additionalCorrection:', indexCorrections.additionalCorrection);

    const adjustedScore = score + 
                         queryCorrections.additionalCorrection + 
                         indexCorrections.additionalCorrection - 
                         centroidDP;
    console.log('- adjustedScore:', adjustedScore);

    const finalScore = Math.max((1 + adjustedScore) / 2, 0);
    console.log('- finalScore (Math.max((1 + adjustedScore) / 2, 0)):', finalScore);

    // 使用scorer计算分数进行对比
    const scorer = format.getScorer();
    const result = scorer.computeQuantizedScore(
      quantizedQuery,
      queryCorrections,
      quantizedVectors,
      targetOrd,
      4, // 添加queryBits参数
      queryVector
    );

    console.log('Scorer计算的分数:', result.score);
    console.log('=== 调试结束 ===');

    // 断言
    expect(qcDist).toBeGreaterThan(0);
    expect(finalScore).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(0);
  });

  it('对比1bit查询和4bit查询在相同数据下的表现', () => {
    // 使用相同的数据测试1bit查询和4bit查询
    const dimension = 128;
    
    // 创建多个base向量
    const baseVectors: Float32Array[] = [];
    for (let vecIdx = 0; vecIdx < 10; vecIdx++) {
      const baseVector = new Float32Array(dimension);
      for (let i = 0; i < dimension; i++) {
        const seed = vecIdx * 1000 + i;
        baseVector[i] = Math.sin(seed * 0.1) * 0.5 + Math.cos(seed * 0.2) * 0.3;
      }
      baseVectors.push(baseVector);
    }
    
    const queryVector = new Float32Array(dimension);
    for (let i = 0; i < dimension; i++) {
      queryVector[i] = Math.cos(i * 0.1) * 0.5 + Math.sin(i * 0.2) * 0.3;
    }

    for (let i = 0; i < dimension; i++) {
      const currentValue = queryVector[i];
      if (currentValue !== undefined) {
        queryVector[i] = currentValue + (Math.random() - 0.5) * 0.1;
      }
    }

    // 测试1bit查询
    const format1bit = new BinaryQuantizationFormat({
      queryBits: 1,
      indexBits: 1,
      quantizer: {
        similarityFunction: VectorSimilarityFunction.COSINE,
        lambda: 0.001,
        iters: 20
      }
    });

    const { quantizedVectors: quantizedVectors1bit } = format1bit.quantizeVectors(baseVectors);
    const centroid1bit = quantizedVectors1bit.getCentroid();
    const { quantizedQuery: quantizedQuery1bit, queryCorrections: queryCorrections1bit } = 
      format1bit.quantizeQueryVector(queryVector, centroid1bit);

    const targetOrd = 0;
    const unpackedBinaryCode1bit = quantizedVectors1bit.getUnpackedVector(targetOrd);
    const indexCorrections1bit = quantizedVectors1bit.getCorrectiveTerms(targetOrd);
    const qcDist1bit = computeInt1BitDotProduct(quantizedQuery1bit, unpackedBinaryCode1bit);

    // 测试4bit查询
    const format4bit = new BinaryQuantizationFormat({
      queryBits: 4,
      indexBits: 1,
      quantizer: {
        similarityFunction: VectorSimilarityFunction.COSINE,
        lambda: 0.001,
        iters: 20
      }
    });

    const { quantizedVectors: quantizedVectors4bit } = format4bit.quantizeVectors(baseVectors);
    const centroid4bit = quantizedVectors4bit.getCentroid();
    const { quantizedQuery: quantizedQuery4bit, queryCorrections: queryCorrections4bit } = 
      format4bit.quantizeQueryVector(queryVector, centroid4bit);

    const unpackedBinaryCode4bit = quantizedVectors4bit.getUnpackedVector(targetOrd);
    const indexCorrections4bit = quantizedVectors4bit.getCorrectiveTerms(targetOrd);
    
    // 修复：4bit查询向量需要转置后才能与unpackedBinaryCode4bit进行点积
    const transposedQuery4bit = new Uint8Array(Math.ceil(quantizedQuery4bit.length / 8) * 4);
    OptimizedScalarQuantizer.transposeHalfByte(quantizedQuery4bit, transposedQuery4bit);
    const qcDist4bit = computeInt4BitDotProduct(transposedQuery4bit, unpackedBinaryCode4bit);

    console.log('=== 1bit vs 4bit查询对比 ===');
    console.log('1bit查询:');
    console.log('- qcDist:', qcDist1bit);
    console.log('- queryCorrections:', queryCorrections1bit);
    console.log('- indexCorrections:', indexCorrections1bit);

    console.log('4bit查询:');
    console.log('- qcDist:', qcDist4bit);
    console.log('- queryCorrections:', queryCorrections4bit);
    console.log('- indexCorrections:', indexCorrections4bit);

    // 计算1bit查询的分数
    const x1_1bit = indexCorrections1bit.quantizedComponentSum;
    const ax_1bit = indexCorrections1bit.lowerInterval;
    const lx_1bit = indexCorrections1bit.upperInterval - ax_1bit;
    const ay_1bit = queryCorrections1bit.lowerInterval;
    const ly_1bit = queryCorrections1bit.upperInterval - ay_1bit; // 1bit不使用FOUR_BIT_SCALE
    const y1_1bit = queryCorrections1bit.quantizedComponentSum;

    const score1bit = ax_1bit * ay_1bit * dimension + 
                     ay_1bit * lx_1bit * x1_1bit + 
                     ax_1bit * ly_1bit * y1_1bit + 
                     lx_1bit * ly_1bit * qcDist1bit;

    const centroidDP1bit = quantizedVectors1bit.getCentroidDP(queryVector);
    const adjustedScore1bit = score1bit + 
                             queryCorrections1bit.additionalCorrection + 
                             indexCorrections1bit.additionalCorrection - 
                             centroidDP1bit;
    const finalScore1bit = Math.max((1 + adjustedScore1bit) / 2, 0);

    // 计算4bit查询的分数
    const x1_4bit = indexCorrections4bit.quantizedComponentSum;
    const ax_4bit = indexCorrections4bit.lowerInterval;
    const lx_4bit = indexCorrections4bit.upperInterval - ax_4bit;
    const ay_4bit = queryCorrections4bit.lowerInterval;
    const ly_4bit = (queryCorrections4bit.upperInterval - ay_4bit) * FOUR_BIT_SCALE;
    const y1_4bit = queryCorrections4bit.quantizedComponentSum;

    const score4bit = ax_4bit * ay_4bit * dimension + 
                     ay_4bit * lx_4bit * x1_4bit + 
                     ax_4bit * ly_4bit * y1_4bit + 
                     lx_4bit * ly_4bit * qcDist4bit;

    const centroidDP4bit = quantizedVectors4bit.getCentroidDP(queryVector);
    const adjustedScore4bit = score4bit + 
                             queryCorrections4bit.additionalCorrection + 
                             indexCorrections4bit.additionalCorrection - 
                             centroidDP4bit;
    const finalScore4bit = Math.max((1 + adjustedScore4bit) / 2, 0);

    console.log('分数对比:');
    console.log('1bit查询:');
    console.log('- 基础分数:', score1bit);
    console.log('- adjustedScore:', adjustedScore1bit);
    console.log('- finalScore:', finalScore1bit);

    console.log('4bit查询:');
    console.log('- 基础分数:', score4bit);
    console.log('- adjustedScore:', adjustedScore4bit);
    console.log('- finalScore:', finalScore4bit);

    // 使用scorer计算分数进行对比
    const scorer1bit = format1bit.getScorer();
    const result1bit = scorer1bit.computeQuantizedScore(
      quantizedQuery1bit,
      queryCorrections1bit,
      quantizedVectors1bit,
      targetOrd,
      1, // 添加queryBits参数
      queryVector
    );

    const scorer4bit = format4bit.getScorer();
    const result4bit = scorer4bit.computeQuantizedScore(
      quantizedQuery4bit,
      queryCorrections4bit,
      quantizedVectors4bit,
      targetOrd,
      4, // 添加queryBits参数
      queryVector
    );

    console.log('Scorer计算的分数:');
    console.log('- 1bit查询:', result1bit.score);
    console.log('- 4bit查询:', result4bit.score);

    console.log('=== 对比结束 ===');

    // 断言
    expect(qcDist1bit).toBeGreaterThan(0);
    expect(qcDist4bit).toBeGreaterThan(0);
    expect(finalScore1bit).toBeGreaterThan(0);
    expect(finalScore4bit).toBeGreaterThan(0);
  });
}); 