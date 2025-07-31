import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '../src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '../src/types';
import { OptimizedScalarQuantizer } from '../src/optimizedScalarQuantizer';
import { computeMean } from '../src/utils';
import { computeInt4BitDotProduct } from '../src/bitwiseDotProduct';

describe('4bit查询调试', () => {
  it('调试4bit查询的量化过程', () => {
    // 创建简单的测试数据
    const dimension = 8; // 使用8维，确保有足够的字节进行32位操作
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
        lambda: 0.05,
        iters: 10
      }
    });

    // 量化base向量
    const { quantizedVectors } = format.quantizeVectors(baseVectors);

    // 手动测试量化过程
    const centroid = quantizedVectors.getCentroid();
    console.log('质心:', Array.from(centroid));

    // 量化查询向量
    const { quantizedQuery, queryCorrections } = format.quantizeQueryVector(queryVector, centroid);
    
    console.log('查询向量量化结果:');
    console.log('- 原始查询向量:', Array.from(queryVector));
    console.log('- 量化查询向量长度:', quantizedQuery.length);
    console.log('- 量化查询向量:', Array.from(quantizedQuery));
    console.log('- 查询修正因子:', queryCorrections);

    // 测试第一个base向量
    const targetOrd = 0;
    const binaryCode = quantizedVectors.vectorValue(targetOrd);
    const unpackedBinaryCode = quantizedVectors.getUnpackedVector(targetOrd);
    const indexCorrections = quantizedVectors.getCorrectiveTerms(targetOrd);

    console.log('目标向量量化结果:');
    const baseVector = baseVectors[targetOrd];
    if (!baseVector) {
      throw new Error(`目标向量${targetOrd}不存在`);
    }
    console.log('- 原始base向量:', Array.from(baseVector));
    console.log('- 打包的二进制编码长度:', binaryCode.length);
    console.log('- 打包的二进制编码:', Array.from(binaryCode));
    console.log('- 未打包的二进制编码长度:', unpackedBinaryCode.length);
    console.log('- 未打包的二进制编码:', Array.from(unpackedBinaryCode));
    console.log('- 索引修正因子:', indexCorrections);

    // 计算4bit-1位点积
    // 修复：4bit查询向量需要转置后才能与unpackedBinaryCode进行点积
    const transposedQuery = new Uint8Array(Math.ceil(quantizedQuery.length / 8) * 4);
    OptimizedScalarQuantizer.transposeHalfByte(quantizedQuery, transposedQuery);
    const qcDist = computeInt4BitDotProduct(transposedQuery, unpackedBinaryCode);
    console.log('4bit-1位点积结果:', qcDist);

    // 手动计算分数
    const x1 = indexCorrections.quantizedComponentSum;
    const ax = indexCorrections.lowerInterval;
    const lx = indexCorrections.upperInterval - ax;
    const ay = queryCorrections.lowerInterval;
    const ly = (queryCorrections.upperInterval - ay) * (1.0 / 15.0); // FOUR_BIT_SCALE
    const y1 = queryCorrections.quantizedComponentSum;

    console.log('分数计算参数:');
    console.log('- x1:', x1);
    console.log('- ax:', ax);
    console.log('- lx:', lx);
    console.log('- ay:', ay);
    console.log('- ly:', ly);
    console.log('- y1:', y1);

    const score = ax * ay * dimension + ay * lx * x1 + ax * ly * y1 + lx * ly * qcDist;
    console.log('基础分数:', score);

    // 应用余弦相似性调整
    const centroidDP = quantizedVectors.getCentroidDP(queryVector);
    const adjustedScore = score + queryCorrections.additionalCorrection + 
                         indexCorrections.additionalCorrection - centroidDP;
    const finalScore = Math.max((1 + adjustedScore) / 2, 0);

    console.log('最终分数:', finalScore);
    console.log('- centroidDP:', centroidDP);
    console.log('- queryCorrections.additionalCorrection:', queryCorrections.additionalCorrection);
    console.log('- indexCorrections.additionalCorrection:', indexCorrections.additionalCorrection);

    // 使用scorer计算分数
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

    // 断言
    expect(qcDist).toBeGreaterThan(0);
    expect(finalScore).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(0);
  });

  it('调试大数据量4bit查询', () => {
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
    
    console.log('大数据量测试:');
    console.log('- 维度:', dimension);
    console.log('- Base向量数量:', baseVectors.length);
    const firstBaseVector = baseVectors[0];
    if (!firstBaseVector) {
      throw new Error('第一个base向量不存在');
    }
    console.log('- 原始base向量范围:', [Math.min(...firstBaseVector), Math.max(...firstBaseVector)]);
    console.log('- 原始query向量范围:', [Math.min(...queryVector), Math.max(...queryVector)]);
    console.log('- 质心均值:', computeMean(centroid));
    console.log('- 量化查询向量长度:', quantizedQuery.length);
    console.log('- 量化查询向量前10个字节:', Array.from(quantizedQuery.slice(0, 10)));

    // 测试第一个base向量
    const targetOrd = 0;
    const unpackedBinaryCode = quantizedVectors.getUnpackedVector(targetOrd);
    const indexCorrections = quantizedVectors.getCorrectiveTerms(targetOrd);

    console.log('- 未打包的二进制编码长度:', unpackedBinaryCode.length);
    console.log('- 未打包的二进制编码前10个:', Array.from(unpackedBinaryCode.slice(0, 10)));

    // 计算4bit-1位点积
    // 修复：4bit查询向量需要转置后才能与unpackedBinaryCode进行点积
    const transposedQuery = new Uint8Array(Math.ceil(quantizedQuery.length / 8) * 4);
    OptimizedScalarQuantizer.transposeHalfByte(quantizedQuery, transposedQuery);
    const qcDist = computeInt4BitDotProduct(transposedQuery, unpackedBinaryCode);
    console.log('- 4bit-1位点积结果:', qcDist);

    // 使用scorer计算分数
    const scorer = format.getScorer();
    const result = scorer.computeQuantizedScore(
      quantizedQuery,
      queryCorrections,
      quantizedVectors,
      targetOrd,
      4, // 添加queryBits参数
      queryVector
    );

    console.log('- Scorer计算的分数:', result.score);

    // 手动计算分数以调试
    const x1 = indexCorrections.quantizedComponentSum;
    const ax = indexCorrections.lowerInterval;
    const lx = indexCorrections.upperInterval - ax;
    const ay = queryCorrections.lowerInterval;
    const ly = (queryCorrections.upperInterval - ay) * (1.0 / 15.0); // FOUR_BIT_SCALE
    const y1 = queryCorrections.quantizedComponentSum;

    console.log('分数计算详细调试:');
    console.log('- x1 (indexCorrections.quantizedComponentSum):', x1);
    console.log('- ax (indexCorrections.lowerInterval):', ax);
    console.log('- lx (indexCorrections.upperInterval - ax):', lx);
    console.log('- ay (queryCorrections.lowerInterval):', ay);
    console.log('- ly (queryCorrections.upperInterval - ay) * FOUR_BIT_SCALE:', ly);
    console.log('- y1 (queryCorrections.quantizedComponentSum):', y1);
    console.log('- qcDist (4bit-1位点积):', qcDist);
    console.log('- dimension:', dimension);

    const score = ax * ay * dimension + ay * lx * x1 + ax * ly * y1 + lx * ly * qcDist;
    console.log('- 基础分数 (四项公式):', score);

    const centroidDP = quantizedVectors.getCentroidDP(queryVector);
    console.log('- centroidDP:', centroidDP);
    console.log('- queryCorrections.additionalCorrection:', queryCorrections.additionalCorrection);
    console.log('- indexCorrections.additionalCorrection:', indexCorrections.additionalCorrection);

    const adjustedScore = score + queryCorrections.additionalCorrection + 
                         indexCorrections.additionalCorrection - centroidDP;
    console.log('- adjustedScore:', adjustedScore);

    const finalScore = Math.max((1 + adjustedScore) / 2, 0);
    console.log('- finalScore (Math.max((1 + adjustedScore) / 2, 0)):', finalScore);

    // 断言
    expect(qcDist).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(0);
  });

  it('验证分数计算步骤', () => {
    // 使用已知的正确值来验证分数计算
    const qcDist = 120; // 4bit-1位点积结果
    const dimension = 128;
    
    // 模拟修正因子（使用实际测试中的值）
    const queryCorrections = {
      lowerInterval: -0.14921575039625168,
      upperInterval: 0.16282560303807259,
      additionalCorrection: -0.04460687175861406,
      quantizedComponentSum: 931
    };
    
    const indexCorrections = {
      lowerInterval: -0.1350894306256245,
      upperInterval: 0.06835810607104045,
      additionalCorrection: -0.09813502058941771,
      quantizedComponentSum: 86
    };
    
    const centroidDP = -0.2093964426314127;
    
    // 计算四项公式的参数
    const x1 = indexCorrections.quantizedComponentSum;
    const ax = indexCorrections.lowerInterval;
    const lx = indexCorrections.upperInterval - ax;
    const ay = queryCorrections.lowerInterval;
    const ly = (queryCorrections.upperInterval - ay) * (1.0 / 15.0); // FOUR_BIT_SCALE
    const y1 = queryCorrections.quantizedComponentSum;
    
    console.log('分数计算验证:');
    console.log('- x1:', x1);
    console.log('- ax:', ax);
    console.log('- lx:', lx);
    console.log('- ay:', ay);
    console.log('- ly:', ly);
    console.log('- y1:', y1);
    console.log('- qcDist:', qcDist);
    console.log('- dimension:', dimension);
    
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
    
    const adjustedScore = score + queryCorrections.additionalCorrection + 
                         indexCorrections.additionalCorrection - centroidDP;
    console.log('- adjustedScore:', adjustedScore);
    
    const finalScore = Math.max((1 + adjustedScore) / 2, 0);
    console.log('- finalScore:', finalScore);
    
    // 检查是否有数值精度问题
    console.log('数值精度检查:');
    console.log('- FOUR_BIT_SCALE:', 1.0 / 15.0);
    console.log('- 1.0 / ((1 << 4) - 1):', 1.0 / ((1 << 4) - 1));
    
    // 断言
    expect(score).toBeLessThan(0); // 基础分数应该是负数
    expect(adjustedScore).toBeLessThan(-1); // adjustedScore应该小于-1
    expect(finalScore).toBe(0); // 最终分数应该是0
  });
}); 