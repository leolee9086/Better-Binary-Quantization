import { describe, it, expect, beforeAll } from 'vitest';
import { computeQuantizedDotProduct } from '../src/bitwiseDotProduct';
import { BinaryQuantizationFormat } from '../src/binaryQuantizationFormat';
import type { BinaryQuantizationConfig } from '../src/types';
import { createRandomVector } from '../src/vectorUtils'; // Changed import
import { bitCount } from '../src/utils'; // Added bitCount import

// Helper to generate a quantized vector (1-bit)
function generate1BitQuantizedVector(dimension: number): Uint8Array {
  const floatVector = createRandomVector(dimension); // Changed function name
  const quantized = new Uint8Array(dimension / 8); // 1-bit per element, 8 elements per byte
  for (let i = 0; i < dimension / 8; i++) {
    quantized[i] = Math.floor(Math.random() * 256); // Random byte for 8 random bits
  }
  return quantized;
}

// Helper to unpack a 1-bit quantized vector to a full Uint8Array (0 or 1)
function unpack1BitVector(packedVector: Uint8Array, dimension: number): Uint8Array {
  const unpacked = new Uint8Array(dimension);
  for (let i = 0; i < packedVector.length; i++) {
    const byte = packedVector[i]!;
    for (let bit = 0; bit < 8; bit++) {
      if ((i * 8 + bit) < dimension) {
        unpacked[i * 8 + bit] = (byte >> bit) & 1;
      }
    }
  }
  return unpacked;
}

// 八路循环展开的批量点积计算
function computeBatchDotProductOptimized(
  queryVector: Uint8Array,
  concatenatedBuffer: Uint8Array,
  numVectors: number,
  dimension: number
): number[] {
  const results: number[] = new Array(numVectors).fill(0);
  const bytesPerVector = dimension / 8;
  
  for (let vecIndex = 0; vecIndex < numVectors; vecIndex++) {
    let currentDotProduct = 0;
    const vectorOffset = vecIndex * bytesPerVector;
    
    // 八路循环展开
    const loopCount = Math.floor(queryVector.length / 8) * 8;
    let i = 0;
    
    // 主循环：每次处理8个字节
    for (; i < loopCount; i += 8) {
      const queryByte0 = queryVector[i]!;
      const dataByte0 = concatenatedBuffer[vectorOffset + i]!;
      const queryByte1 = queryVector[i + 1]!;
      const dataByte1 = concatenatedBuffer[vectorOffset + i + 1]!;
      const queryByte2 = queryVector[i + 2]!;
      const dataByte2 = concatenatedBuffer[vectorOffset + i + 2]!;
      const queryByte3 = queryVector[i + 3]!;
      const dataByte3 = concatenatedBuffer[vectorOffset + i + 3]!;
      const queryByte4 = queryVector[i + 4]!;
      const dataByte4 = concatenatedBuffer[vectorOffset + i + 4]!;
      const queryByte5 = queryVector[i + 5]!;
      const dataByte5 = concatenatedBuffer[vectorOffset + i + 5]!;
      const queryByte6 = queryVector[i + 6]!;
      const dataByte6 = concatenatedBuffer[vectorOffset + i + 6]!;
      const queryByte7 = queryVector[i + 7]!;
      const dataByte7 = concatenatedBuffer[vectorOffset + i + 7]!;
      
      // 并行计算8个字节的位计数
      currentDotProduct += (
        bitCount(queryByte0 & dataByte0) +
        bitCount(queryByte1 & dataByte1) +
        bitCount(queryByte2 & dataByte2) +
        bitCount(queryByte3 & dataByte3) +
        bitCount(queryByte4 & dataByte4) +
        bitCount(queryByte5 & dataByte5) +
        bitCount(queryByte6 & dataByte6) +
        bitCount(queryByte7 & dataByte7)
      );
    }
    
    // 处理剩余的字节
    for (; i < queryVector.length; i++) {
      const queryByte = queryVector[i]!;
      const dataByte = concatenatedBuffer[vectorOffset + i]!;
      currentDotProduct += bitCount(queryByte & dataByte);
    }
    
    results[vecIndex] = currentDotProduct;
  }
  
  return results;
}

