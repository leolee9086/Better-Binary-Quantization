/**
 * 直接打包算法与解包算法性能对比测试
 * 对比直接处理打包向量与解包后处理的性能差异
 */

import { describe, it, expect } from 'vitest';
import {
  computeBatchDotProductOptimized,
  computeBatchDotProductUltraVectorized,
  computeBatchDotProductDirectPacked,
  createConcatenatedBuffer,
  createDirectPackedBuffer
} from '../../src/batchDotProduct';
import { OptimizedScalarQuantizer } from '../../src/optimizedScalarQuantizer';

// 导入位计数函数
function bitCount32Optimized(n: number): number {
  n = n >>> 0;
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  n = (n + (n >>> 4)) & 0x0F0F0F0F;
  n = n + (n >>> 8);
  n = n + (n >>> 16);
  return n & 0x3F;
}

/**
 * 生成随机单比特向量（解包格式）
 * @param length 向量长度（bit数量）
 * @returns 单比特向量（每个字节只有0或1）
 */
function generateUnpackedBinaryVector(length: number): Uint8Array {
  const vector = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    vector[i] = Math.floor(Math.random() * 2); // 只生成0或1
  }
  return vector;
}

/**
 * 将解包向量打包成字节格式
 * @param unpackedVector 解包向量（每个字节0或1）
 * @returns 打包向量（每个字节包含8个bit）
 */
function packBinaryVector(unpackedVector: Uint8Array): Uint8Array {
  const packedLength = Math.ceil(unpackedVector.length / 8);
  const packedVector = new Uint8Array(packedLength);
  
  OptimizedScalarQuantizer.packAsBinary(unpackedVector, packedVector);
  return packedVector;
}

/**
 * 模拟目标向量集合（包含真正的打包和解包向量）
 */
class MockTargetVectorsWithPacked {
  private unpackedVectors: Uint8Array[];
  private packedVectors: Uint8Array[];

  constructor(unpackedVectors: Uint8Array[]) {
    this.unpackedVectors = unpackedVectors;
    this.packedVectors = unpackedVectors.map(vector => packBinaryVector(vector));
  }

  getUnpackedVector(ord: number): Uint8Array {
    return this.unpackedVectors[ord]!;
  }

  vectorValue(ord: number): Uint8Array {
    return this.packedVectors[ord]!;
  }

  getCorrectiveTerms(ord: number): any {
    return {
      quantizedComponentSum: 0,
      lowerInterval: 0,
      upperInterval: 1,
      additionalCorrection: 0
    };
  }
}

/**
 * 测量函数执行时间
 * @param fn 要测量的函数
 * @param iterations 迭代次数
 * @returns 执行时间（毫秒）
 */
function measureTime(fn: () => void, iterations: number): number {
  // 预热
  for (let i = 0; i < 50; i++) {
    fn();
  }
  
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  return performance.now() - start;
}

