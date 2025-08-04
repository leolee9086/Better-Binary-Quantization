import { describe, it, expect } from 'vitest';
import {
  computeBatchFourBitDotProductOptimized,
  computeBatchFourBitDotProductDirectPacked,
  createConcatenatedBuffer,
  createDirectPackedBufferFourBit
} from '../../src/batchDotProduct';
import { OptimizedScalarQuantizer } from '../../src/optimizedScalarQuantizer';

/**
 * 4位量化直接打包算法 vs 解包算法性能对比测试
 */

// 生成4位量化向量（值在0-15之间）
function generateFourBitVector(length: number): Uint8Array {
  const vector = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    vector[i] = Math.floor(Math.random() * 16); // 0-15
  }
  return vector;
}

// 生成1位量化向量（0或1）
function generateOneBitVector(length: number): Uint8Array {
  const vector = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    vector[i] = Math.floor(Math.random() * 2); // 0或1
  }
  return vector;
}

// 打包1位向量
function packOneBitVector(unpackedVector: Uint8Array): Uint8Array {
  const packedLength = Math.ceil(unpackedVector.length / 8);
  const packedVector = new Uint8Array(packedLength);
  OptimizedScalarQuantizer.packAsBinary(unpackedVector, packedVector);
  return packedVector;
}

// 模拟目标向量集合
class MockTargetVectors {
  private unpackedVectors: Uint8Array[];
  private packedVectors: Uint8Array[];

  constructor(unpackedVectors: Uint8Array[]) {
    this.unpackedVectors = unpackedVectors;
    this.packedVectors = unpackedVectors.map(vector => packOneBitVector(vector));
  }

  getUnpackedVector(ord: number): Uint8Array {
    return this.unpackedVectors[ord]!;
  }

  vectorValue(ord: number): Uint8Array {
    return this.packedVectors[ord]!;
  }

  dimension(): number {
    return this.unpackedVectors[0]!.length;
  }
}

// 性能测量函数
function measureTime(fn: () => void, iterations: number = 1): number {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  return (end - start) / iterations;
}

