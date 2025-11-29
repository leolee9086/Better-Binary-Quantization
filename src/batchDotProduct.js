"use strict";
/**
 * 批量点积计算模块
 * 实现高效的批量点积计算，支持八路循环展开优化
 * 基于Lucene的二值量化实现
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeBatchFourBitDotProductDirectPacked = void 0;
exports.computeBatchDotProductDirectPacked = computeBatchDotProductDirectPacked;
exports.computeBatchDotProductUltraVectorized = computeBatchDotProductUltraVectorized;
exports.computeBatchFourBitDotProductUltraVectorized = computeBatchFourBitDotProductUltraVectorized;
exports.computeBatchDotProductOptimized = computeBatchDotProductOptimized;
exports.computeBatchFourBitDotProductOptimized = computeBatchFourBitDotProductOptimized;
exports.computeBatchDotProductTrueOriginal = computeBatchDotProductTrueOriginal;
exports.computeBatchDotProductOriginal = computeBatchDotProductOriginal;
exports.createConcatenatedBuffer = createConcatenatedBuffer;
exports.createDirectPackedBuffer = createDirectPackedBuffer;
exports.createDirectPackedBufferFourBit = createDirectPackedBufferFourBit;
exports.computeBatchOneBitSimilarityScores = computeBatchOneBitSimilarityScores;
exports.computeBatchFourBitSimilarityScores = computeBatchFourBitSimilarityScores;
var types_1 = require("./types");
var bitwiseDotProduct_1 = require("./bitwiseDotProduct");
var constants_1 = require("./constants");
var bitcount_1 = require("./utils/bitcount");
/**
 * 直接处理打包向量的超向量化批量点积计算
 * 使用预构造的连续buffer进行计算，避免解包开销
 * 对于单比特数据，使用按位与+位计数
 * @param queryVector 查询向量（已打包）
 * @param continuousBuffer 预构造的连续buffer
 * @param numVectors 向量数量
 * @param dimension 向量维度
 * @returns 点积结果数组
 */
function computeBatchDotProductDirectPacked(queryVector, continuousBuffer, numVectors) {
    var results = new Array(numVectors).fill(0);
    var queryLength = queryVector.length;
    for (var vecIndex = 0; vecIndex < numVectors; vecIndex++) {
        var currentDotProduct = 0;
        var vectorOffset = vecIndex * queryLength;
        // 处理打包后的数据（每个字节0-255）
        // 使用按位与+位计数
        for (var i = 0; i < queryLength; i++) {
            var queryByte = queryVector[i];
            var targetByte = continuousBuffer[vectorOffset + i];
            // 按位与，然后计算1的个数
            var andResult = queryByte & targetByte;
            currentDotProduct += (0, bitcount_1.bitCount32Optimized)(andResult);
        }
        results[vecIndex] = currentDotProduct;
    }
    return results;
}
/**
 * 超向量化批量点积计算 - 使用Uint32Array一次处理4个字节
 * 这是真正的向量化批量操作，避免了逐字节循环
 * @param queryVector 查询向量
 * @param concatenatedBuffer 连接的目标向量缓冲区
 * @param numVectors 向量数量
 * @param dimension 向量维度
 * @returns 点积结果数组
 */
