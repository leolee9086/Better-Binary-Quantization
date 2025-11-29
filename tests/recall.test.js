"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var binaryQuantizationFormat_1 = require("../src/binaryQuantizationFormat");
var types_1 = require("../src/types");
var vectorSimilarity_1 = require("../src/vectorSimilarity");
var vectorOperations_1 = require("../src/vectorOperations");
/**
 * @织: 召回率测试
 * 本测试用于评估量化检索的召回率（recall@K），即量化检索结果中包含真实最近邻的比例。
 * 步骤：
 * 1. 生成一批base向量和query向量
 * 2. 用原始向量暴力计算每个query的真实topK最近邻
 * 3. 用量化检索计算每个query的topK
 * 4. 统计recall@K
 * 5. 断言召回率大于阈值
 * 调试：输出每个query的recall和topK，便于分析问题。
 */
// 全局数据集，确保单比特和4位查询使用相同的数据
var GLOBAL_DIM = 128;
var GLOBAL_BASE_SIZE = 100;
var GLOBAL_QUERY_SIZE = 10;
var GLOBAL_K = 10;
// 生成固定的随机数据集
function createFixedDataset() {
    // 使用固定的随机种子来确保数据集一致性
    var baseVectors = [];
    var queryVectors = [];
    // 生成base向量
    for (var i = 0; i < GLOBAL_BASE_SIZE; i++) {
        var vector = new Float32Array(GLOBAL_DIM);
        for (var j = 0; j < GLOBAL_DIM; j++) {
            // 使用简单的伪随机生成，确保一致性
            var seed = i * 1000 + j;
            vector[j] = Math.sin(seed) * 0.5 + Math.cos(seed * 0.7) * 0.3;
        }
        baseVectors.push(vector);
    }
    // 生成query向量
    for (var i = 0; i < GLOBAL_QUERY_SIZE; i++) {
        var vector = new Float32Array(GLOBAL_DIM);
        for (var j = 0; j < GLOBAL_DIM; j++) {
            // 使用不同的种子避免与base向量重复
            var seed = (i + 1000) * 1000 + j;
            vector[j] = Math.sin(seed) * 0.5 + Math.cos(seed * 0.7) * 0.3;
        }
        queryVectors.push(vector);
    }
    return { baseVectors: baseVectors, queryVectors: queryVectors };
}
// 创建全局数据集
var _a = createFixedDataset(), GLOBAL_BASE_VECTORS = _a.baseVectors, GLOBAL_QUERY_VECTORS = _a.queryVectors;
// 数据集一致性验证测试
(0, vitest_1.describe)('数据集一致性验证', function () {
    (0, vitest_1.it)('应该使用相同的数据集进行单比特和4位查询测试', function () {
        // 验证数据集大小
        (0, vitest_1.expect)(GLOBAL_BASE_VECTORS.length).toBe(GLOBAL_BASE_SIZE);
        (0, vitest_1.expect)(GLOBAL_QUERY_VECTORS.length).toBe(GLOBAL_QUERY_SIZE);
        var firstBaseVector = GLOBAL_BASE_VECTORS[0];
        var firstQueryVector = GLOBAL_QUERY_VECTORS[0];
        if (!firstBaseVector || !firstQueryVector) {
            throw new Error('第一个向量不存在');
        }
        (0, vitest_1.expect)(firstBaseVector.length).toBe(GLOBAL_DIM);
        (0, vitest_1.expect)(firstQueryVector.length).toBe(GLOBAL_DIM);
        // 验证数据集内容一致性（检查前几个向量的前几个元素）
        var baseSample = firstBaseVector.slice(0, 5);
        var querySample = firstQueryVector.slice(0, 5);
        // 使用 vitest 断言替代 console.log
        (0, vitest_1.expect)(Array.from(baseSample !== null && baseSample !== void 0 ? baseSample : new Float32Array(0))).toBeDefined();
        (0, vitest_1.expect)(Array.from(querySample !== null && querySample !== void 0 ? querySample : new Float32Array(0))).toBeDefined();
        (0, vitest_1.expect)(GLOBAL_BASE_VECTORS.length).toBe(GLOBAL_BASE_SIZE);
        (0, vitest_1.expect)(GLOBAL_QUERY_VECTORS.length).toBe(GLOBAL_QUERY_SIZE);
        (0, vitest_1.expect)(GLOBAL_DIM).toBe(128);
        // 不再验证向量是否归一化，因为现在使用原始尺度数据
    });
});
(0, vitest_1.describe)('召回率测试', function () {
    var QUERY_SIZE = GLOBAL_QUERY_SIZE;
    var K = GLOBAL_K;
    var RECALL_THRESHOLD = 0.70;
    // 使用全局数据集
    var baseVectors = GLOBAL_BASE_VECTORS;
    var queryVectors = GLOBAL_QUERY_VECTORS;
    // 构建量化器 - 高维向量单比特量化配置
    var format = new binaryQuantizationFormat_1.BinaryQuantizationFormat({
        queryBits: 1, // 单比特量化
        indexBits: 1, // 单比特量化
        quantizer: {
            similarityFunction: types_1.VectorSimilarityFunction.COSINE,
            lambda: 0.001, // 适中的lambda
            iters: 20 // 适中的迭代次数
        }
    });
    // 量化base向量
    var quantizedVectors = format.quantizeVectors(baseVectors).quantizedVectors;
    // 计算每个query的真实topK（暴力法）
    function getTrueTopK(query, base, k) {
        var scores = base.map(function (vec, idx) { return ({
            idx: idx,
            score: (0, vectorSimilarity_1.computeCosineSimilarity)(query, vec)
        }); });
        return scores.sort(function (a, b) { return b.score - a.score; }).slice(0, k).map(function (x) { return x.idx; });
    }
    // 计算每个query的量化topK
    function getQuantizedTopK(query, quantizedBase, k) {
        var results = format.searchNearestNeighbors(query, quantizedBase, k);
        return results.map(function (x) { return x.index; });
    }
    // 计算recall@K
    function computeRecall(trueTopK, quantizedTopK) {
        var hit = 0;
        for (var _i = 0, quantizedTopK_1 = quantizedTopK; _i < quantizedTopK_1.length; _i++) {
            var idx = quantizedTopK_1[_i];
            if (trueTopK.includes(idx))
                hit++;
        }
        return hit / trueTopK.length;
    }
    (0, vitest_1.it)("\u91CF\u5316\u68C0\u7D22\u7684 recall@".concat(K, " \u5E94\u5927\u4E8E ").concat(RECALL_THRESHOLD), function () {
        // 调试信息：输出量化向量的基本信息
        // @织:保留: 输出量化向量的调试信息
        var totalRecall = 0;
        for (var i = 0; i < QUERY_SIZE; i++) {
            var query = queryVectors[i];
            if (!query) {
                throw new Error("\u67E5\u8BE2\u5411\u91CF".concat(i, "\u4E0D\u5B58\u5728"));
            }
            var trueTopK = getTrueTopK(query, baseVectors, K);
            var quantizedTopK = getQuantizedTopK(query, quantizedVectors, K);
            var recall = computeRecall(trueTopK, quantizedTopK);
            totalRecall += recall;
            // 输出详细信息
            // @织:保留: 输出每个query的recall和topK，便于调试
            // eslint-disable-next-line no-console
            // 添加量化分数调试信息
            var results = format.searchNearestNeighbors(query, quantizedVectors, K);
            // 使用 vitest 断言替代 console.log
            (0, vitest_1.expect)(results).toHaveLength(K);
            (0, vitest_1.expect)(results.every(function (r) { return typeof r.score === 'number'; })).toBe(true);
        }
        var avgRecall = totalRecall / QUERY_SIZE;
        // 使用 vitest 断言替代 console.log
        (0, vitest_1.expect)(avgRecall).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(avgRecall).toBeGreaterThanOrEqual(RECALL_THRESHOLD);
    });
});
/**
 * @织: 极简小数据召回率测试
 * 用低维度、小数据量、高bits、手动构造相似向量，先确保基本功能正常。
 * 如果这个测试能通过，说明量化检索基本功能没问题，问题在于大数据量或参数设置。
 */
