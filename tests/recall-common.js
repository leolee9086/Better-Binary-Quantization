"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECALL_TEST_CONFIGS = void 0;
exports.createFixedDataset = createFixedDataset;
exports.getTrueTopK = getTrueTopK;
exports.getQuantizedTopK = getQuantizedTopK;
exports.computeRecall = computeRecall;
exports.createQuantizationFormat = createQuantizationFormat;
exports.getOversampledQuantizedTopK = getOversampledQuantizedTopK;
exports.executeRecallTest = executeRecallTest;
exports.executeOversampledRecallTest = executeOversampledRecallTest;
var binaryQuantizationFormat_1 = require("../src/binaryQuantizationFormat");
var types_1 = require("../src/types");
var vectorSimilarity_1 = require("../src/vectorSimilarity");
var vectorOperations_1 = require("../src/vectorOperations");
/**
 * 常见嵌入引擎的召回率测试配置
 */
exports.RECALL_TEST_CONFIGS = {
    // 384维 - BERT、RoBERTa等
    '384d': {
        dimension: 384,
        baseSize: 1000,
        querySize: 20,
        k: 10,
        recallThreshold1bit: 0.60,
        recallThreshold4bit: 0.75,
        recallThresholdOversample: 0.80,
        oversampleFactor: 3,
        quantizerConfig: {
            lambda: 0.001,
            iters: 20
        }
    },
    // 768维 - BERT-large、RoBERTa-large等
    '768d': {
        dimension: 768,
        baseSize: 1000,
        querySize: 20,
        k: 10,
        recallThreshold1bit: 0.55,
        recallThreshold4bit: 0.70,
        recallThresholdOversample: 0.75,
        oversampleFactor: 3,
        quantizerConfig: {
            lambda: 0.001,
            iters: 20
        }
    },
    // 1024维 - 一些大型模型
    '1024d': {
        dimension: 1024,
        baseSize: 1000,
        querySize: 20,
        k: 10,
        recallThreshold1bit: 0.50,
        recallThreshold4bit: 0.65,
        recallThresholdOversample: 0.70,
        oversampleFactor: 3,
        quantizerConfig: {
            lambda: 0.001,
            iters: 20
        }
    },
    // 1536维 - 更大型模型
    '1536d': {
        dimension: 1536,
        baseSize: 1000,
        querySize: 20,
        k: 10,
        recallThreshold1bit: 0.45,
        recallThreshold4bit: 0.60,
        recallThresholdOversample: 0.65,
        oversampleFactor: 3,
        quantizerConfig: {
            lambda: 0.001,
            iters: 20
        }
    }
};
/**
 * 生成固定的随机数据集
 */
function createFixedDataset(config) {
    var dimension = config.dimension, baseSize = config.baseSize, querySize = config.querySize;
    var baseVectors = [];
    var queryVectors = [];
    // 生成base向量
    for (var i = 0; i < baseSize; i++) {
        var vector = new Float32Array(dimension);
        for (var j = 0; j < dimension; j++) {
            var seed = i * 1000 + j;
            vector[j] = Math.sin(seed) * 0.5 + Math.cos(seed * 0.7) * 0.3;
        }
        baseVectors.push((0, vectorOperations_1.normalizeVector)(vector));
    }
    // 生成query向量
    for (var i = 0; i < querySize; i++) {
        var vector = new Float32Array(dimension);
        for (var j = 0; j < dimension; j++) {
            var seed = (i + 1000) * 1000 + j;
            vector[j] = Math.sin(seed) * 0.5 + Math.cos(seed * 0.7) * 0.3;
        }
        queryVectors.push((0, vectorOperations_1.normalizeVector)(vector));
    }
    return { baseVectors: baseVectors, queryVectors: queryVectors };
}
/**
 * 计算真实TopK（暴力法）
 */
function getTrueTopK(query, base, k) {
    var scores = base.map(function (vec, idx) { return ({
        idx: idx,
        score: (0, vectorSimilarity_1.computeCosineSimilarity)(query, vec)
    }); });
    return scores.sort(function (a, b) { return b.score - a.score; }).slice(0, k).map(function (x) { return x.idx; });
}
/**
 * 计算量化TopK
 */
function getQuantizedTopK(query, quantizedBase, k, format) {
    var results = format.searchNearestNeighbors(query, quantizedBase, k);
    return results.map(function (x) { return x.index; });
}
/**
 * 计算召回率
 */