function computeBatchDotProductUltraVectorized(queryVector, concatenatedBuffer, numVectors) {
    var results = new Array(numVectors).fill(0);
    var bytesPerVector = queryVector.length;
    var queryLength = queryVector.length;
    // 使用Uint32Array视图来一次处理4个字节
    var uint32Length = Math.floor(queryLength / 4);
    var remainderStart = uint32Length * 4;
    // 创建查询向量的Uint32Array视图
    var query32 = new Uint32Array(queryVector.buffer, queryVector.byteOffset, uint32Length);
    for (var vecIndex = 0; vecIndex < numVectors; vecIndex++) {
        var currentDotProduct = 0;
        var vectorOffset = vecIndex * bytesPerVector;
        // 创建当前目标向量的Uint32Array视图
        var target32 = new Uint32Array(concatenatedBuffer.buffer, concatenatedBuffer.byteOffset + vectorOffset, uint32Length);
        // 向量化处理：一次处理4个字节
        for (var i = 0; i < uint32Length; i++) {
            // 使用直接乘法而不是按位与，与现有算法保持一致
            var query32Val = query32[i];
            var target32Val = target32[i];
            // 将32位值分解为4个8位值进行乘法
            var q0 = (query32Val & 0xFF);
            var q1 = ((query32Val >> 8) & 0xFF);
            var q2 = ((query32Val >> 16) & 0xFF);
            var q3 = ((query32Val >> 24) & 0xFF);
            var t0 = (target32Val & 0xFF);
            var t1 = ((target32Val >> 8) & 0xFF);
            var t2 = ((target32Val >> 16) & 0xFF);
            var t3 = ((target32Val >> 24) & 0xFF);
            currentDotProduct += (q0 * t0 + q1 * t1 + q2 * t2 + q3 * t3);
        }
        // 处理剩余的字节（如果有的话）
        for (var i = remainderStart; i < queryLength; i++) {
            var queryByte = queryVector[i];
            var dataByte = concatenatedBuffer[vectorOffset + i];
            currentDotProduct += queryByte * dataByte;
        }
        results[vecIndex] = currentDotProduct;
    }
    return results;
}
/**
 * 超向量化批量点积计算（4位量化版本）
 * 4位量化查询向量与1位量化索引向量的超向量化批量点积计算
 * @param queryVector 4位量化查询向量
 * @param concatenatedBuffer 连接的目标向量缓冲区
 * @param numVectors 向量数量
 * @param dimension 向量维度
 * @returns 点积结果数组
 */
function computeBatchFourBitDotProductUltraVectorized(queryVector, concatenatedBuffer, numVectors) {
    var results = new Array(numVectors).fill(0);
    var bytesPerVector = queryVector.length;
    var queryLength = queryVector.length;
    // 使用Uint32Array视图来一次处理4个字节
    var uint32Length = Math.floor(queryLength / 4);
    var remainderStart = uint32Length * 4;
    // 创建查询向量的Uint32Array视图
    var query32 = new Uint32Array(queryVector.buffer, queryVector.byteOffset, uint32Length);
    for (var vecIndex = 0; vecIndex < numVectors; vecIndex++) {
        var currentDotProduct = 0;
        var vectorOffset = vecIndex * bytesPerVector;
        // 创建当前目标向量的Uint32Array视图
        var target32 = new Uint32Array(concatenatedBuffer.buffer, concatenatedBuffer.byteOffset + vectorOffset, uint32Length);
        // 向量化处理：一次处理4个字节
        for (var i = 0; i < uint32Length; i++) {
            // 使用直接乘法而不是按位与，与现有算法保持一致
            var query32Val = query32[i];
            var target32Val = target32[i];
            // 将32位值分解为4个8位值进行乘法
            var q0 = (query32Val & 0xFF);
            var q1 = ((query32Val >> 8) & 0xFF);
            var q2 = ((query32Val >> 16) & 0xFF);
            var q3 = ((query32Val >> 24) & 0xFF);
            var t0 = (target32Val & 0xFF);
            var t1 = ((target32Val >> 8) & 0xFF);
            var t2 = ((target32Val >> 16) & 0xFF);
            var t3 = ((target32Val >> 24) & 0xFF);
            currentDotProduct += (q0 * t0 + q1 * t1 + q2 * t2 + q3 * t3);
        }
        // 处理剩余的字节（如果有的话）
        for (var i = remainderStart; i < queryLength; i++) {
            var queryByte = queryVector[i];
            var dataByte = concatenatedBuffer[vectorOffset + i];
            currentDotProduct += queryByte * dataByte;
        }
        results[vecIndex] = currentDotProduct;
    }
    return results;
}
/**
 * 八路循环展开的批量点积计算（适用于1位量化）
 * 将所有二值化向量连接成一个大缓冲区，使用八路循环展开进行高效计算
 * @param queryVector 查询向量
 * @param concatenatedBuffer 连接的目标向量缓冲区
 * @param numVectors 向量数量
 * @param dimension 向量维度
 * @returns 点积结果数组
 */