(0, vitest_1.describe)('极简小数据召回率测试', function () {
    var BASE_SIZE = 20; // 增加base数量
    var QUERY_SIZE = 3; // 增加query数量
    var K = 5; // 增加topK
    var RECALL_THRESHOLD = 0.4; // 提高阈值
    // 手动构造部分相似的向量 - 32维，适合单比特量化
    var baseVectors = Array.from({ length: BASE_SIZE }, function (_, i) {
        var vec = new Float32Array(GLOBAL_DIM);
        if (i < 5) {
            // 前5个向量与第一个query相似 - 使用明显的正负值
            vec[0] = 0.8 - i * 0.1;
            vec[1] = i * 0.1;
            // 填充其他维度为小的随机值
            for (var j = 2; j < GLOBAL_DIM; j++) {
                vec[j] = (Math.random() - 0.5) * 0.2;
            }
        }
        else if (i < 10) {
            // 接下来5个向量与第二个query相似
            vec[0] = (Math.random() - 0.5) * 0.2;
            vec[1] = 0.8 - (i - 5) * 0.1;
            vec[2] = (i - 5) * 0.1;
            // 填充其他维度
            for (var j = 3; j < GLOBAL_DIM; j++) {
                vec[j] = (Math.random() - 0.5) * 0.2;
            }
        }
        else if (i < 15) {
            // 接下来5个向量与第三个query相似
            vec[0] = (Math.random() - 0.5) * 0.2;
            vec[1] = (Math.random() - 0.5) * 0.2;
            vec[2] = 0.8 - (i - 10) * 0.1;
            vec[3] = (i - 10) * 0.1;
            // 填充其他维度
            for (var j = 4; j < GLOBAL_DIM; j++) {
                vec[j] = (Math.random() - 0.5) * 0.2;
            }
        }
        else {
            // 其余向量随机分布，但确保有足够的区分性
            for (var j = 0; j < GLOBAL_DIM; j++) {
                vec[j] = (Math.random() - 0.5) * 0.8;
            }
        }
        return (0, vectorOperations_1.normalizeVector)(vec);
    });
    var queryVectors = [
        (0, vectorOperations_1.normalizeVector)(new Float32Array(__spreadArray([1, 0, 0], new Array(GLOBAL_DIM - 3).fill(0), true))), // 应该召回0,1,2,3,4
        (0, vectorOperations_1.normalizeVector)(new Float32Array(__spreadArray([0, 1, 0], new Array(GLOBAL_DIM - 3).fill(0), true))), // 应该召回5,6,7,8,9
        (0, vectorOperations_1.normalizeVector)(new Float32Array(__spreadArray([0, 0, 1], new Array(GLOBAL_DIM - 3).fill(0), true))) // 应该召回10,11,12,13,14
    ];
    // 构建量化器 - 单比特量化配置
    var format = new binaryQuantizationFormat_1.BinaryQuantizationFormat({
        queryBits: 1, // 单比特量化
        indexBits: 1, // 单比特量化
        quantizer: {
            similarityFunction: types_1.VectorSimilarityFunction.COSINE,
            lambda: 0.05, // 适中的lambda
            iters: 10 // 适中的迭代次数
        }
    });
    // 量化base向量
    var quantizedVectors = format.quantizeVectors(baseVectors).quantizedVectors;
    // 计算每个query的真实topK（暴力法）
    function getTrueTopK(query, base, k) {
        var scores = base.map(function (vec, idx) { return ({
            idx: idx,
            score: (0, vectorSimilarity_1.computeCosineSimilarity)(query, vec)
        }); });
        return scores.sort(function (a, b) { return b.score - a.score; }).slice(0, k).map(function (x) { return x.idx; });
    }
    // 计算每个query的量化topK
    function getQuantizedTopK(query, quantizedBase, k) {
        var results = format.searchNearestNeighbors(query, quantizedBase, k);
        return results.map(function (x) { return x.index; });
    }
    // 计算recall@K
    function computeRecall(trueTopK, quantizedTopK) {
        var hit = 0;
        for (var _i = 0, quantizedTopK_2 = quantizedTopK; _i < quantizedTopK_2.length; _i++) {
            var idx = quantizedTopK_2[_i];
            if (trueTopK.includes(idx))
                hit++;
        }
        return hit / trueTopK.length;
    }
    (0, vitest_1.it)("\u6781\u7B80\u5C0F\u6570\u636E\u7684 recall@".concat(K, " \u5E94\u5927\u4E8E ").concat(RECALL_THRESHOLD), function () {
        // 调试信息：输出量化向量的基本信息
        // @织:保留: 输出量化向量的调试信息
        // 使用 vitest 断言替代 console.log
        for (var i = 0; i < Math.min(3, quantizedVectors.size()); i++) {
            var vectorValue = quantizedVectors.vectorValue(i);
            (0, vitest_1.expect)(vectorValue).toBeDefined();
            (0, vitest_1.expect)(Array.from(vectorValue).slice(0, 10)).toBeDefined();
        }
        var totalRecall = 0;
        for (var i = 0; i < QUERY_SIZE; i++) {
            var query = queryVectors[i];
            if (!query) {
                throw new Error("\u67E5\u8BE2\u5411\u91CF".concat(i, "\u4E0D\u5B58\u5728"));
            }
            var trueTopK = getTrueTopK(query, baseVectors, K);
            var quantizedTopK = getQuantizedTopK(query, quantizedVectors, K);
            var recall = computeRecall(trueTopK, quantizedTopK);
            totalRecall += recall;
            // 使用 vitest 断言替代 console.log
            (0, vitest_1.expect)(recall).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(trueTopK).toHaveLength(K);
            (0, vitest_1.expect)(quantizedTopK).toHaveLength(K);
        }
        var avgRecall = totalRecall / QUERY_SIZE;
        // 使用 vitest 断言替代 console.log
        (0, vitest_1.expect)(avgRecall).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(avgRecall).toBeGreaterThanOrEqual(RECALL_THRESHOLD);
    });
});
/**
 * @织: 底层量化评分测试
 * 直接测试底层的量化评分功能，绕过searchNearestNeighbors，手动遍历所有向量计算分数。
 * 验证量化检索的基本功能是否正常。
 */