function computeRecall(trueTopK, quantizedTopK) {
    var hit = 0;
    for (var _i = 0, quantizedTopK_1 = quantizedTopK; _i < quantizedTopK_1.length; _i++) {
        var idx = quantizedTopK_1[_i];
        if (trueTopK.includes(idx))
            hit++;
    }
    return hit / trueTopK.length;
}
/**
 * 创建量化格式
 */
function createQuantizationFormat(queryBits, indexBits, config) {
    return new binaryQuantizationFormat_1.BinaryQuantizationFormat({
        queryBits: queryBits,
        indexBits: indexBits,
        quantizer: {
            similarityFunction: types_1.VectorSimilarityFunction.COSINE,
            lambda: config.quantizerConfig.lambda,
            iters: config.quantizerConfig.iters
        }
    });
}
/**
 * 超采样量化TopK计算
 */
function getOversampledQuantizedTopK(query, quantizedBase, k, oversampleFactor, format, baseVectors) {
    var oversampledK = k * oversampleFactor;
    var oversampledResults = format.searchNearestNeighbors(query, quantizedBase, oversampledK);
    var candidateScores = oversampledResults.map(function (result) {
        var baseVector = baseVectors[result.index];
        if (!baseVector) {
            throw new Error("\u57FA\u7840\u5411\u91CF".concat(result.index, "\u4E0D\u5B58\u5728"));
        }
        return {
            index: result.index,
            quantizedScore: result.score,
            trueScore: (0, vectorSimilarity_1.computeCosineSimilarity)(query, baseVector)
        };
    });
    var sortedCandidates = candidateScores.sort(function (a, b) { return b.trueScore - a.trueScore; });
    return sortedCandidates.slice(0, k).map(function (x) { return x.index; });
}
/**
 * 执行召回率测试
 */
function executeRecallTest(config, queryBits, indexBits, baseVectors, queryVectors, testName) {
    var format = createQuantizationFormat(queryBits, indexBits, config);
    var quantizedVectors = format.quantizeVectors(baseVectors).quantizedVectors;
    var totalRecall = 0;
    for (var i = 0; i < config.querySize; i++) {
        var query = queryVectors[i];
        if (!query) {
            throw new Error("\u67E5\u8BE2\u5411\u91CF".concat(i, "\u4E0D\u5B58\u5728"));
        }
        var trueTopK = getTrueTopK(query, baseVectors, config.k);
        var quantizedTopK = getQuantizedTopK(query, quantizedVectors, config.k, format);
        var recall = computeRecall(trueTopK, quantizedTopK);
        totalRecall += recall;
        // eslint-disable-next-line no-console
        console.log("".concat(testName, " query#").concat(i, ": recall=").concat(recall.toFixed(3)));
    }
    var avgRecall = totalRecall / config.querySize;
    // eslint-disable-next-line no-console
    console.log("".concat(testName, " avgRecall:"), avgRecall.toFixed(3));
    return avgRecall;
}
/**
 * 执行超采样召回率测试
 */
function executeOversampledRecallTest(config, baseVectors, queryVectors, testName) {
    var format = createQuantizationFormat(4, 1, config); // 4位查询 + 1位索引
    var quantizedVectors = format.quantizeVectors(baseVectors).quantizedVectors;
    var totalRecall = 0;
    for (var i = 0; i < config.querySize; i++) {
        var query = queryVectors[i];
        if (!query) {
            throw new Error("\u67E5\u8BE2\u5411\u91CF".concat(i, "\u4E0D\u5B58\u5728"));
        }
        var trueTopK = getTrueTopK(query, baseVectors, config.k);
        var quantizedTopK = getOversampledQuantizedTopK(query, quantizedVectors, config.k, config.oversampleFactor, format, baseVectors);
        var recall = computeRecall(trueTopK, quantizedTopK);
        totalRecall += recall;
        // eslint-disable-next-line no-console
        console.log("".concat(testName, " query#").concat(i, ": recall=").concat(recall.toFixed(3)));
    }
    var avgRecall = totalRecall / config.querySize;
    // eslint-disable-next-line no-console
    console.log("".concat(testName, " avgRecall:"), avgRecall.toFixed(3));
    return avgRecall;
}