function computeBatchDotProductOptimized(queryVector, concatenatedBuffer, numVectors) {
    var results = new Array(numVectors).fill(0);
    var bytesPerVector = queryVector.length;
    var queryLength = queryVector.length;
    var loopCount = Math.floor(queryLength / 8) * 8;
    var remainingStart = loopCount;
    for (var vecIndex = 0; vecIndex < numVectors; vecIndex++) {
        var currentDotProduct = 0;
        var vectorOffset = vecIndex * bytesPerVector;
        // 主循环：每次处理8个字节
        for (var i = 0; i < loopCount; i += 8) {
            var offset = vectorOffset + i;
            var queryByte0 = queryVector[i];
            var dataByte0 = concatenatedBuffer[offset];
            var queryByte1 = queryVector[i + 1];
            var dataByte1 = concatenatedBuffer[offset + 1];
            var queryByte2 = queryVector[i + 2];
            var dataByte2 = concatenatedBuffer[offset + 2];
            var queryByte3 = queryVector[i + 3];
            var dataByte3 = concatenatedBuffer[offset + 3];
            var queryByte4 = queryVector[i + 4];
            var dataByte4 = concatenatedBuffer[offset + 4];
            var queryByte5 = queryVector[i + 5];
            var dataByte5 = concatenatedBuffer[offset + 5];
            var queryByte6 = queryVector[i + 6];
            var dataByte6 = concatenatedBuffer[offset + 6];
            var queryByte7 = queryVector[i + 7];
            var dataByte7 = concatenatedBuffer[offset + 7];
            // 并行计算8个字节的直接点积
            currentDotProduct += (queryByte0 * dataByte0 +
                queryByte1 * dataByte1 +
                queryByte2 * dataByte2 +
                queryByte3 * dataByte3 +
                queryByte4 * dataByte4 +
                queryByte5 * dataByte5 +
                queryByte6 * dataByte6 +
                queryByte7 * dataByte7);
        }
        // 处理剩余的字节
        for (var i = remainingStart; i < queryLength; i++) {
            var queryByte = queryVector[i];
            var dataByte = concatenatedBuffer[vectorOffset + i];
            currentDotProduct += queryByte * dataByte;
        }
        results[vecIndex] = currentDotProduct;
    }
    return results;
}
/**
 * 八路循环展开的4位量化批量点积计算
 * 4位量化查询向量与1位量化索引向量的批量点积计算
 * @param queryVector 4位量化查询向量
 * @param concatenatedBuffer 连接的目标向量缓冲区
 * @param numVectors 向量数量
 * @param dimension 向量维度
 * @returns 点积结果数组
 */