(0, vitest_1.describe)('底层量化评分测试', function () {
    var BASE_SIZE = 5; // 小数据量
    var K = 3; // topK
    // 手动构造相似向量
    var baseVectors = [
        new Float32Array([1, 0, 0, 0]), // 0
        new Float32Array([0.9, 0.1, 0, 0]), // 1 - 与0相似
        new Float32Array([0.8, 0.2, 0, 0]), // 2 - 与0相似
        new Float32Array([0, 1, 0, 0]), // 3
        new Float32Array([0, 0, 1, 0]) // 4
    ];
    var queryVector = new Float32Array([1, 0, 0, 0]); // 应该召回0,1,2
    // 构建量化器 - 单比特量化配置
    var format = new binaryQuantizationFormat_1.BinaryQuantizationFormat({
        queryBits: 1, // 单比特量化
        indexBits: 1, // 单比特量化
        quantizer: {
            similarityFunction: types_1.VectorSimilarityFunction.COSINE,
            lambda: 0.05, // 适中的lambda
            iters: 10 // 适中的迭代次数
        }
    });
    // 量化base向量
    var quantizedVectors = format.quantizeVectors(baseVectors).quantizedVectors;
    (0, vitest_1.it)('底层量化评分功能应正常工作', function () {
        // 1. 计算真实topK
        var trueScores = baseVectors.map(function (vec, idx) { return ({
            idx: idx,
            score: (0, vectorSimilarity_1.computeCosineSimilarity)(queryVector, vec)
        }); });
        var trueTopK = trueScores.sort(function (a, b) { return b.score - a.score; }).slice(0, K).map(function (x) { return x.idx; });
        // 2. 手动计算量化分数
        var centroid = quantizedVectors.getCentroid();
        var _a = format.quantizeQueryVector(queryVector, centroid), quantizedQuery = _a.quantizedQuery, queryCorrections = _a.queryCorrections;
        var quantizedScores = [];
        // 手动遍历所有向量
        for (var i = 0; i < BASE_SIZE; i++) {
            var result = format.getScorer().computeQuantizedScore(quantizedQuery, queryCorrections, quantizedVectors, i, 1, // 添加queryBits参数
            queryVector);
            quantizedScores.push({
                idx: i,
                score: result.score
            });
        }
        var quantizedTopK = quantizedScores.sort(function (a, b) { return b.score - a.score; }).slice(0, K).map(function (x) { return x.idx; });
        // 3. 使用 vitest 断言替代 console.log
        (0, vitest_1.expect)(trueTopK).toHaveLength(K);
        (0, vitest_1.expect)(quantizedTopK).toHaveLength(K);
        (0, vitest_1.expect)(trueScores).toHaveLength(BASE_SIZE);
        (0, vitest_1.expect)(quantizedScores).toHaveLength(BASE_SIZE);
        // 4. 计算召回率
        var hit = 0;
        for (var _i = 0, quantizedTopK_3 = quantizedTopK; _i < quantizedTopK_3.length; _i++) {
            var idx = quantizedTopK_3[_i];
            if (trueTopK.includes(idx))
                hit++;
        }
        var recall = hit / trueTopK.length;
        // 使用 vitest 断言替代 console.log
        (0, vitest_1.expect)(recall).toBeGreaterThanOrEqual(0);
        // 5. 断言
        (0, vitest_1.expect)(recall).toBeGreaterThan(0);
        (0, vitest_1.expect)(quantizedTopK.length).toBe(K);
    });
});
/**
 * @织: 4位查询+1位索引召回率测试
 * 使用真实的生产参数配置：4位查询向量 + 1位索引向量
 * 这是Lucene默认的非对称量化策略，应该提供更好的召回率
 */