describe('Batch Dot Product Performance Test', () => {
  const DIMENSION = 1024; // Vector dimension
  const NUM_VECTORS = 10000; // Number of vectors in the dataset
  let allPackedVectors: Uint8Array[] = [];
  let queryVector: Uint8Array;
  let concatenatedBuffer: Uint8Array;
  let totalUnpackedDimension: number;

  beforeAll(() => {
    // Generate a query vector (single-bit for now)
    queryVector = generate1BitQuantizedVector(DIMENSION);

    // Generate all packed 1-bit vectors
    for (let i = 0; i < NUM_VECTORS; i++) {
      allPackedVectors.push(generate1BitQuantizedVector(DIMENSION));
    }

    // Concatenate all packed vectors into a huge buffer
    const singleVectorPackedSize = DIMENSION / 8; // Each 1-bit vector uses DIMENSION/8 bytes
    totalUnpackedDimension = DIMENSION * NUM_VECTORS;
    concatenatedBuffer = new Uint8Array(NUM_VECTORS * singleVectorPackedSize);
    let offset = 0;
    for (const vec of allPackedVectors) {
      concatenatedBuffer.set(vec, offset);
      offset += singleVectorPackedSize;
    }
    console.log(`Concatenated buffer size: ${concatenatedBuffer.length} bytes`);
    console.log(`Total unpacked dimension (theoretical): ${totalUnpackedDimension} bits`);
  });

  it('should perform batched 1-bit dot product efficiently', () => {
    // Step 2: Use each bit from query vector to traverse the huge array
    const queryUnpacked = unpack1BitVector(queryVector, DIMENSION);
    let results: number[] = new Array(NUM_VECTORS).fill(0);

    const startTime = performance.now();

    const bytesPerVector = DIMENSION / 8; // 128 bytes for 1024-dimension 1-bit vector

    for (let vecIndex = 0; vecIndex < NUM_VECTORS; vecIndex++) {
      let currentDotProduct = 0;
      const vectorOffset = vecIndex * bytesPerVector;

      // Iterate through each byte of the query vector and corresponding bytes in the buffer
      for (let i = 0; i < queryVector.length; i++) {
        const queryByte = queryVector[i];
        const dataByte = concatenatedBuffer[vectorOffset + i];

        // This is where bitwise addition (inner product) needs to happen
        // For 1-bit, it's popcount(queryByte & dataByte)
        currentDotProduct += (
          (queryByte & 1 && dataByte & 1) +
          (queryByte & 2 && dataByte & 2 ? 1 : 0) +
          (queryByte & 4 && dataByte & 4 ? 1 : 0) +
          (queryByte & 8 && dataByte & 8 ? 1 : 0) +
          (queryByte & 16 && dataByte & 16 ? 1 : 0) +
          (queryByte & 32 && dataByte & 32 ? 1 : 0) +
          (queryByte & 64 && dataByte & 64 ? 1 : 0) +
          (queryByte & 128 && dataByte & 128 ? 1 : 0)
        );
      }
      results[vecIndex] = currentDotProduct;
    }

    const endTime = performance.now();
    const batchTime = endTime - startTime;

    console.log(`
Batch 1-bit Dot Product Calculation Time for ${NUM_VECTORS} vectors: ${batchTime.toFixed(3)}ms`);
    console.log(`Average time per vector: ${(batchTime / NUM_VECTORS).toFixed(6)}ms`);

    // Verify some results (simple check, assume dot product for 1-bit is sum of (q_i & d_i))
    // For 1-bit vectors, dot product is essentially Hamming distance / popcount of XOR (if -1,1 encoding)
    // or popcount of AND (if 0,1 encoding)
    // Given the current setup (Uint8Array, random bytes), let's assume it's popcount of AND for now.
    // The previous computeQuantizedDotProduct assumed direct multiplication for Uint8Array,
    // but for 1-bit, it's usually based on bitwise operations.
    // Since the request is to compare "bitwise addition", let's make sure our current `computeQuantizedDotProduct`
    // is correctly handling 1-bit or if we need a specialized one for proper comparison.
    // For now, let's just make sure it runs and print results.

    // A simple test for correctness: compare a few results with the existing computeQuantizedDotProduct
    const numChecks = Math.min(10, NUM_VECTORS);
    let matches = 0;
    for (let i = 0; i < numChecks; i++) {
      // Unpack for computeQuantizedDotProduct if it expects unpacked 0/1 values
      // However, computeQuantizedDotProduct takes Uint8Array directly, so it's expecting 0-255 values
      // This means the comparison might be apples-to-oranges if computeQuantizedDotProduct is not bit-aware.
      // Let's assume for now that it's meant to be compared with a bitwise approach.

      // If computeQuantizedDotProduct expects unpacked 0/1:
      const unpackedQuery = unpack1BitVector(queryVector, DIMENSION);
      const unpackedTarget = unpack1BitVector(allPackedVectors[i], DIMENSION);
      const expectedScore = computeQuantizedDotProduct(unpackedQuery, unpackedTarget); // This will sum 0s and 1s

      // Our batch method sums based on bitwise AND.
      // Let's create a bitwise dot product for comparison.
      let singleBitwiseDotProduct = 0;
      for(let j = 0; j < queryVector.length; j++) {
        singleBitwiseDotProduct += countSetBits(queryVector[j] & allPackedVectors[i][j]);
      }

      if (results[i] === singleBitwiseDotProduct) {
        matches++;
      } else {
        // console.error(`Mismatch at index ${i}: Batch: ${results[i]}, Expected Bitwise: ${singleBitwiseDotProduct}, Expected ComputeQuantizedDotProduct: ${expectedScore}`);
      }
    }
    console.log(`Correctness check: ${matches}/${numChecks} matches with single bitwise dot product.`);

    // Performance comparison with existing `computeQuantizedDotProduct` (using unpacked 0/1 vectors)
    // This comparison is only valid if computeQuantizedDotProduct is truly optimized for 1-bit logic.
    // Since it's currently a direct multiplication, we need to adapt for comparison.
    const startTimeExisting = performance.now();
    for (let i = 0; i < NUM_VECTORS; i++) {
      const unpackedQuery = unpack1BitVector(queryVector, DIMENSION);
      const unpackedTarget = unpack1BitVector(allPackedVectors[i], DIMENSION);
      computeQuantizedDotProduct(unpackedQuery, unpackedTarget);
    }
    const endTimeExisting = performance.now();
    const existingTime = endTimeExisting - startTimeExisting;
    console.log(`Existing computeQuantizedDotProduct (unpacked) for ${NUM_VECTORS} vectors: ${existingTime.toFixed(3)}ms`);
    console.log(`Speedup (Batch/Existing): ${((existingTime / batchTime)).toFixed(2)}x`);
  });

  it('should compare original batch method with optimized 8-way loop unrolling', () => {
    console.log('\n=== 八路循环展开优化对比测试 ===');
    
    // 测试原始批量方法
    const startTimeOriginal = performance.now();
    const resultsOriginal = computeBatchDotProductOriginal(queryVector, concatenatedBuffer, NUM_VECTORS, DIMENSION);
    const endTimeOriginal = performance.now();
    const originalTime = endTimeOriginal - startTimeOriginal;
    
    // 测试八路循环展开优化方法
    const startTimeOptimized = performance.now();
    const resultsOptimized = computeBatchDotProductOptimized(queryVector, concatenatedBuffer, NUM_VECTORS, DIMENSION);
    const endTimeOptimized = performance.now();
    const optimizedTime = endTimeOptimized - startTimeOptimized;
    
    console.log(`原始批量方法时间: ${originalTime.toFixed(3)}ms`);
    console.log(`八路循环展开优化方法时间: ${optimizedTime.toFixed(3)}ms`);
    console.log(`性能提升: ${((originalTime / optimizedTime)).toFixed(2)}x`);
    console.log(`时间节省: ${(originalTime - optimizedTime).toFixed(3)}ms`);
    
    // 验证结果一致性
    let consistencyCount = 0;
    const checkCount = Math.min(100, NUM_VECTORS);
    for (let i = 0; i < checkCount; i++) {
      if (resultsOriginal[i] === resultsOptimized[i]) {
        consistencyCount++;
      }
    }
    console.log(`结果一致性检查: ${consistencyCount}/${checkCount} 个结果完全一致`);
    
    // 性能断言
    expect(optimizedTime).toBeLessThan(originalTime);
    expect(consistencyCount).toBe(checkCount);
  });
});

