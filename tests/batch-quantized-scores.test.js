"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var binaryQuantizationFormat_1 = require("../src/binaryQuantizationFormat");
var types_1 = require("../src/types");
var vectorUtils_1 = require("../src/vectorUtils");
var batchDotProduct_1 = require("../src/batchDotProduct");
(0, vitest_1.describe)('Batch Quantized Scores Test', function () {
    var DIMENSION = 1024;
    var NUM_VECTORS = 5000; // 增加数据规模
    var format;
    var scorer;
    var queryVector;
    var targetVectors;
    (0, vitest_1.beforeAll)(function () {
        // 创建1位量化的格式
        format = new binaryQuantizationFormat_1.BinaryQuantizationFormat({
            queryBits: 1,
            indexBits: 1,
            quantizer: {
                similarityFunction: types_1.VectorSimilarityFunction.COSINE
            }
        });
        // 创建评分器
        scorer = format.getScorer();
        // 生成查询向量
        queryVector = (0, vectorUtils_1.createRandomVector)(DIMENSION);
        // 生成目标向量
        targetVectors = [];
        for (var i = 0; i < NUM_VECTORS; i++) {
            targetVectors.push((0, vectorUtils_1.createRandomVector)(DIMENSION));
        }
    });
    (0, vitest_1.it)('should compute batch quantized scores correctly', function () {
        // 构建量化索引
        var quantizedVectors = format.quantizeVectors(targetVectors).quantizedVectors;
        // 量化查询向量
        var centroid = quantizedVectors.getCentroid();
        var _a = format.quantizeQueryVector(queryVector, centroid), quantizedQuery = _a.quantizedQuery, queryCorrections = _a.queryCorrections;
        // 生成目标向量序号数组
        var targetOrds = Array.from({ length: NUM_VECTORS }, function (_, i) { return i; });
        // 预创建连接缓冲区（一次性操作，不计入算法时间）
        var concatenatedBuffer = (0, batchDotProduct_1.createConcatenatedBuffer)(quantizedVectors, targetOrds);
        // 测试批量计算（只计算核心算法时间）
        var startTime = performance.now();
        var qcDists = (0, batchDotProduct_1.computeBatchDotProductOptimized)(quantizedQuery, concatenatedBuffer, targetOrds.length);
        // 批量计算相似性分数
        var scores = (0, batchDotProduct_1.computeBatchOneBitSimilarityScores)(qcDists, queryCorrections, quantizedVectors, targetOrds, quantizedVectors.dimension(), quantizedVectors.getCentroidDP(), // 1位量化不需要传递原始查询向量
        scorer.getSimilarityFunction());
        // 构建结果数组
        var batchResults = [];
        for (var i = 0; i < targetOrds.length; i++) {
            var indexCorrections = quantizedVectors.getCorrectiveTerms(targetOrds[i]);
            batchResults.push({
                score: scores[i],
                bitDotProduct: qcDists[i],
                corrections: {
                    query: queryCorrections,
                    index: indexCorrections
                }
            });
        }
        var endTime = performance.now();
        var batchTime = endTime - startTime;
        // 测试真正的原始算法（逐个调用computeInt1BitDotProduct）
        var startTimeTrueOriginal = performance.now();
        var trueOriginalDotProducts = (0, batchDotProduct_1.computeBatchDotProductTrueOriginal)(quantizedQuery, quantizedVectors, targetOrds);
        var endTimeTrueOriginal = performance.now();
        var trueOriginalTime = endTimeTrueOriginal - startTimeTrueOriginal;
        // 测试单个计算（用于对比）
        var startTimeSingle = performance.now();
        var singleResults = [];
        for (var _i = 0, targetOrds_1 = targetOrds; _i < targetOrds_1.length; _i++) {
            var targetOrd = targetOrds_1[_i];
            var result = scorer.computeQuantizedScore(quantizedQuery, queryCorrections, quantizedVectors, targetOrd, 1);
            singleResults.push(result);
        }
        var endTimeSingle = performance.now();
        var singleTime = endTimeSingle - startTimeSingle;
        console.log("\n=== \u6279\u91CF\u91CF\u5316\u8BC4\u5206\u6027\u80FD\u6D4B\u8BD5 ===");
        console.log("\u516B\u8DEF\u5FAA\u73AF\u5C55\u5F00\u6279\u91CF\u8BA1\u7B97\u65F6\u95F4: ".concat(batchTime.toFixed(3), "ms"));
        console.log("\u771F\u6B63\u539F\u59CB\u7B97\u6CD5\u65F6\u95F4: ".concat(trueOriginalTime.toFixed(3), "ms"));
        console.log("\u5355\u4E2A\u8BA1\u7B97\u65F6\u95F4: ".concat(singleTime.toFixed(3), "ms"));
        console.log("\u516B\u8DEF\u5FAA\u73AF\u5C55\u5F00 vs \u771F\u6B63\u539F\u59CB\u7B97\u6CD5: ".concat(((trueOriginalTime / batchTime)).toFixed(2), "x"));
        console.log("\u516B\u8DEF\u5FAA\u73AF\u5C55\u5F00 vs \u5355\u4E2A\u8BA1\u7B97: ".concat(((singleTime / batchTime)).toFixed(2), "x"));
        // 验证结果一致性
        var consistencyCount = 0;
        var checkCount = Math.min(100, NUM_VECTORS);
        for (var i = 0; i < checkCount; i++) {
            if (Math.abs(batchResults[i].score - singleResults[i].score) < 1e-10) {
                consistencyCount++;
            }
        }
        console.log("\u7ED3\u679C\u4E00\u81F4\u6027\u68C0\u67E5: ".concat(consistencyCount, "/").concat(checkCount, " \u4E2A\u7ED3\u679C\u5B8C\u5168\u4E00\u81F4"));
        // 验证结果数量
        (0, vitest_1.expect)(batchResults.length).toBe(NUM_VECTORS);
        (0, vitest_1.expect)(singleResults.length).toBe(NUM_VECTORS);
        // 验证结果一致性
        (0, vitest_1.expect)(consistencyCount).toBe(checkCount);
        // 验证点积计算的一致性
        var dotProductConsistencyCount = 0;
        for (var i = 0; i < checkCount; i++) {
            if (qcDists[i] === trueOriginalDotProducts[i]) {
                dotProductConsistencyCount++;
            }
        }
        console.log("\u70B9\u79EF\u8BA1\u7B97\u4E00\u81F4\u6027\u68C0\u67E5: ".concat(dotProductConsistencyCount, "/").concat(checkCount, " \u4E2A\u7ED3\u679C\u5B8C\u5168\u4E00\u81F4"));
        // 对于小规模数据，批量计算可能因为开销而不如单个计算
        // 但在大规模数据中，批量计算应该更有优势
        console.log("\n\uD83D\uDCCA \u6027\u80FD\u5206\u6790:");
        console.log("  \u6570\u636E\u89C4\u6A21: ".concat(NUM_VECTORS, " \u4E2A\u5411\u91CF"));
        console.log("  \u516B\u8DEF\u5FAA\u73AF\u5C55\u5F00\u5F00\u9500: ".concat((batchTime / NUM_VECTORS).toFixed(6), "ms/\u5411\u91CF"));
        console.log("  \u771F\u6B63\u539F\u59CB\u7B97\u6CD5\u5F00\u9500: ".concat((trueOriginalTime / NUM_VECTORS).toFixed(6), "ms/\u5411\u91CF"));
        console.log("  \u5355\u4E2A\u8BA1\u7B97\u5F00\u9500: ".concat((singleTime / NUM_VECTORS).toFixed(6), "ms/\u5411\u91CF"));
        // 验证结果结构
        // 验证结果结构
        for (var _b = 0, batchResults_1 = batchResults; _b < batchResults_1.length; _b++) {
            var result = batchResults_1[_b];
            (0, vitest_1.expect)(result).toHaveProperty('score');
            (0, vitest_1.expect)(result).toHaveProperty('bitDotProduct');
            (0, vitest_1.expect)(result).toHaveProperty('corrections');
            (0, vitest_1.expect)(result.corrections).toHaveProperty('query');
            (0, vitest_1.expect)(result.corrections).toHaveProperty('index');
            (0, vitest_1.expect)(typeof result.score).toBe('number');
            (0, vitest_1.expect)(typeof result.bitDotProduct).toBe('number');
        }
    });
    (0, vitest_1.it)('should handle empty target ords array', function () {
        // 量化查询向量
        var quantizedVectors = format.quantizeVectors(targetVectors).quantizedVectors;
        var centroid = quantizedVectors.getCentroid();
        var _a = format.quantizeQueryVector(queryVector, centroid), quantizedQuery = _a.quantizedQuery, queryCorrections = _a.queryCorrections;
        // 测试空数组
        var emptyResults = scorer.computeBatchQuantizedScores(quantizedQuery, queryCorrections, quantizedVectors, [], 1);
        (0, vitest_1.expect)(emptyResults).toEqual([]);
    });
    (0, vitest_1.it)('should compute batch quantized scores for 4-bit quantization', function () {
        // 创建4位量化的格式
        var format4bit = new binaryQuantizationFormat_1.BinaryQuantizationFormat({
            queryBits: 4,
            indexBits: 1,
            quantizer: {
                similarityFunction: types_1.VectorSimilarityFunction.COSINE
            }
        });
        var scorer4bit = format4bit.getScorer();
        // 构建量化索引
        var quantizedVectors4bit = format4bit.quantizeVectors(targetVectors).quantizedVectors;
        // 量化查询向量
        var centroid = quantizedVectors4bit.getCentroid();
        var _a = format4bit.quantizeQueryVector(queryVector, centroid), quantizedQuery = _a.quantizedQuery, queryCorrections = _a.queryCorrections;
        // 生成目标向量序号数组
        var targetOrds = Array.from({ length: 100 }, function (_, i) { return i; });
        // 预创建连接缓冲区（一次性操作，不计入算法时间）
        // 注意：1bit索引向量是打包格式，每8个bit打包成1个byte
        var packedVectorSize = Math.ceil(DIMENSION / 8);
        var concatenatedBuffer = (0, batchDotProduct_1.createDirectPackedBuffer)(quantizedVectors4bit, targetOrds, packedVectorSize);
        // 测试4位量化的批量计算
        var startTime = performance.now();
        var qcDists = (0, batchDotProduct_1.computeBatchFourBitDotProductDirectPacked)(quantizedQuery, concatenatedBuffer, targetOrds.length, quantizedVectors4bit.dimension());
        // 批量计算相似性分数
        var scores = (0, batchDotProduct_1.computeBatchFourBitSimilarityScores)(qcDists, queryCorrections, quantizedVectors4bit, targetOrds, quantizedVectors4bit.dimension(), quantizedVectors4bit.getCentroidDP(queryVector), // 传递原始查询向量
        scorer4bit.getSimilarityFunction());
        // 构建结果数组
        var batchResults = [];
        for (var i = 0; i < targetOrds.length; i++) {
            var indexCorrections = quantizedVectors4bit.getCorrectiveTerms(targetOrds[i]);
            batchResults.push({
                score: scores[i],
                bitDotProduct: qcDists[i],
                corrections: {
                    query: queryCorrections,
                    index: indexCorrections
                }
            });
        }
        var endTime = performance.now();
        var batchTime = endTime - startTime;
        // 测试单个计算（用于对比）
        var startTimeSingle = performance.now();
        var singleResults = [];
        for (var _i = 0, targetOrds_2 = targetOrds; _i < targetOrds_2.length; _i++) {
            var targetOrd = targetOrds_2[_i];
            var result = scorer4bit.computeQuantizedScore(quantizedQuery, queryCorrections, quantizedVectors4bit, targetOrd, 4, queryVector // 传递原始查询向量
            );
            singleResults.push(result);
        }
        var endTimeSingle = performance.now();
        var singleTime = endTimeSingle - startTimeSingle;
        console.log("\n=== 4\u4F4D\u91CF\u5316\u6279\u91CF\u8BC4\u5206\u6027\u80FD\u6D4B\u8BD5 ===");
        console.log("\u6279\u91CF\u8BA1\u7B97\u65F6\u95F4: ".concat(batchTime.toFixed(3), "ms"));
        console.log("\u5355\u4E2A\u8BA1\u7B97\u65F6\u95F4: ".concat(singleTime.toFixed(3), "ms"));
        console.log("\u6027\u80FD\u63D0\u5347: ".concat(((singleTime / batchTime)).toFixed(2), "x"));
        // 验证结果一致性
        var consistencyCount = 0;
        var checkCount = Math.min(50, targetOrds.length);
        for (var i = 0; i < checkCount; i++) {
            if (Math.abs(batchResults[i].score - singleResults[i].score) < 1e-10) {
                consistencyCount++;
            }
        }
        console.log("\u7ED3\u679C\u4E00\u81F4\u6027\u68C0\u67E5: ".concat(consistencyCount, "/").concat(checkCount, " \u4E2A\u7ED3\u679C\u5B8C\u5168\u4E00\u81F4"));
        // 验证结果
        (0, vitest_1.expect)(batchResults.length).toBe(100);
        (0, vitest_1.expect)(singleResults.length).toBe(100);
        (0, vitest_1.expect)(consistencyCount).toBe(checkCount);
        for (var _b = 0, batchResults_2 = batchResults; _b < batchResults_2.length; _b++) {
            var result = batchResults_2[_b];
            (0, vitest_1.expect)(result).toHaveProperty('score');
            (0, vitest_1.expect)(result).toHaveProperty('bitDotProduct');
            (0, vitest_1.expect)(result).toHaveProperty('corrections');
            (0, vitest_1.expect)(result.corrections).toHaveProperty('query');
            (0, vitest_1.expect)(result.corrections).toHaveProperty('index');
            (0, vitest_1.expect)(typeof result.score).toBe('number');
            (0, vitest_1.expect)(typeof result.bitDotProduct).toBe('number');
        }
    });
});