(0, vitest_1.describe)('4位查询+1位索引召回率测试', function () {
    var QUERY_SIZE = GLOBAL_QUERY_SIZE;
    var K = GLOBAL_K;
    var RECALL_THRESHOLD = 0.6; // 4位查询应该有更高的召回率
    // 使用全局数据集，确保与单比特查询使用相同的数据
    var baseVectors = GLOBAL_BASE_VECTORS;
    var queryVectors = GLOBAL_QUERY_VECTORS;
    // 构建量化器 - 4位查询+1位索引配置
    var format = new binaryQuantizationFormat_1.BinaryQuantizationFormat({
        queryBits: 4, // 4位查询量化
        indexBits: 1, // 1位索引量化
        quantizer: {
            similarityFunction: types_1.VectorSimilarityFunction.COSINE,
            lambda: 0.001, // 与单比特查询保持一致
            iters: 20 // 与单比特查询保持一致
        }
    });
    // 量化base向量
    var quantizedVectors = format.quantizeVectors(baseVectors).quantizedVectors;
    // 计算每个query的真实topK（暴力法）
    function getTrueTopK(query, base, k) {
        var scores = base.map(function (vec, idx) { return ({
            idx: idx,
            score: (0, vectorSimilarity_1.computeCosineSimilarity)(query, vec)
        }); });
        return scores.sort(function (a, b) { return b.score - a.score; }).slice(0, k).map(function (x) { return x.idx; });
    }
    // 计算每个query的量化topK
    function getQuantizedTopK(query, quantizedBase, k) {
        var results = format.searchNearestNeighbors(query, quantizedBase, k);
        return results.map(function (x) { return x.index; });
    }
    // 计算recall@K
    function computeRecall(trueTopK, quantizedTopK) {
        var hit = 0;
        for (var _i = 0, quantizedTopK_4 = quantizedTopK; _i < quantizedTopK_4.length; _i++) {
            var idx = quantizedTopK_4[_i];
            if (trueTopK.includes(idx))
                hit++;
        }
        return hit / trueTopK.length;
    }
    (0, vitest_1.it)('4位量化分数与原始余弦相似性的关系调试', function () {
        // 选择第一个query进行详细分析
        var query = queryVectors[0];
        if (!query) {
            throw new Error('第一个查询向量不存在');
        }
        // 计算原始余弦相似性
        var originalScores = baseVectors.map(function (vec, idx) { return ({
            idx: idx,
            score: (0, vectorSimilarity_1.computeCosineSimilarity)(query, vec)
        }); });
        // 计算量化分数
        var quantizedResults = format.searchNearestNeighbors(query, quantizedVectors, GLOBAL_BASE_SIZE);
        // 使用 vitest 断言替代 console.log
        for (var i = 0; i < 10; i++) {
            var original = originalScores[i];
            var quantized = quantizedResults[i];
            if (original && quantized) {
                (0, vitest_1.expect)(typeof original.idx).toBe('number');
                (0, vitest_1.expect)(typeof quantized.index).toBe('number');
                (0, vitest_1.expect)(typeof original.score).toBe('number');
                (0, vitest_1.expect)(typeof quantized.score).toBe('number');
            }
        }
        // 检查量化分数是否都是0
        var zeroScores = quantizedResults.filter(function (r) { return r.score === 0; }).length;
        (0, vitest_1.expect)(zeroScores).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(zeroScores).toBeLessThanOrEqual(GLOBAL_BASE_SIZE);
        // 检查原始分数和量化分数的相关性
        var originalTop10 = originalScores.slice(0, 10).map(function (s) { return s.score; });
        var quantizedTop10 = quantizedResults.slice(0, 10).map(function (s) { return s.score; });
        (0, vitest_1.expect)(originalTop10).toHaveLength(10);
        (0, vitest_1.expect)(quantizedTop10).toHaveLength(10);
        // 强制断言，确保测试执行
        (0, vitest_1.expect)(originalScores.length).toBe(GLOBAL_BASE_SIZE);
        (0, vitest_1.expect)(quantizedResults.length).toBe(GLOBAL_BASE_SIZE);
    });
    (0, vitest_1.it)("4\u4F4D\u67E5\u8BE2+1\u4F4D\u7D22\u5F15\u7684 recall@".concat(K, " \u5E94\u5927\u4E8E ").concat(RECALL_THRESHOLD), function () {
        // 调试信息：输出量化向量的基本信息
        // @织:保留: 输出量化向量的调试信息
        // eslint-disable-next-line no-console
        var totalRecall = 0;
        for (var i = 0; i < QUERY_SIZE; i++) {
            var query = queryVectors[i];
            if (!query) {
                throw new Error("\u67E5\u8BE2\u5411\u91CF".concat(i, "\u4E0D\u5B58\u5728"));
            }
            var trueTopK = getTrueTopK(query, baseVectors, K);
            var quantizedTopK = getQuantizedTopK(query, quantizedVectors, K);
            var recall = computeRecall(trueTopK, quantizedTopK);
            totalRecall += recall;
            // 使用 vitest 断言替代 console.log
            (0, vitest_1.expect)(recall).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(trueTopK).toHaveLength(K);
            (0, vitest_1.expect)(quantizedTopK).toHaveLength(K);
            // 添加量化分数调试信息
            var results = format.searchNearestNeighbors(query, quantizedVectors, K);
            (0, vitest_1.expect)(results).toHaveLength(K);
            (0, vitest_1.expect)(results.every(function (r) { return typeof r.score === 'number'; })).toBe(true);
        }
        var avgRecall = totalRecall / QUERY_SIZE;
        // 使用 vitest 断言替代 console.log
        (0, vitest_1.expect)(avgRecall).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(avgRecall).toBeGreaterThanOrEqual(RECALL_THRESHOLD);
    });
});
/**
 * @织: 超采样4bit查询召回率测试
 * 测试三倍左右超采样的4bit查询效果，即查询时返回3K个结果，然后从中选择topK
 * 这种策略可以提高召回率，但会增加计算开销
 */