// 原始批量点积计算方法（用于对比）
function computeBatchDotProductOriginal(
  queryVector: Uint8Array,
  concatenatedBuffer: Uint8Array,
  numVectors: number,
  dimension: number
): number[] {
  const results: number[] = new Array(numVectors).fill(0);
  const bytesPerVector = dimension / 8;
  
  for (let vecIndex = 0; vecIndex < numVectors; vecIndex++) {
    let currentDotProduct = 0;
    const vectorOffset = vecIndex * bytesPerVector;
    
    for (let i = 0; i < queryVector.length; i++) {
      const queryByte = queryVector[i];
      const dataByte = concatenatedBuffer[vectorOffset + i];
      
      // 原始方法：逐位计算
      currentDotProduct += (
        (queryByte & 1 && dataByte & 1) +
        (queryByte & 2 && dataByte & 2 ? 1 : 0) +
        (queryByte & 4 && dataByte & 4 ? 1 : 0) +
        (queryByte & 8 && dataByte & 8 ? 1 : 0) +
        (queryByte & 16 && dataByte & 16 ? 1 : 0) +
        (queryByte & 32 && dataByte & 32 ? 1 : 0) +
        (queryByte & 64 && dataByte & 64 ? 1 : 0) +
        (queryByte & 128 && dataByte & 128 ? 1 : 0)
      );
    }
    
    results[vecIndex] = currentDotProduct;
  }
  
  return results;
}

// Helper function to count set bits (popcount) in a byte
function countSetBits(byte: number): number {
  return bitCount(byte); // Use the imported bitCount
}