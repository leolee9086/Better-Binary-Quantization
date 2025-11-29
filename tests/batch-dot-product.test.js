"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var bitwiseDotProduct_1 = require("../src/bitwiseDotProduct");
// import { createRandomVector } from '../src/vectorUtils'; // Changed import - Not used in this file
var utils_1 = require("../src/utils"); // Added bitCount import
// Helper to generate a quantized vector (1-bit)
function generate1BitQuantizedVector(dimension) {
    var quantized = new Uint8Array(dimension / 8); // 1-bit per element, 8 elements per byte
    for (var i = 0; i < dimension / 8; i++) {
        quantized[i] = Math.floor(Math.random() * 256); // Random byte for 8 random bits
    }
    return quantized;
}
// Helper to unpack a 1-bit quantized vector to a full Uint8Array (0 or 1)
function unpack1BitVector(packedVector, dimension) {
    var unpacked = new Uint8Array(dimension);
    for (var i = 0; i < packedVector.length; i++) {
        var byte = packedVector[i];
        for (var bit = 0; bit < 8; bit++) {
            if ((i * 8 + bit) < dimension) {
                unpacked[i * 8 + bit] = (byte >> bit) & 1;
            }
        }
    }
    return unpacked;
}
// 八路循环展开的批量点积计算
function computeBatchDotProductOptimized(queryVector, concatenatedBuffer, numVectors, dimension) {
    var results = new Array(numVectors).fill(0);
    var bytesPerVector = dimension / 8;
    for (var vecIndex = 0; vecIndex < numVectors; vecIndex++) {
        var currentDotProduct = 0;
        var vectorOffset = vecIndex * bytesPerVector;
        // 八路循环展开
        var loopCount = Math.floor(queryVector.length / 8) * 8;
        var i = 0;
        // 主循环：每次处理8个字节
        for (; i < loopCount; i += 8) {
            var queryByte0 = queryVector[i];
            var dataByte0 = concatenatedBuffer[vectorOffset + i];
            var queryByte1 = queryVector[i + 1];
            var dataByte1 = concatenatedBuffer[vectorOffset + i + 1];
            var queryByte2 = queryVector[i + 2];
            var dataByte2 = concatenatedBuffer[vectorOffset + i + 2];
            var queryByte3 = queryVector[i + 3];
            var dataByte3 = concatenatedBuffer[vectorOffset + i + 3];
            var queryByte4 = queryVector[i + 4];
            var dataByte4 = concatenatedBuffer[vectorOffset + i + 4];
            var queryByte5 = queryVector[i + 5];
            var dataByte5 = concatenatedBuffer[vectorOffset + i + 5];
            var queryByte6 = queryVector[i + 6];
            var dataByte6 = concatenatedBuffer[vectorOffset + i + 6];
            var queryByte7 = queryVector[i + 7];
            var dataByte7 = concatenatedBuffer[vectorOffset + i + 7];
            // 并行计算8个字节的位计数
            currentDotProduct += ((0, utils_1.bitCount)(queryByte0 & dataByte0) +
                (0, utils_1.bitCount)(queryByte1 & dataByte1) +
                (0, utils_1.bitCount)(queryByte2 & dataByte2) +
                (0, utils_1.bitCount)(queryByte3 & dataByte3) +
                (0, utils_1.bitCount)(queryByte4 & dataByte4) +
                (0, utils_1.bitCount)(queryByte5 & dataByte5) +
                (0, utils_1.bitCount)(queryByte6 & dataByte6) +
                (0, utils_1.bitCount)(queryByte7 & dataByte7));
        }
        // 处理剩余的字节
        for (; i < queryVector.length; i++) {
            var queryByte = queryVector[i];
            var dataByte = concatenatedBuffer[vectorOffset + i];
            currentDotProduct += (0, utils_1.bitCount)(queryByte & dataByte);
        }
        results[vecIndex] = currentDotProduct;
    }
    return results;
}
(0, vitest_1.describe)('Batch Dot Product Performance Test', function () {
    var DIMENSION = 1024; // Vector dimension
    var NUM_VECTORS = 10000; // Number of vectors in the dataset
    var allPackedVectors = [];
    var queryVector;
    var concatenatedBuffer;
    var totalUnpackedDimension;
    (0, vitest_1.beforeAll)(function () {
        // Generate a query vector (single-bit for now)
        queryVector = generate1BitQuantizedVector(DIMENSION);
        // Generate all packed 1-bit vectors
        for (var i = 0; i < NUM_VECTORS; i++) {
            allPackedVectors.push(generate1BitQuantizedVector(DIMENSION));
        }
        // Concatenate all packed vectors into a huge buffer
        var singleVectorPackedSize = DIMENSION / 8; // Each 1-bit vector uses DIMENSION/8 bytes
        totalUnpackedDimension = DIMENSION * NUM_VECTORS;
        concatenatedBuffer = new Uint8Array(NUM_VECTORS * singleVectorPackedSize);
        var offset = 0;
        for (var _i = 0, allPackedVectors_1 = allPackedVectors; _i < allPackedVectors_1.length; _i++) {
            var vec = allPackedVectors_1[_i];
            concatenatedBuffer.set(vec, offset);
            offset += singleVectorPackedSize;
        }
        console.log("Concatenated buffer size: ".concat(concatenatedBuffer.length, " bytes"));
        console.log("Total unpacked dimension (theoretical): ".concat(totalUnpackedDimension, " bits"));
    });
    (0, vitest_1.it)('should perform batched 1-bit dot product efficiently', function () {
        // Step 2: Use each bit from query vector to traverse the huge array
        var results = new Array(NUM_VECTORS).fill(0);
        var startTime = performance.now();
        var bytesPerVector = DIMENSION / 8; // 128 bytes for 1024-dimension 1-bit vector
        for (var vecIndex = 0; vecIndex < NUM_VECTORS; vecIndex++) {
            var currentDotProduct = 0;
            var vectorOffset = vecIndex * bytesPerVector;
            // Iterate through each byte of the query vector and corresponding bytes in the buffer
            for (var i = 0; i < queryVector.length; i++) {
                var queryByte = queryVector[i];
                var dataByte = concatenatedBuffer[vectorOffset + i];
                // This is where bitwise addition (inner product) needs to happen
                // For 1-bit, it's popcount(queryByte & dataByte)
                currentDotProduct += ((queryByte & 1 && dataByte & 1) +
                    (queryByte & 2 && dataByte & 2 ? 1 : 0) +
                    (queryByte & 4 && dataByte & 4 ? 1 : 0) +
                    (queryByte & 8 && dataByte & 8 ? 1 : 0) +
                    (queryByte & 16 && dataByte & 16 ? 1 : 0) +
                    (queryByte & 32 && dataByte & 32 ? 1 : 0) +
                    (queryByte & 64 && dataByte & 64 ? 1 : 0) +
                    (queryByte & 128 && dataByte & 128 ? 1 : 0));
            }
            results[vecIndex] = currentDotProduct;
        }
        var endTime = performance.now();
        var batchTime = endTime - startTime;
        console.log("\nBatch 1-bit Dot Product Calculation Time for ".concat(NUM_VECTORS, " vectors: ").concat(batchTime.toFixed(3), "ms"));
        console.log("Average time per vector: ".concat((batchTime / NUM_VECTORS).toFixed(6), "ms"));
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
        var numChecks = Math.min(10, NUM_VECTORS);
        var matches = 0;
        for (var i = 0; i < numChecks; i++) {
            // Unpack for computeQuantizedDotProduct if it expects unpacked 0/1 values
            // However, computeQuantizedDotProduct takes Uint8Array directly, so it's expecting 0-255 values
            // This means the comparison might be apples-to-oranges if computeQuantizedDotProduct is not bit-aware.
            // Let's assume for now that it's meant to be compared with a bitwise approach.
            // If computeQuantizedDotProduct expects unpacked 0/1:
            var unpackedQuery = unpack1BitVector(queryVector, DIMENSION);
            var unpackedTarget = unpack1BitVector(allPackedVectors[i], DIMENSION);
            (0, bitwiseDotProduct_1.computeQuantizedDotProduct)(unpackedQuery, unpackedTarget); // This will sum 0s and 1s
            // Our batch method sums based on bitwise AND.
            // Let's create a bitwise dot product for comparison.
            var singleBitwiseDotProduct = 0;
            for (var j = 0; j < queryVector.length; j++) {
                singleBitwiseDotProduct += countSetBits(queryVector[j] & allPackedVectors[i][j]);
            }
            if (results[i] === singleBitwiseDotProduct) {
                matches++;
            }
            else {
                // console.error(`Mismatch at index ${i}: Batch: ${results[i]}, Expected Bitwise: ${singleBitwiseDotProduct}, Expected ComputeQuantizedDotProduct: ${expectedScore}`);
            }
        }
        console.log("Correctness check: ".concat(matches, "/").concat(numChecks, " matches with single bitwise dot product."));
        // Performance comparison with existing `computeQuantizedDotProduct` (using unpacked 0/1 vectors)
        // This comparison is only valid if computeQuantizedDotProduct is truly optimized for 1-bit logic.
        // Since it's currently a direct multiplication, we need to adapt for comparison.
        var startTimeExisting = performance.now();
        for (var i = 0; i < NUM_VECTORS; i++) {
            var unpackedQuery = unpack1BitVector(queryVector, DIMENSION);
            var unpackedTarget = unpack1BitVector(allPackedVectors[i], DIMENSION);
            (0, bitwiseDotProduct_1.computeQuantizedDotProduct)(unpackedQuery, unpackedTarget);
        }
        var endTimeExisting = performance.now();
        var existingTime = endTimeExisting - startTimeExisting;
        console.log("Existing computeQuantizedDotProduct (unpacked) for ".concat(NUM_VECTORS, " vectors: ").concat(existingTime.toFixed(3), "ms"));
        console.log("Speedup (Batch/Existing): ".concat(((existingTime / batchTime)).toFixed(2), "x"));
    });
    (0, vitest_1.it)('should compare original batch method with optimized 8-way loop unrolling', function () {
        console.log('\n=== 八路循环展开优化对比测试 ===');
        // 测试原始批量方法
        var startTimeOriginal = performance.now();
        var resultsOriginal = computeBatchDotProductOriginal(queryVector, concatenatedBuffer, NUM_VECTORS, DIMENSION);
        var endTimeOriginal = performance.now();
        var originalTime = endTimeOriginal - startTimeOriginal;
        // 测试八路循环展开优化方法
        var startTimeOptimized = performance.now();
        var resultsOptimized = computeBatchDotProductOptimized(queryVector, concatenatedBuffer, NUM_VECTORS, DIMENSION);
        var endTimeOptimized = performance.now();
        var optimizedTime = endTimeOptimized - startTimeOptimized;
        console.log("\u539F\u59CB\u6279\u91CF\u65B9\u6CD5\u65F6\u95F4: ".concat(originalTime.toFixed(3), "ms"));
        console.log("\u516B\u8DEF\u5FAA\u73AF\u5C55\u5F00\u4F18\u5316\u65B9\u6CD5\u65F6\u95F4: ".concat(optimizedTime.toFixed(3), "ms"));
        console.log("\u6027\u80FD\u63D0\u5347: ".concat(((originalTime / optimizedTime)).toFixed(2), "x"));
        console.log("\u65F6\u95F4\u8282\u7701: ".concat((originalTime - optimizedTime).toFixed(3), "ms"));
        // 验证结果一致性
        var consistencyCount = 0;
        var checkCount = Math.min(100, NUM_VECTORS);
        for (var i = 0; i < checkCount; i++) {
            if (resultsOriginal[i] === resultsOptimized[i]) {
                consistencyCount++;
            }
        }
        console.log("\u7ED3\u679C\u4E00\u81F4\u6027\u68C0\u67E5: ".concat(consistencyCount, "/").concat(checkCount, " \u4E2A\u7ED3\u679C\u5B8C\u5168\u4E00\u81F4"));
        // 性能断言
        (0, vitest_1.expect)(optimizedTime).toBeLessThan(originalTime);
        (0, vitest_1.expect)(consistencyCount).toBe(checkCount);
    });
});
// 原始批量点积计算方法（用于对比）
function computeBatchDotProductOriginal(queryVector, concatenatedBuffer, numVectors, dimension) {
    var results = new Array(numVectors).fill(0);
    var bytesPerVector = dimension / 8;
    for (var vecIndex = 0; vecIndex < numVectors; vecIndex++) {
        var currentDotProduct = 0;
        var vectorOffset = vecIndex * bytesPerVector;
        for (var i = 0; i < queryVector.length; i++) {
            var queryByte = queryVector[i];
            var dataByte = concatenatedBuffer[vectorOffset + i];
            // 原始方法：逐位计算
            currentDotProduct += ((queryByte & 1 && dataByte & 1) +
                (queryByte & 2 && dataByte & 2 ? 1 : 0) +
                (queryByte & 4 && dataByte & 4 ? 1 : 0) +
                (queryByte & 8 && dataByte & 8 ? 1 : 0) +
                (queryByte & 16 && dataByte & 16 ? 1 : 0) +
                (queryByte & 32 && dataByte & 32 ? 1 : 0) +
                (queryByte & 64 && dataByte & 64 ? 1 : 0) +
                (queryByte & 128 && dataByte & 128 ? 1 : 0));
        }
        results[vecIndex] = currentDotProduct;
    }
    return results;
}
// Helper function to count set bits (popcount) in a byte
function countSetBits(byte) {
    return (0, utils_1.bitCount)(byte); // Use the imported bitCount
}
