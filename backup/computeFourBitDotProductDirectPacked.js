"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeBatchFourBitDotProductDirectPacked = computeBatchFourBitDotProductDirectPacked;
/* 正确的4位批量点积算法（查询未打包，目标打包）
 * @param queryVector 4位量化查询向量 (未打包, 每字节1个值)
 * @param continuousBuffer 1位量化目标向量的连续打包buffer
 * @param numVectors 向量数量
 * @param dimension 向量维度
 * @returns 点积结果数组
 */
function computeBatchFourBitDotProductDirectPacked(queryVector, continuousBuffer, numVectors, dimension) {
    var results = new Array(numVectors).fill(0);
    var packedDimension = Math.ceil(dimension / 8);
    // 单层循环，直接遍历所有维度
    for (var dim = 0; dim < dimension; dim++) {
        // 计算对应的字节索引和位索引
        var byteIndex = Math.floor(dim / 8);
        var bitIndex = 7 - (dim % 8);
        // 处理所有向量在这个维度上的点积
        for (var vecIndex = 0; vecIndex < numVectors; vecIndex++) {
            var targetOffset = vecIndex * packedDimension;
            var targetByte = continuousBuffer[targetOffset + byteIndex];
            // 查询向量是未打包的, 直接按索引取值
            var queryValue = queryVector[dim];
            // 从目标字节中提取对应位
            var targetValue = (targetByte >> bitIndex) & 1;
            // 直接相乘并累加
            results[vecIndex] += queryValue * targetValue;
        }
    }
    return results;
}