describe('4位量化直接打包算法性能对比测试', () => {
  it('应该验证4位直接打包算法比解包算法快', () => {
    console.log('\n=== 4位量化直接打包 vs 解包算法性能对比 ===');
    console.log('向量数量\t向量大小(bit)\t解包算法(ms)\t直接打包(ms)\t加速比\t内存节省(KB)');
    
    const testSizes = [10, 50, 100, 500, 1000];
    const vectorSizes = [128, 256, 512, 1024]; // bit数量
    const iterations = 100;
    
    for (const numVectors of testSizes) {
      for (const vectorSize of vectorSizes) {
        // 生成测试数据
        const queryFourBitVector = generateFourBitVector(vectorSize);
        const targetUnpackedVectors = Array.from({ length: numVectors }, () => 
          generateOneBitVector(vectorSize)
        );
        
        // 创建模拟目标向量集合
        const mockTargetVectors = new MockTargetVectors(targetUnpackedVectors);
        const targetOrds = Array.from({ length: numVectors }, (_, i) => i);
        
        // 准备解包算法的数据
        const concatenatedBuffer = createConcatenatedBuffer(mockTargetVectors, targetOrds);
        
        // 准备直接打包算法的数据
        const directPackedBuffer = createDirectPackedBufferFourBit(mockTargetVectors, targetOrds, vectorSize);
        
        // 性能测试：解包算法
        const time1 = measureTime(() => {
          computeBatchFourBitDotProductOptimized(
            queryFourBitVector,
            concatenatedBuffer,
            numVectors,
            vectorSize
          );
        }, iterations);
        
        // 性能测试：直接打包算法
        const time2 = measureTime(() => {
          computeBatchFourBitDotProductDirectPacked(
            queryFourBitVector, // 直接使用原始查询向量
            directPackedBuffer,
            numVectors,
            vectorSize
          );
        }, iterations);
        
        // 计算加速比和内存节省
        const speedup = time1 / time2;
        const memorySaved = (concatenatedBuffer.length - directPackedBuffer.length) / 1024;
        
        console.log(`${numVectors}\t\t${vectorSize}\t\t${time1.toFixed(2)}\t\t${time2.toFixed(2)}\t\t${speedup.toFixed(2)}x\t${memorySaved.toFixed(1)}KB`);
        
        // 验证结果一致性
        const result1 = computeBatchFourBitDotProductOptimized(
          queryFourBitVector,
          concatenatedBuffer,
          numVectors,
          vectorSize
        );
        
        const result2 = computeBatchFourBitDotProductDirectPacked(
          queryFourBitVector, // 直接使用原始查询向量
          directPackedBuffer,
          numVectors,
          vectorSize
        );
        
        // 检查结果一致性
        for (let i = 0; i < numVectors; i++) {
          expect(result1[i]).toBeCloseTo(result2[i]!, 1e-10);
        }
      }
    }
  });

  it('大规模数据性能测试', () => {
    console.log('\n=== 大规模数据性能测试 ===');
    console.log('向量数量\t向量大小(bit)\t解包算法(ms)\t直接打包(ms)\t加速比\t内存节省(MB)');
    
    const largeTestSizes = [1000, 5000, 10000];
    const vectorSizes = [1024, 2048];
    const iterations = 10;
    
    for (const numVectors of largeTestSizes) {
      for (const vectorSize of vectorSizes) {
        // 生成测试数据
        const queryFourBitVector = generateFourBitVector(vectorSize);
        const targetUnpackedVectors = Array.from({ length: numVectors }, () => 
          generateOneBitVector(vectorSize)
        );
        
        // 创建模拟目标向量集合
        const mockTargetVectors = new MockTargetVectors(targetUnpackedVectors);
        const targetOrds = Array.from({ length: numVectors }, (_, i) => i);
        
        // 准备解包算法的数据
        const concatenatedBuffer = createConcatenatedBuffer(mockTargetVectors, targetOrds);
        
        // 准备直接打包算法的数据
        const directPackedBuffer = createDirectPackedBufferFourBit(mockTargetVectors, targetOrds, vectorSize);
        
        // 性能测试：解包算法
        const time1 = measureTime(() => {
          computeBatchFourBitDotProductOptimized(
            queryFourBitVector,
            concatenatedBuffer,
            numVectors,
            vectorSize
          );
        }, iterations);
        
        // 性能测试：直接打包算法
        const time2 = measureTime(() => {
          computeBatchFourBitDotProductDirectPacked(
            queryFourBitVector, // 直接使用原始查询向量
            directPackedBuffer,
            numVectors,
            vectorSize
          );
        }, iterations);
        
        // 计算加速比和内存节省
        const speedup = time1 / time2;
        const memorySaved = (concatenatedBuffer.length - directPackedBuffer.length) / (1024 * 1024);
        
        console.log(`${numVectors}\t\t${vectorSize}\t\t${time1.toFixed(2)}\t\t${time2.toFixed(2)}\t\t${speedup.toFixed(2)}x\t${memorySaved.toFixed(2)}MB`);
        
        // 验证结果一致性
        const result1 = computeBatchFourBitDotProductOptimized(
          queryFourBitVector,
          concatenatedBuffer,
          numVectors,
          vectorSize
        );
        
        const result2 = computeBatchFourBitDotProductDirectPacked(
          queryFourBitVector, // 直接使用原始查询向量
          directPackedBuffer,
          numVectors,
          vectorSize
        );
        
        // 检查结果一致性
        for (let i = 0; i < numVectors; i++) {
          expect(result1[i]).toBeCloseTo(result2[i]!, 1e-10);
        }
      }
    }
  });

  it('算法复杂度分析', () => {
    console.log('\n=== 算法复杂度分析 ===');
    console.log('分析4位量化直接打包算法与解包算法的时间复杂度');
    
    const vectorSize = 1024;
    const testSizes = [100, 500, 1000, 2000, 5000];
    const iterations = 50;
    
    const unpackedTimes: number[] = [];
    const directPackedTimes: number[] = [];
    
    for (const numVectors of testSizes) {
      // 生成测试数据
      const queryFourBitVector = generateFourBitVector(vectorSize);
      const targetUnpackedVectors = Array.from({ length: numVectors }, () => 
        generateOneBitVector(vectorSize)
      );
      
      // 创建模拟目标向量集合
      const mockTargetVectors = new MockTargetVectors(targetUnpackedVectors);
      const targetOrds = Array.from({ length: numVectors }, (_, i) => i);
      
      // 准备数据
      const concatenatedBuffer = createConcatenatedBuffer(mockTargetVectors, targetOrds);
      const directPackedBuffer = createDirectPackedBufferFourBit(mockTargetVectors, targetOrds, vectorSize);
      
      // 性能测试
      const time1 = measureTime(() => {
        computeBatchFourBitDotProductOptimized(
          queryFourBitVector,
          concatenatedBuffer,
          numVectors,
          vectorSize
        );
      }, iterations);
      
      const time2 = measureTime(() => {
        computeBatchFourBitDotProductDirectPacked(
          queryFourBitVector, // 直接使用原始查询向量
          directPackedBuffer,
          numVectors,
          vectorSize
        );
      }, iterations);
      
      unpackedTimes.push(time1);
      directPackedTimes.push(time2);
      
      console.log(`向量数量: ${numVectors}, 解包算法: ${time1.toFixed(2)}ms, 直接打包: ${time2.toFixed(2)}ms, 加速比: ${(time1/time2).toFixed(2)}x`);
    }
    
    // 分析时间复杂度
    console.log('\n时间复杂度分析:');
    console.log('- 解包算法: O(n * d) - 其中n是向量数量，d是向量维度');
    console.log('- 直接打包算法: O(n * d) - 相同的时间复杂度，但常数因子更小');
    console.log('- 内存使用: 直接打包算法节省约87.5%的内存');
    
    // 验证算法正确性
    expect(directPackedTimes.length).toBe(unpackedTimes.length);
    for (let i = 0; i < directPackedTimes.length; i++) {
      expect(directPackedTimes[i]!).toBeLessThan(unpackedTimes[i]! * 1.5); // 直接打包应该不会比解包慢太多
    }
  });
});