"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeBatchFourBitDotProductDirectPacked = computeBatchFourBitDotProductDirectPacked;
/*
 * Optimized 4-bit batch dot product (query unpacked, target packed)
 * @param queryVector 4比特量化查询向量（未打包格式）
 * @param continuousBuffer 连续打包的1比特目标向量
 * @param numVectors 向量数量
 * @param dimension 向量维度
 * @returns 点积结果数组
 */
function computeBatchFourBitDotProductDirectPacked(queryVector, continuousBuffer, numVectors, dimension) {
    var results = new Array(numVectors).fill(0);
    var packedDimension = Math.ceil(dimension / 8);
    var mainPackedDimension = Math.floor(dimension / 8);
    for (var i = 0; i < numVectors; i++) {
        var dotProduct = 0;
        var targetOffset = i * packedDimension;
        // Main unrolled loop for full bytes
        for (var j = 0; j < mainPackedDimension; j++) {
            var packedValue = continuousBuffer[targetOffset + j];
            var queryOffset = j * 8;
            dotProduct += queryVector[queryOffset] * ((packedValue >> 7) & 1);
            dotProduct += queryVector[queryOffset + 1] * ((packedValue >> 6) & 1);
            dotProduct += queryVector[queryOffset + 2] * ((packedValue >> 5) & 1);
            dotProduct += queryVector[queryOffset + 3] * ((packedValue >> 4) & 1);
            dotProduct += queryVector[queryOffset + 4] * ((packedValue >> 3) & 1);
            dotProduct += queryVector[queryOffset + 5] * ((packedValue >> 2) & 1);
            dotProduct += queryVector[queryOffset + 6] * ((packedValue >> 1) & 1);
            dotProduct += queryVector[queryOffset + 7] * (packedValue & 1);
        }
        // Handle remaining bits if dimension is not a multiple of 8
        var remainderStartDim = mainPackedDimension * 8;
        if (remainderStartDim < dimension) {
            var lastPackedValue = continuousBuffer[targetOffset + mainPackedDimension];
            for (var dim = remainderStartDim; dim < dimension; dim++) {
                var bitIndex = 7 - (dim % 8);
                var targetValue = (lastPackedValue >> bitIndex) & 1;
                dotProduct += queryVector[dim] * targetValue;
            }
        }
        results[i] = dotProduct;
    }
    return results;
}
