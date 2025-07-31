import { describe, it, expect } from 'vitest';
import { BinaryQuantizationFormat } from '../src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from '../src/types';
import { normalizeVector } from '../src/vectorOperations';
import { computeInt1BitDotProduct, computeInt4BitDotProduct } from '../src/bitwiseDotProduct';

/**
 * @织: 点积运算对比测试
 * 对比位运算点积与直接用量化向量算点积的性能
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

/**
 * 直接用量化向量计算点积（暴力方法）
 */
function computeDirectDotProductSimple(q: Uint8Array, d: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < q.length; i++) {
    sum += q[i]! * d[i]!;
  }
  return sum;
}

/**
 * 八路展开循环计算点积（Duff's Device优化）
 */
function computeDirectDotProduct(q: Uint8Array, d: Uint8Array): number {
  let sum = 0;
  const len = q.length;
  let i = 0;
  
  // 处理不能被8整除的部分
  const remainder = len % 8;
  switch (remainder) {
    case 7: sum += q[i]! * d[i]!; i++;
    case 6: sum += q[i]! * d[i]!; i++;
    case 5: sum += q[i]! * d[i]!; i++;
    case 4: sum += q[i]! * d[i]!; i++;
    case 3: sum += q[i]! * d[i]!; i++;
    case 2: sum += q[i]! * d[i]!; i++;
    case 1: sum += q[i]! * d[i]!; i++;
  }
  
  // 八路展开主循环
  for (; i < len; i += 8) {
    sum += q[i]! * d[i]!;
    sum += q[i + 1]! * d[i + 1]!;
    sum += q[i + 2]! * d[i + 2]!;
    sum += q[i + 3]! * d[i + 3]!;
    sum += q[i + 4]! * d[i + 4]!;
    sum += q[i + 5]! * d[i + 5]!;
    sum += q[i + 6]! * d[i + 6]!;
    sum += q[i + 7]! * d[i + 7]!;
  }
  
  return sum;
}