function computeBatchFourBitDotProductOptimized(queryVector, concatenatedBuffer, numVectors) {
    var results = new Array(numVectors).fill(0);
    var bytesPerVector = queryVector.length;
    var queryLength = queryVector.length;
    var loopCount = Math.floor(queryLength / 8) * 8;
    var remainingStart = loopCount;
    for (var vecIndex = 0; vecIndex < numVectors; vecIndex++) {
        var currentDotProduct = 0;
        var vectorOffset = vecIndex * bytesPerVector;
        // 主循环：每次处理8个字节
        for (var i = 0; i < loopCount; i += 8) {
            var offset = vectorOffset + i;
            var queryByte0 = queryVector[i];
            var dataByte0 = concatenatedBuffer[offset];
            var queryByte1 = queryVector[i + 1];
            var dataByte1 = concatenatedBuffer[offset + 1];
            var queryByte2 = queryVector[i + 2];
            var dataByte2 = concatenatedBuffer[offset + 2];
            var queryByte3 = queryVector[i + 3];
            var dataByte3 = concatenatedBuffer[offset + 3];
            var queryByte4 = queryVector[i + 4];
            var dataByte4 = concatenatedBuffer[offset + 4];
            var queryByte5 = queryVector[i + 5];
            var dataByte5 = concatenatedBuffer[offset + 5];
            var queryByte6 = queryVector[i + 6];
            var dataByte6 = concatenatedBuffer[offset + 6];
            var queryByte7 = queryVector[i + 7];
            var dataByte7 = concatenatedBuffer[offset + 7];
            // 并行计算8个字节的直接点积
            currentDotProduct += (queryByte0 * dataByte0 +
                queryByte1 * dataByte1 +
                queryByte2 * dataByte2 +
                queryByte3 * dataByte3 +
                queryByte4 * dataByte4 +
                queryByte5 * dataByte5 +
                queryByte6 * dataByte6 +
                queryByte7 * dataByte7);
        }
        // 处理剩余的字节
        for (var i = remainingStart; i < queryLength; i++) {
            var queryByte = queryVector[i];
            var dataByte = concatenatedBuffer[vectorOffset + i];
            currentDotProduct += queryByte * dataByte;
        }
        results[vecIndex] = currentDotProduct;
    }
    return results;
}
/**
 * 真正的原始算法：逐个调用computeInt1BitDotProduct
 * @param queryVector 查询向量
 * @param targetVectors 目标向量集合
 * @param targetOrds 目标向量序号数组
 * @returns 点积结果数组
 */
function computeBatchDotProductTrueOriginal(queryVector, targetVectors, targetOrds) {
    var results = new Array(targetOrds.length).fill(0);
    for (var i = 0; i < targetOrds.length; i++) {
        var unpackedBinaryCode = targetVectors.getUnpackedVector(targetOrds[i]);
        results[i] = (0, bitwiseDotProduct_1.computeInt1BitDotProduct)(queryVector, unpackedBinaryCode);
    }
    return results;
}
/**
 * 批量点积计算的原始方法（直接点积计算）
 * @param queryVector 查询向量
 * @param concatenatedBuffer 连接的目标向量缓冲区
 * @param numVectors 向量数量
 * @param dimension 向量维度
 * @returns 点积结果数组
 */
function computeBatchDotProductOriginal(queryVector, concatenatedBuffer, numVectors) {
    var results = new Array(numVectors).fill(0);
    var bytesPerVector = queryVector.length;
    var queryLength = queryVector.length;
    for (var vecIndex = 0; vecIndex < numVectors; vecIndex++) {
        var currentDotProduct = 0;
        var vectorOffset = vecIndex * bytesPerVector;
        for (var i = 0; i < queryLength; i++) {
            var queryByte = queryVector[i];
            var dataByte = concatenatedBuffer[vectorOffset + i];
            // 直接点积计算
            currentDotProduct += queryByte * dataByte;
        }
        results[vecIndex] = currentDotProduct;
    }
    return results;
}
/**
 * 创建连接的目标向量缓冲区
 * 将所有目标向量连接成一个大的连续缓冲区，用于批量计算
 * @param targetVectors 目标向量集合
 * @param targetOrds 目标向量序号数组
 * @returns 连接的目标向量缓冲区
 */
