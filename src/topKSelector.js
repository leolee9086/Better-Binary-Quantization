"use strict";
/**
 * TopK选择工具函数
 * 使用最小堆进行高效的topK选择算法
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOversampledTopKWithHeap = getOversampledTopKWithHeap;
exports.getOversampledTopKWithSort = getOversampledTopKWithSort;
var minHeap_1 = require("./minHeap");
var vectorSimilarity_1 = require("./vectorSimilarity");
/**
 * 使用最小堆优化的超采样topK选择
 * @param query 查询向量
 * @param quantizedVectors 量化向量集合
 * @param vectors 原始向量集合
 * @param k 需要的topK数量
 * @param oversampleFactor 超采样因子
 * @param format 量化格式
 * @returns topK候选结果数组
 */
function getOversampledTopKWithHeap(query, quantizedVectors, vectors, k, oversampleFactor, format) {
    var oversampledK = k * oversampleFactor;
    var oversampledResults = format.searchNearestNeighbors(query, quantizedVectors, oversampledK);
    // 使用最小堆维护topK
    var minHeap = new minHeap_1.MinHeap(function (a, b) { return a.trueScore - b.trueScore; });
    for (var _i = 0, oversampledResults_1 = oversampledResults; _i < oversampledResults_1.length; _i++) {
        var result = oversampledResults_1[_i];
        var vector = vectors[result.index];
        if (!vector)
            continue;
        var trueScore = (0, vectorSimilarity_1.computeCosineSimilarity)(query, vector);
        var candidate = {
            index: result.index,
            quantizedScore: result.score,
            trueScore: trueScore
        };
        if (minHeap.size() < k) {
            minHeap.push(candidate);
        }
        else {
            var peek = minHeap.peek();
            if (peek && trueScore > peek.trueScore) {
                minHeap.pop();
                minHeap.push(candidate);
            }
        }
    }
    // 从堆中提取结果并排序
    var topK = [];
    while (!minHeap.isEmpty()) {
        var item = minHeap.pop();
        if (item) {
            topK.push(item);
        }
    }
    // 按真实分数降序排列
    topK.sort(function (a, b) { return b.trueScore - a.trueScore; });
    return topK;
}
/**
 * 传统的排序方法进行topK选择（用于性能对比）
 * @param query 查询向量
 * @param quantizedVectors 量化向量集合
 * @param vectors 原始向量集合
 * @param k 需要的topK数量
 * @param oversampleFactor 超采样因子
 * @param format 量化格式
 * @returns topK候选结果数组
 */
function getOversampledTopKWithSort(query, quantizedVectors, vectors, k, oversampleFactor, format) {
    var oversampledK = k * oversampleFactor;
    var oversampledResults = format.searchNearestNeighbors(query, quantizedVectors, oversampledK);
    var candidateScores = oversampledResults.map(function (result) {
        var vector = vectors[result.index];
        if (!vector)
            return null;
        return {
            index: result.index,
            quantizedScore: result.score,
            trueScore: (0, vectorSimilarity_1.computeCosineSimilarity)(query, vector)
        };
    }).filter(function (candidate) { return candidate !== null; });
    // 按真实分数排序并返回topK
    candidateScores.sort(function (a, b) { return b.trueScore - a.trueScore; });
    return candidateScores.slice(0, k);
}