describe('点积运算对比测试', () => {
  it('1bit量化点积对比：位运算 vs 直接计算', () => {
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
    const unpackedBinaryCode = quantizedVectors.getUnpackedVector(targetOrd);
    
    console.log('\n🔍 1bit量化点积对比：位运算 vs 直接计算');
    console.log('='.repeat(60));
    
    // 方法1: 位运算点积
    const bitwiseStart = performance.now();
    const bitwiseResult = computeInt1BitDotProduct(quantizedQuery, unpackedBinaryCode);
    const bitwiseTime = performance.now() - bitwiseStart;
    
    console.log(`位运算点积:`);
    console.log(`  结果: ${bitwiseResult}`);
    console.log(`  时间: ${bitwiseTime.toFixed(3)}ms`);
    
         // 方法2: 直接计算点积
     const directStart = performance.now();
     const directResult = computeDirectDotProduct(quantizedQuery, unpackedBinaryCode);
     const directTime = performance.now() - directStart;
    
    console.log(`直接计算点积:`);
    console.log(`  结果: ${directResult.toFixed(6)}`);
    console.log(`  时间: ${directTime.toFixed(3)}ms`);
    
    // 性能对比
    console.log(`\n📊 性能对比:`);
    console.log(`位运算加速比: ${(directTime / bitwiseTime).toFixed(2)}x`);
    console.log(`性能提升: ${(((directTime - bitwiseTime) / directTime) * 100).toFixed(1)}%`);
    
    // 结果对比
    console.log(`\n📊 结果对比:`);
    console.log(`位运算结果: ${bitwiseResult}`);
    console.log(`直接计算结果: ${directResult.toFixed(6)}`);
    console.log(`结果差异: ${Math.abs(bitwiseResult - directResult).toFixed(6)}`);
    
    // 验证结果应该相似（考虑到量化误差）
    expect(Math.abs(bitwiseResult - directResult)).toBeLessThan(dim * 0.1);
  });

  it('4bit量化点积对比：位运算 vs 直接计算', () => {
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
    const unpackedBinaryCode = quantizedVectors.getUnpackedVector(targetOrd);
    
    console.log('\n🔍 4bit量化点积对比：位运算 vs 直接计算');
    console.log('='.repeat(60));
    
    // 方法1: 位运算点积
    const bitwiseStart = performance.now();
    const bitwiseResult = computeInt4BitDotProduct(quantizedQuery, unpackedBinaryCode);
    const bitwiseTime = performance.now() - bitwiseStart;
    
    console.log(`位运算点积:`);
    console.log(`  结果: ${bitwiseResult}`);
    console.log(`  时间: ${bitwiseTime.toFixed(3)}ms`);
    
         // 方法2: 直接计算点积
     const directStart = performance.now();
     const directResult = computeDirectDotProduct(quantizedQuery, unpackedBinaryCode);
     const directTime = performance.now() - directStart;
    
    console.log(`直接计算点积:`);
    console.log(`  结果: ${directResult.toFixed(6)}`);
    console.log(`  时间: ${directTime.toFixed(3)}ms`);
    
    // 性能对比
    console.log(`\n📊 性能对比:`);
    console.log(`位运算加速比: ${(directTime / bitwiseTime).toFixed(2)}x`);
    console.log(`性能提升: ${(((directTime - bitwiseTime) / directTime) * 100).toFixed(1)}%`);
    
    // 结果对比
    console.log(`\n📊 结果对比:`);
    console.log(`位运算结果: ${bitwiseResult}`);
    console.log(`直接计算结果: ${directResult.toFixed(6)}`);
    console.log(`结果差异: ${Math.abs(bitwiseResult - directResult).toFixed(6)}`);
    
    // 验证结果应该相似（考虑到量化误差）
    expect(Math.abs(bitwiseResult - directResult)).toBeLessThan(dim * 0.1);
  });

  it('1bit vs 4bit vs 直接计算综合对比', () => {
    // 测试参数
    const dim = 1024;
    const baseSize = 100;
    const vectors = generateVectors(baseSize, dim);
    const queryVector = generateVectors(1, dim)[0]!;
    
    console.log('\n🔍 1bit vs 4bit vs 直接计算综合对比');
    console.log('='.repeat(60));
    
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
    const { quantizedQuery: quantizedQuery1bit } = format1bit.quantizeQueryVector(normalizedQuery, centroid);
    const unpackedBinaryCode1bit = quantizedVectors1bit.getUnpackedVector(0);
    
    // 1bit位运算
    const start1bitBitwise = performance.now();
    const result1bitBitwise = computeInt1BitDotProduct(quantizedQuery1bit, unpackedBinaryCode1bit);
    const time1bitBitwise = performance.now() - start1bitBitwise;
    
         // 1bit直接计算
     const start1bitDirect = performance.now();
     const result1bitDirect = computeDirectDotProduct(quantizedQuery1bit, unpackedBinaryCode1bit);
     const time1bitDirect = performance.now() - start1bitDirect;
    
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
    const { quantizedQuery: quantizedQuery4bit } = format4bit.quantizeQueryVector(normalizedQuery, centroid);
    const unpackedBinaryCode4bit = quantizedVectors4bit.getUnpackedVector(0);
    
    // 4bit位运算
    const start4bitBitwise = performance.now();
    const result4bitBitwise = computeInt4BitDotProduct(quantizedQuery4bit, unpackedBinaryCode4bit);
    const time4bitBitwise = performance.now() - start4bitBitwise;
    
         // 4bit直接计算
     const start4bitDirect = performance.now();
     const result4bitDirect = computeDirectDotProduct(quantizedQuery4bit, unpackedBinaryCode4bit);
     const time4bitDirect = performance.now() - start4bitDirect;
    
    // 输出结果
    console.log(`1bit位运算: ${time1bitBitwise.toFixed(3)}ms (结果: ${result1bitBitwise})`);
    console.log(`1bit直接计算: ${time1bitDirect.toFixed(3)}ms (结果: ${result1bitDirect.toFixed(6)})`);
    console.log(`4bit位运算: ${time4bitBitwise.toFixed(3)}ms (结果: ${result4bitBitwise})`);
    console.log(`4bit直接计算: ${time4bitDirect.toFixed(3)}ms (结果: ${result4bitDirect.toFixed(6)})`);
    
    console.log(`\n📊 性能对比:`);
    console.log(`1bit位运算 vs 1bit直接计算: ${(time1bitDirect / time1bitBitwise).toFixed(2)}x`);
    console.log(`4bit位运算 vs 4bit直接计算: ${(time4bitDirect / time4bitBitwise).toFixed(2)}x`);
    console.log(`1bit位运算 vs 4bit位运算: ${(time4bitBitwise / time1bitBitwise).toFixed(2)}x`);
    console.log(`1bit直接计算 vs 4bit直接计算: ${(time4bitDirect / time1bitDirect).toFixed(2)}x`);
    
    // 验证结果
    expect(time1bitBitwise).toBeLessThan(time1bitDirect);
    expect(time4bitBitwise).toBeLessThan(time4bitDirect);
    expect(time1bitBitwise).toBeLessThan(time4bitBitwise);
  });
}); 