function createConcatenatedBuffer(targetVectors, targetOrds) {
    if (targetOrds.length === 0) {
        return new Uint8Array(0);
    }
    // 获取第一个向量的长度作为基准
    var firstVector = targetVectors.getUnpackedVector(targetOrds[0]);
    var vectorLength = firstVector.length;
    var totalLength = vectorLength * targetOrds.length;
    // 创建连接缓冲区
    var concatenatedBuffer = new Uint8Array(totalLength);
    // 连接所有向量
    for (var i = 0; i < targetOrds.length; i++) {
        var vector = targetVectors.getUnpackedVector(targetOrds[i]);
        var offset = i * vectorLength;
        concatenatedBuffer.set(vector, offset);
    }
    return concatenatedBuffer;
}
/**
 * 构造直接打包算法的连续buffer
 * 将打包向量直接复制到连续buffer中，避免解包开销
 * @param targetVectors 目标向量集合（包含打包向量）
 * @param targetOrds 目标向量序号数组
 * @param vectorSize 向量大小
 * @returns 连续buffer
 */
function createDirectPackedBuffer(targetVectors, targetOrds, vectorSize) {
    var numVectors = targetOrds.length;
    var continuousBuffer = new Uint8Array(vectorSize * numVectors);
    // 将打包向量直接复制到连续buffer中
    for (var i = 0; i < numVectors; i++) {
        var targetVector = targetVectors.vectorValue(targetOrds[i]);
        var offset = i * vectorSize;
        continuousBuffer.set(targetVector, offset);
    }
    return continuousBuffer;
}
/**
 * 构造直接打包算法的连续buffer（4位量化版本）
 * @param targetVectors 目标向量集合（包含打包向量）
 * @param targetOrds 目标向量序号数组
 * @param vectorSize 向量大小
 * @returns 连续buffer
 */
function createDirectPackedBufferFourBit(targetVectors, targetOrds, vectorSize) {
    // 4位量化：直接使用打包的1位量化向量，不解包！
    var packedVectorSize = Math.ceil(vectorSize / 8);
    var totalSize = targetOrds.length * packedVectorSize;
    var buffer = new Uint8Array(totalSize);
    for (var i = 0; i < targetOrds.length; i++) {
        var packedVector = targetVectors.vectorValue(targetOrds[i]);
        var offset = i * packedVectorSize;
        // 直接复制打包的向量数据，不解包！
        buffer.set(packedVector, offset);
    }
    return buffer;
}
/**
 * 批量计算1位量化相似性分数
 * @param qcDists 批量点积结果
 * @param queryCorrections 查询向量修正因子
 * @param targetVectors 目标向量集合
 * @param targetOrds 目标向量序号数组
 * @param dimension 向量维度
 * @param centroidDP 质心点积
 * @param similarityFunction 相似性函数
 * @returns 相似性分数数组
 */
function computeBatchOneBitSimilarityScores(qcDists, queryCorrections, targetVectors, targetOrds, dimension, centroidDP, similarityFunction) {
    var scores = [];
    for (var i = 0; i < targetOrds.length; i++) {
        var qcDist = qcDists[i];
        var indexCorrections = targetVectors.getCorrectiveTerms(targetOrds[i]);
        // 按照Lucene二值量化原始实现计算分数
        var x1 = indexCorrections.quantizedComponentSum;
        var ax = indexCorrections.lowerInterval;
        var lx = indexCorrections.upperInterval - ax;
        var ay = queryCorrections.lowerInterval;
        var ly = queryCorrections.upperInterval - ay;
        var y1 = queryCorrections.quantizedComponentSum;
        // 计算基础分数
        var score = ax * ay * dimension +
            ay * lx * x1 +
            ax * ly * y1 +
            lx * ly * qcDist;
        // 根据相似性函数调整分数
        switch (similarityFunction) {
            case types_1.VectorSimilarityFunction.EUCLIDEAN:
                score = queryCorrections.additionalCorrection +
                    indexCorrections.additionalCorrection -
                    2 * score;
                scores.push(Math.max(1 / (1 + score), 0));
                break;
            case types_1.VectorSimilarityFunction.COSINE:
                score += queryCorrections.additionalCorrection +
                    indexCorrections.additionalCorrection -
                    centroidDP;
                scores.push(Math.max((1 + score) / 2, 0));
                break;
            case types_1.VectorSimilarityFunction.MAXIMUM_INNER_PRODUCT:
                score += queryCorrections.additionalCorrection +
                    indexCorrections.additionalCorrection -
                    centroidDP;
                // 1位量化：不使用FOUR_BIT_SCALE
                if (score < 0) {
                    scores.push(1 / (1 - score));
                }
                else {
                    scores.push(score + 1);
                }
                break;
            default:
                throw new Error("\u4E0D\u652F\u6301\u7684\u76F8\u4F3C\u6027\u51FD\u6570: ".concat(similarityFunction));
        }
    }
    return scores;
}
/**
 * 批量计算4位量化相似性分数
 * @param qcDists 批量点积结果
 * @param queryCorrections 查询向量修正因子
 * @param targetVectors 目标向量集合
 * @param targetOrds 目标向量序号数组
 * @param dimension 向量维度
 * @param centroidDP 质心点积
 * @param similarityFunction 相似性函数
 * @returns 相似性分数数组
 */
