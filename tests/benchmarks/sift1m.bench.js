"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var path_1 = require("path");
var siftDataLoader_1 = require("./siftDataLoader");
var index_1 = require("../../src/index");
var vectorSimilarity_1 = require("../../src/vectorSimilarity");
/**
 * SIFT1M数据集性能测试
 * 测试重点：
 * 1. 量化性能 - 一次性操作
 * 2. 搜索性能 - 重复操作
 * 3. 内存使用情况
 */
(0, vitest_1.describe)('SIFT1M性能测试', function () {
    // 预加载数据 - 不计入性能测试
    var datasetDir = (0, path_1.join)(__dirname, '../../dataset/sift1m');
    var baseDataset = (0, siftDataLoader_1.loadSiftDataset)(datasetDir, 'base', 100000);
    var queryData = (0, siftDataLoader_1.loadSiftQueries)(datasetDir, 100);
    if (!baseDataset.vectors.length || !queryData.queries.length) {
        throw new Error('数据加载失败');
    }
    // 准备数据
    var baseVectors = baseDataset.vectors.map(function (v) { return v.values; }).filter(function (v) { return v !== undefined; });
    var queryVectors = queryData.queries.map(function (v) { return v.values; }).filter(function (v) { return v !== undefined; });
    if (!baseVectors.length || !queryVectors.length) {
        throw new Error('向量数据无效');
    }
    var k = 10; // topK
    // 创建量化格式实例
    var format = new index_1.BinaryQuantizationFormat({
        queryBits: 1,
        indexBits: 1,
        quantizer: {
            similarityFunction: index_1.VectorSimilarityFunction.COSINE,
            lambda: 0.001,
            iters: 20
        }
    });
    // 预量化基础向量 - 不计入性能测试
    var quantizedData = format.quantizeVectors(baseVectors);
    (0, vitest_1.describe)('量化性能', function () {
        (0, vitest_1.bench)('量化1000000个128维向量', function () {
            format.quantizeVectors(baseVectors);
        });
    });
    (0, vitest_1.describe)('单独搜索性能', function () {
        (0, vitest_1.bench)('量化搜索 - 单个查询', function () {
            var query = queryVectors[0];
            if (query) {
                format.searchNearestNeighbors(query, quantizedData.quantizedVectors, k);
            }
        });
        (0, vitest_1.bench)('暴力搜索 - 单个查询', function () {
            var scores = new Float32Array(baseVectors.length);
            var indices = new Int32Array(baseVectors.length);
            // 初始化索引
            for (var i = 0; i < baseVectors.length; i++) {
                indices[i] = i;
            }
            // 计算相似度
            var query = queryVectors[0];
            if (query) {
                for (var i = 0; i < baseVectors.length; i++) {
                    var baseVector = baseVectors[i];
                    if (baseVector) {
                        scores[i] = (0, vectorSimilarity_1.computeCosineSimilarity)(query, baseVector);
                    }
                    else {
                        scores[i] = 0;
                    }
                }
                // 选择前k个
                for (var i = 0; i < k; i++) {
                    var maxIdx = i;
                    for (var j = i + 1; j < baseVectors.length; j++) {
                        var idxJ = indices[j];
                        var idxMax = indices[maxIdx];
                        if (idxJ !== undefined && idxMax !== undefined &&
                            scores[idxJ] !== undefined && scores[idxMax] !== undefined &&
                            scores[idxJ] > scores[idxMax]) {
                            maxIdx = j;
                        }
                    }
                    if (maxIdx !== i) {
                        var temp = indices[i];
                        var maxIdxValue = indices[maxIdx];
                        if (temp !== undefined && maxIdxValue !== undefined) {
                            indices[i] = maxIdxValue;
                            indices[maxIdx] = temp;
                        }
                    }
                }
            }
        });
    });
});