describe('直接打包算法与解包算法性能对比', () => {
  const testSizes = [10, 50, 100, 500, 1000];
  const vectorSizes = [128, 256, 512, 1024]; // 这些是bit数量
  const iterations = 100;

  it('应该正确计算批量点积', () => {
    const numVectors = 10;
    const vectorSize = 128; // 128个bit
    
    // 生成测试数据
    const queryUnpackedVector = generateUnpackedBinaryVector(vectorSize);
    const queryPackedVector = packBinaryVector(queryUnpackedVector);
    
    const targetUnpackedVectors: Uint8Array[] = [];
    for (let i = 0; i < numVectors; i++) {
      targetUnpackedVectors.push(generateUnpackedBinaryVector(vectorSize));
    }
    
    const mockTargetVectors = new MockTargetVectorsWithPacked(targetUnpackedVectors);
    const targetOrds = Array.from({ length: numVectors }, (_, i) => i);
    
    // 构造两种buffer
    const concatenatedBuffer = createConcatenatedBuffer(mockTargetVectors, targetOrds);
    const directPackedBuffer = createDirectPackedBuffer(mockTargetVectors, targetOrds, queryPackedVector.length);
    
    // 调试信息
    console.log('调试信息:');
    console.log('vectorSize (bits):', vectorSize);
    console.log('queryPackedVector.length:', queryPackedVector.length);
    console.log('concatenatedBuffer.length:', concatenatedBuffer.length);
    console.log('directPackedBuffer.length:', directPackedBuffer.length);
    
    // 手动验证第一个向量的结果
    const firstQueryUnpacked = queryUnpackedVector;
    const firstTargetUnpacked = targetUnpackedVectors[0]!;
    const firstQueryPacked = queryPackedVector;
    const firstTargetPacked = directPackedBuffer.slice(0, queryPackedVector.length);
    
    // 手动计算解包后的点积
    let manualUnpackedDotProduct = 0;
    for (let i = 0; i < firstQueryUnpacked.length; i++) {
      manualUnpackedDotProduct += firstQueryUnpacked[i]! * firstTargetUnpacked[i]!;
    }
    
    // 手动计算打包后的点积
    let manualPackedDotProduct = 0;
    for (let i = 0; i < firstQueryPacked.length; i++) {
      const andResult = firstQueryPacked[i]! & firstTargetPacked[i]!;
      manualPackedDotProduct += bitCount32Optimized(andResult);
    }
    
    console.log('手动验证:');
    console.log('解包后点积:', manualUnpackedDotProduct);
    console.log('打包后点积:', manualPackedDotProduct);
    console.log('是否相等:', manualUnpackedDotProduct === manualPackedDotProduct);
    
    // 测试不同算法的结果一致性
    // 解包算法：使用解包的查询向量和解包的目标向量
    const result1 = computeBatchDotProductOptimized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
    const result2 = computeBatchDotProductUltraVectorized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
    // 直接打包算法：使用打包的查询向量和打包的目标向量
    const result3 = computeBatchDotProductDirectPacked(queryPackedVector, directPackedBuffer, numVectors, queryPackedVector.length);
    
    console.log('结果对比:');
    console.log('result1 (Optimized):', result1.slice(0, 3));
    console.log('result2 (UltraVectorized):', result2.slice(0, 3));
    console.log('result3 (DirectPacked):', result3.slice(0, 3));
    
    // 验证结果
    for (let i = 0; i < numVectors; i++) {
      expect(result1[i]).toBe(result2[i]);
      expect(result2[i]).toBe(result3[i]);
    }
  });

  it('直接打包算法与解包算法性能对比测试', () => {
    console.log('\n=== 直接打包算法与解包算法性能对比（正确数据格式） ===');
    console.log('向量数量\t向量大小(bit)\t解包算法(ms)\t直接打包(ms)\t加速比\t\t内存节省');
    
    for (const numVectors of testSizes) {
      for (const vectorSize of vectorSizes) {
        // 生成测试数据
        const queryUnpackedVector = generateUnpackedBinaryVector(vectorSize);
        const queryPackedVector = packBinaryVector(queryUnpackedVector);
        
        const targetUnpackedVectors: Uint8Array[] = [];
        for (let i = 0; i < numVectors; i++) {
          targetUnpackedVectors.push(generateUnpackedBinaryVector(vectorSize));
        }
        
        const mockTargetVectors = new MockTargetVectorsWithPacked(targetUnpackedVectors);
        const targetOrds = Array.from({ length: numVectors }, (_, i) => i);
        
        // 预先构造两种buffer（排除构造时间）
        const concatenatedBuffer = createConcatenatedBuffer(mockTargetVectors, targetOrds);
        const directPackedBuffer = createDirectPackedBuffer(mockTargetVectors, targetOrds, queryPackedVector.length);
        
        // 预热
        for (let i = 0; i < 10; i++) {
          computeBatchDotProductUltraVectorized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
          computeBatchDotProductDirectPacked(queryPackedVector, directPackedBuffer, numVectors, queryPackedVector.length);
        }
        
        // 测试解包算法（超向量化）- 只测量计算时间
        const time1 = measureTime(() => {
          computeBatchDotProductUltraVectorized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
        }, iterations);
        
        // 测试直接打包算法 - 只测量计算时间
        const time2 = measureTime(() => {
          computeBatchDotProductDirectPacked(queryPackedVector, directPackedBuffer, numVectors, queryPackedVector.length);
        }, iterations);
        
        const speedup = time1 / time2;
        const memorySaved = (concatenatedBuffer.length - directPackedBuffer.length) / 1024; // KB
        
        console.log(`${numVectors}\t\t${vectorSize}\t\t${time1.toFixed(2)}\t\t${time2.toFixed(2)}\t\t${speedup.toFixed(2)}x\t\t${memorySaved.toFixed(1)}KB`);
        
        // 验证结果一致性（两种算法处理相同的逻辑数据，结果应该相同）
        const result1 = computeBatchDotProductUltraVectorized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
        const result2 = computeBatchDotProductDirectPacked(queryPackedVector, directPackedBuffer, numVectors, queryPackedVector.length);
        
        for (let i = 0; i < numVectors; i++) {
          expect(result1[i]).toBe(result2[i]);
        }
      }
    }
    
    console.log('\n=== 性能分析总结 ===');
    console.log('1. 解包算法：需要createConcatenatedBuffer，处理解包后的向量');
    console.log('2. 直接打包算法：避免解包开销，直接处理打包向量');
    console.log('3. 内存效率：直接打包算法避免创建额外的解包buffer');
    console.log('4. 注意：buffer构造时间已排除在性能测量之外');
    console.log('5. 数据格式：使用真正的单比特数据（0/1）和打包数据（8bit/字节）');
  });

  it('大规模数据性能测试', () => {
    console.log('\n=== 大规模数据性能测试（正确数据格式） ===');
    const largeTestSizes = [1000, 5000, 10000];
    const largeVectorSizes = [1024, 2048]; // bit数量
    const largeIterations = 50;
    
    console.log('向量数量\t向量大小(bit)\t解包算法(ms)\t直接打包(ms)\t加速比\t\t内存节省(MB)');
    
    for (const numVectors of largeTestSizes) {
      for (const vectorSize of largeVectorSizes) {
        // 生成大规模测试数据
        const queryUnpackedVector = generateUnpackedBinaryVector(vectorSize);
        const queryPackedVector = packBinaryVector(queryUnpackedVector);
        
        const targetUnpackedVectors: Uint8Array[] = [];
        for (let i = 0; i < numVectors; i++) {
          targetUnpackedVectors.push(generateUnpackedBinaryVector(vectorSize));
        }
        
        const mockTargetVectors = new MockTargetVectorsWithPacked(targetUnpackedVectors);
        const targetOrds = Array.from({ length: numVectors }, (_, i) => i);
        
        // 预先构造两种buffer（排除构造时间）
        const concatenatedBuffer = createConcatenatedBuffer(mockTargetVectors, targetOrds);
        const directPackedBuffer = createDirectPackedBuffer(mockTargetVectors, targetOrds, queryPackedVector.length);
        
        // 预热
        for (let i = 0; i < 5; i++) {
          computeBatchDotProductUltraVectorized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
          computeBatchDotProductDirectPacked(queryPackedVector, directPackedBuffer, numVectors, queryPackedVector.length);
        }
        
        // 测试解包算法 - 只测量计算时间
        const time1 = measureTime(() => {
          computeBatchDotProductUltraVectorized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
        }, largeIterations);
        
        // 测试直接打包算法 - 只测量计算时间
        const time2 = measureTime(() => {
          computeBatchDotProductDirectPacked(queryPackedVector, directPackedBuffer, numVectors, queryPackedVector.length);
        }, largeIterations);
        
        const speedup = time1 / time2;
        const memorySaved = (concatenatedBuffer.length - directPackedBuffer.length) / (1024 * 1024); // MB
        
        console.log(`${numVectors}\t\t${vectorSize}\t\t${time1.toFixed(2)}\t\t${time2.toFixed(2)}\t\t${speedup.toFixed(2)}x\t\t${memorySaved.toFixed(2)}MB`);
      }
    }
  });

 

  it('简单算法验证测试', () => {
    console.log('\n=== 简单算法验证测试 ===');
    
    // 创建简单的测试数据
    const queryUnpacked = new Uint8Array([1, 0, 1, 0, 1, 0, 1, 0]); // 8个bit
    const targetUnpacked = new Uint8Array([1, 1, 0, 0, 1, 1, 0, 0]); // 8个bit
    
    // 打包
    const queryPacked = packBinaryVector(queryUnpacked);
    const targetPacked = packBinaryVector(targetUnpacked);
    
    console.log('解包数据:');
    console.log('queryUnpacked:', Array.from(queryUnpacked));
    console.log('targetUnpacked:', Array.from(targetUnpacked));
    console.log('打包数据:');
    console.log('queryPacked:', Array.from(queryPacked));
    console.log('targetPacked:', Array.from(targetPacked));
    
    // 手动计算点积（解包后）
    let manualDotProduct = 0;
    for (let i = 0; i < queryUnpacked.length; i++) {
      manualDotProduct += queryUnpacked[i]! * targetUnpacked[i]!;
    }
    console.log('手动计算点积（解包后）:', manualDotProduct);
    
    // 手动计算点积（打包后）
    const andResult = queryPacked[0]! & targetPacked[0]!;
    const bitCount = bitCount32Optimized(andResult);
    console.log('按位与结果:', andResult.toString(2));
    console.log('位计数结果:', bitCount);
    console.log('手动计算点积（打包后）:', bitCount);
    
    // 验证结果
    expect(manualDotProduct).toBe(bitCount);
  });

  it('三算法完整性能对比测试', () => {
    console.log('\n=== 三算法完整性能对比测试 ===');
    console.log('对比：Optimized（项目实际使用） vs UltraVectorized（超向量化） vs DirectPacked（直接打包）');
    console.log('向量数量\t向量大小(bit)\tOptimized(ms)\tUltraVectorized(ms)\tDirectPacked(ms)\tUV/Opt\tDP/Opt\tDP/UV\t内存节省(KB)');
    
    const testSizes = [10, 50, 100, 500, 1000];
    const vectorSizes = [128, 256, 512, 1024]; // bit数量
    const iterations = 100;
    
    for (const numVectors of testSizes) {
      for (const vectorSize of vectorSizes) {
        // 生成测试数据
        const queryUnpackedVector = generateUnpackedBinaryVector(vectorSize);
        const queryPackedVector = packBinaryVector(queryUnpackedVector);
        
        const targetUnpackedVectors: Uint8Array[] = [];
        for (let i = 0; i < numVectors; i++) {
          targetUnpackedVectors.push(generateUnpackedBinaryVector(vectorSize));
        }
        
        const mockTargetVectors = new MockTargetVectorsWithPacked(targetUnpackedVectors);
        const targetOrds = Array.from({ length: numVectors }, (_, i) => i);
        
        // 预先构造buffer（排除构造时间）
        const concatenatedBuffer = createConcatenatedBuffer(mockTargetVectors, targetOrds);
        const directPackedBuffer = createDirectPackedBuffer(mockTargetVectors, targetOrds, queryPackedVector.length);
        
        // 预热
        for (let i = 0; i < 10; i++) {
          computeBatchDotProductOptimized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
          computeBatchDotProductUltraVectorized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
          computeBatchDotProductDirectPacked(queryPackedVector, directPackedBuffer, numVectors, queryPackedVector.length);
        }
        
        // 测试三个算法
        const timeOptimized = measureTime(() => {
          computeBatchDotProductOptimized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
        }, iterations);
        
        const timeUltraVectorized = measureTime(() => {
          computeBatchDotProductUltraVectorized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
        }, iterations);
        
        const timeDirectPacked = measureTime(() => {
          computeBatchDotProductDirectPacked(queryPackedVector, directPackedBuffer, numVectors, queryPackedVector.length);
        }, iterations);
        
        // 计算加速比
        const speedupUVvsOpt = timeOptimized / timeUltraVectorized;
        const speedupDPvsOpt = timeOptimized / timeDirectPacked;
        const speedupDPvsUV = timeUltraVectorized / timeDirectPacked;
        
        const memorySaved = (concatenatedBuffer.length - directPackedBuffer.length) / 1024; // KB
        
        console.log(`${numVectors}\t\t${vectorSize}\t\t${timeOptimized.toFixed(2)}\t\t${timeUltraVectorized.toFixed(2)}\t\t${timeDirectPacked.toFixed(2)}\t\t${speedupUVvsOpt.toFixed(2)}x\t${speedupDPvsOpt.toFixed(2)}x\t${speedupDPvsUV.toFixed(2)}x\t${memorySaved.toFixed(1)}KB`);
        
        // 验证结果一致性
        const resultOptimized = computeBatchDotProductOptimized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
        const resultUltraVectorized = computeBatchDotProductUltraVectorized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
        const resultDirectPacked = computeBatchDotProductDirectPacked(queryPackedVector, directPackedBuffer, numVectors, queryPackedVector.length);
        
        for (let i = 0; i < numVectors; i++) {
          expect(resultOptimized[i]).toBe(resultUltraVectorized[i]);
          expect(resultUltraVectorized[i]).toBe(resultDirectPacked[i]);
        }
      }
    }
    
    console.log('\n=== 三算法对比总结 ===');
    console.log('1. Optimized：项目中实际使用的算法，八路循环展开');
    console.log('2. UltraVectorized：超向量化版本，使用Uint32Array视图优化');
    console.log('3. DirectPacked：直接打包算法，避免解包开销，按位与+位计数');
    console.log('4. 加速比说明：UV/Opt=超向量化相对优化版本的加速比');
    console.log('5. 加速比说明：DP/Opt=直接打包相对优化版本的加速比');
    console.log('6. 加速比说明：DP/UV=直接打包相对超向量化的加速比');
    console.log('7. 内存节省：直接打包算法相比解包算法的内存节省');
  });

  it('大规模三算法对比测试', () => {
    console.log('\n=== 大规模三算法对比测试 ===');
    const largeTestSizes = [1000, 5000, 10000];
    const largeVectorSizes = [1024, 2048]; // bit数量
    const largeIterations = 50;
    
    console.log('向量数量\t向量大小(bit)\tOptimized(ms)\tUltraVectorized(ms)\tDirectPacked(ms)\tUV/Opt\tDP/Opt\tDP/UV\t内存节省(MB)');
    
    for (const numVectors of largeTestSizes) {
      for (const vectorSize of largeVectorSizes) {
        // 生成大规模测试数据
        const queryUnpackedVector = generateUnpackedBinaryVector(vectorSize);
        const queryPackedVector = packBinaryVector(queryUnpackedVector);
        
        const targetUnpackedVectors: Uint8Array[] = [];
        for (let i = 0; i < numVectors; i++) {
          targetUnpackedVectors.push(generateUnpackedBinaryVector(vectorSize));
        }
        
        const mockTargetVectors = new MockTargetVectorsWithPacked(targetUnpackedVectors);
        const targetOrds = Array.from({ length: numVectors }, (_, i) => i);
        
        // 预先构造buffer（排除构造时间）
        const concatenatedBuffer = createConcatenatedBuffer(mockTargetVectors, targetOrds);
        const directPackedBuffer = createDirectPackedBuffer(mockTargetVectors, targetOrds, queryPackedVector.length);
        
        // 预热
        for (let i = 0; i < 5; i++) {
          computeBatchDotProductOptimized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
          computeBatchDotProductUltraVectorized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
          computeBatchDotProductDirectPacked(queryPackedVector, directPackedBuffer, numVectors, queryPackedVector.length);
        }
        
        // 测试三个算法
        const timeOptimized = measureTime(() => {
          computeBatchDotProductOptimized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
        }, largeIterations);
        
        const timeUltraVectorized = measureTime(() => {
          computeBatchDotProductUltraVectorized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
        }, largeIterations);
        
        const timeDirectPacked = measureTime(() => {
          computeBatchDotProductDirectPacked(queryPackedVector, directPackedBuffer, numVectors, queryPackedVector.length);
        }, largeIterations);
        
        // 计算加速比
        const speedupUVvsOpt = timeOptimized / timeUltraVectorized;
        const speedupDPvsOpt = timeOptimized / timeDirectPacked;
        const speedupDPvsUV = timeUltraVectorized / timeDirectPacked;
        
        const memorySaved = (concatenatedBuffer.length - directPackedBuffer.length) / (1024 * 1024); // MB
        
        console.log(`${numVectors}\t\t${vectorSize}\t\t${timeOptimized.toFixed(2)}\t\t${timeUltraVectorized.toFixed(2)}\t\t${timeDirectPacked.toFixed(2)}\t\t${speedupUVvsOpt.toFixed(2)}x\t${speedupDPvsOpt.toFixed(2)}x\t${speedupDPvsUV.toFixed(2)}x\t${memorySaved.toFixed(2)}MB`);
        
        // 验证结果一致性
        const resultOptimized = computeBatchDotProductOptimized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
        const resultUltraVectorized = computeBatchDotProductUltraVectorized(queryUnpackedVector, concatenatedBuffer, numVectors, queryUnpackedVector.length);
        const resultDirectPacked = computeBatchDotProductDirectPacked(queryPackedVector, directPackedBuffer, numVectors, queryPackedVector.length);
        
        for (let i = 0; i < numVectors; i++) {
          expect(resultOptimized[i]).toBe(resultUltraVectorized[i]);
          expect(resultUltraVectorized[i]).toBe(resultDirectPacked[i]);
        }
      }
    }
    
    console.log('\n=== 大规模测试总结 ===');
    console.log('1. 直接打包算法相比项目中实际使用的Optimized算法有显著性能提升');
    console.log('2. 超向量化算法相比Optimized算法也有一定提升');
    console.log('3. 直接打包算法相比超向量化算法仍有额外提升');
    console.log('4. 内存效率：直接打包算法大幅减少内存使用');
  });
}); 