function computeBatchFourBitSimilarityScores(qcDists, queryCorrections, targetVectors, targetOrds, dimension, centroidDP, similarityFunction) {
    var scores = [];
    for (var i = 0; i < targetOrds.length; i++) {
        var qcDist = qcDists[i];
        var indexCorrections = targetVectors.getCorrectiveTerms(targetOrds[i]);
        // 按照Lucene二值量化原始实现计算分数
        var x1 = indexCorrections.quantizedComponentSum;
        var ax = indexCorrections.lowerInterval;
        var lx = indexCorrections.upperInterval - ax;
        var ay = queryCorrections.lowerInterval;
        var ly = (queryCorrections.upperInterval - ay) * constants_1.FOUR_BIT_SCALE; // 4位量化使用FOUR_BIT_SCALE
        var y1 = queryCorrections.quantizedComponentSum;
        // 计算基础分数
        var score = ax * ay * dimension +
            ay * lx * x1 +
            ax * ly * y1 +
            lx * ly * qcDist;
        // 根据相似性函数调整分数
        switch (similarityFunction) {
            case types_1.VectorSimilarityFunction.EUCLIDEAN:
                var euclideanScore = queryCorrections.additionalCorrection +
                    indexCorrections.additionalCorrection -
                    2 * score;
                scores.push(Math.max(1 / (1 + euclideanScore), 0));
                break;
            case types_1.VectorSimilarityFunction.COSINE:
            case types_1.VectorSimilarityFunction.MAXIMUM_INNER_PRODUCT:
                var adjustedScore = score + queryCorrections.additionalCorrection +
                    indexCorrections.additionalCorrection -
                    centroidDP;
                if (similarityFunction === types_1.VectorSimilarityFunction.MAXIMUM_INNER_PRODUCT) {
                    // 使用scaleMaxInnerProductScore函数
                    if (adjustedScore < 0) {
                        scores.push(1 / (1 - adjustedScore / constants_1.FOUR_BIT_SCALE));
                    }
                    else {
                        scores.push(adjustedScore / constants_1.FOUR_BIT_SCALE + 1);
                    }
                }
                else {
                    // COSINE
                    scores.push(Math.max((1 + adjustedScore) / 2, 0));
                }
                break;
            default:
                throw new Error("\u4E0D\u652F\u6301\u7684\u76F8\u4F3C\u6027\u51FD\u6570: ".concat(similarityFunction));
        }
    }
    return scores;
}
var computeBatchFourBitDotProductDirectPacked_1 = require("./utils/computeBatchFourBitDotProductDirectPacked");
Object.defineProperty(exports, "computeBatchFourBitDotProductDirectPacked", { enumerable: true, get: function () { return computeBatchFourBitDotProductDirectPacked_1.computeBatchFourBitDotProductDirectPacked; } });