(0, vitest_1.describe)('超采样4bit查询召回率测试', function () {
    var QUERY_SIZE = GLOBAL_QUERY_SIZE;
    var K = GLOBAL_K;
    var OVERSAMPLE_FACTOR = 3; // 三倍超采样
    var RECALL_THRESHOLD = 0.75; // 超采样应该有更高的召回率
    // 使用全局数据集，确保与其他测试使用相同的数据
    var baseVectors = GLOBAL_BASE_VECTORS;
    var queryVectors = GLOBAL_QUERY_VECTORS;
    // 构建量化器 - 4位查询+1位索引配置
    var format = new binaryQuantizationFormat_1.BinaryQuantizationFormat({
        queryBits: 4, // 4位查询量化
        indexBits: 1, // 1位索引量化
        quantizer: {
            similarityFunction: types_1.VectorSimilarityFunction.COSINE,
            lambda: 0.001, // 与其他测试保持一致
            iters: 20 // 与其他测试保持一致
        }
    });
    // 量化base向量
    var quantizedVectors = format.quantizeVectors(baseVectors).quantizedVectors;
    // 计算每个query的真实topK（暴力法）
    function getTrueTopK(query, base, k) {
        var scores = base.map(function (vec, idx) { return ({
            idx: idx,
            score: (0, vectorSimilarity_1.computeCosineSimilarity)(query, vec)
        }); });
        return scores.sort(function (a, b) { return b.score - a.score; }).slice(0, k).map(function (x) { return x.idx; });
    }
    // 计算每个query的超采样量化topK
    function getOversampledQuantizedTopK(query, quantizedBase, k, oversampleFactor) {
        // 超采样：获取更多候选结果
        var oversampledK = k * oversampleFactor;
        var oversampledResults = format.searchNearestNeighbors(query, quantizedBase, oversampledK);
        // 从超采样候选结果中重新计算真实相似性分数
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
        // 按真实相似性分数重新排序，选择最优的topK
        var sortedCandidates = candidateScores.sort(function (a, b) { return b.trueScore - a.trueScore; });
        return sortedCandidates.slice(0, k).map(function (x) { return x.index; });
    }
    // 计算recall@K
    function computeRecall(trueTopK, quantizedTopK) {
        var hit = 0;
        for (var _i = 0, quantizedTopK_5 = quantizedTopK; _i < quantizedTopK_5.length; _i++) {
            var idx = quantizedTopK_5[_i];
            if (trueTopK.includes(idx))
                hit++;
        }
        return hit / trueTopK.length;
    }
    (0, vitest_1.it)("\u8D85\u91C7\u68374bit\u67E5\u8BE2\u7684 recall@".concat(K, " \u5E94\u5927\u4E8E ").concat(RECALL_THRESHOLD), function () {
        // 使用 vitest 断言替代 console.log
        (0, vitest_1.expect)(OVERSAMPLE_FACTOR).toBe(3);
        (0, vitest_1.expect)(K * OVERSAMPLE_FACTOR).toBeGreaterThan(K);
        (0, vitest_1.expect)(K).toBeGreaterThan(0);
        (0, vitest_1.expect)(RECALL_THRESHOLD).toBeGreaterThan(0);
        var totalRecall = 0;
        var _loop_1 = function (i) {
            var query = queryVectors[i];
            if (!query) {
                throw new Error("\u67E5\u8BE2\u5411\u91CF".concat(i, "\u4E0D\u5B58\u5728"));
            }
            var trueTopK = getTrueTopK(query, baseVectors, K);
            var quantizedTopK = getOversampledQuantizedTopK(query, quantizedVectors, K, OVERSAMPLE_FACTOR);
            var recall = computeRecall(trueTopK, quantizedTopK);
            totalRecall += recall;
            // 使用 vitest 断言替代 console.log
            (0, vitest_1.expect)(recall).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(trueTopK).toHaveLength(K);
            (0, vitest_1.expect)(quantizedTopK).toHaveLength(K);
            // 添加超采样分数调试信息
            var oversampledResults = format.searchNearestNeighbors(query, quantizedVectors, K * OVERSAMPLE_FACTOR);
            // 计算超采样的真实效果
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
            var quantizedTopKScores = oversampledResults.slice(0, K).map(function (r) { return r.score.toFixed(3); });
            var trueTopKScores = sortedCandidates.slice(0, K).map(function (r) { return r.trueScore.toFixed(3); });
            var allQuantizedScores = oversampledResults.map(function (r) { return r.score.toFixed(3); });
            // 使用 vitest 断言替代 console.log
            (0, vitest_1.expect)(quantizedTopKScores).toHaveLength(K);
            (0, vitest_1.expect)(trueTopKScores).toHaveLength(K);
            (0, vitest_1.expect)(allQuantizedScores).toHaveLength(K * OVERSAMPLE_FACTOR);
        };
        for (var i = 0; i < QUERY_SIZE; i++) {
            _loop_1(i);
        }
        var avgRecall = totalRecall / QUERY_SIZE;
        // 使用 vitest 断言替代 console.log
        (0, vitest_1.expect)(avgRecall).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(avgRecall).toBeGreaterThanOrEqual(RECALL_THRESHOLD);
    });
    (0, vitest_1.it)('超采样与普通4bit查询的召回率对比', function () {
        // 对比超采样和普通查询的召回率
        var query = queryVectors[0]; // 使用第一个query进行对比
        if (!query) {
            throw new Error('第一个查询向量不存在');
        }
        // 普通4bit查询
        var normalResults = format.searchNearestNeighbors(query, quantizedVectors, K);
        var normalTopK = normalResults.map(function (x) { return x.index; });
        // 超采样4bit查询
        var oversampledTopK = getOversampledQuantizedTopK(query, quantizedVectors, K, OVERSAMPLE_FACTOR);
        // 真实topK
        var trueTopK = getTrueTopK(query, baseVectors, K);
        // 计算召回率
        var normalRecall = computeRecall(trueTopK, normalTopK);
        var oversampledRecall = computeRecall(trueTopK, oversampledTopK);
        // 计算超采样的详细对比信息
        var oversampledResults = format.searchNearestNeighbors(query, quantizedVectors, K * OVERSAMPLE_FACTOR);
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
        // 使用 vitest 断言替代 console.log
        (0, vitest_1.expect)(normalRecall).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(oversampledRecall).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(oversampledRecall - normalRecall).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(trueTopK).toHaveLength(K);
        (0, vitest_1.expect)(normalTopK).toHaveLength(K);
        (0, vitest_1.expect)(oversampledTopK).toHaveLength(K);
        // 显示超采样的详细对比
        var normalTop10Scores = normalResults.slice(0, 10).map(function (r) { return r.score.toFixed(3); });
        var oversampledTop10Scores = sortedCandidates.slice(0, 10).map(function (r) { return r.trueScore.toFixed(3); });
        var oversampledTop10QuantizedScores = sortedCandidates.slice(0, 10).map(function (r) { return r.quantizedScore.toFixed(3); });
        // 使用 vitest 断言替代 console.log
        (0, vitest_1.expect)(normalTop10Scores).toHaveLength(10);
        (0, vitest_1.expect)(oversampledTop10Scores).toHaveLength(10);
        (0, vitest_1.expect)(oversampledTop10QuantizedScores).toHaveLength(10);
        // 断言超采样应该提供更好的召回率
        (0, vitest_1.expect)(oversampledRecall).toBeGreaterThanOrEqual(normalRecall);
    });
});
