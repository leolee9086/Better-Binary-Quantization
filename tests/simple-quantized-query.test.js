"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var binaryQuantizationFormat_1 = require("../src/binaryQuantizationFormat");
var types_1 = require("../src/types");
var vectorOperations_1 = require("../src/vectorOperations");
/**
 * 最简单的量化查询性能测试
 * 测量等规模数据下一次量化查询的时间
 */
/**
 * 生成测试向量
 */
function generateVectors(count, dimension) {
    var vectors = [];
    for (var i = 0; i < count; i++) {
        var vector = new Float32Array(dimension);
        for (var j = 0; j < dimension; j++) {
            vector[j] = Math.random() * 2 - 1; // [-1, 1]
        }
        vectors.push((0, vectorOperations_1.normalizeVector)(vector));
    }
    return vectors;
}
/**
 * 性能测量工具
 */
function measurePerformance(name, fn, iterations) {
    if (iterations === void 0) { iterations = 1; }
    var start = performance.now();
    var result;
    for (var i = 0; i < iterations; i++) {
        result = fn();
    }
    var end = performance.now();
    var totalTime = end - start;
    var avgTime = totalTime / iterations;
    console.log("\uD83D\uDCCA ".concat(name, ": ").concat(avgTime.toFixed(2), "ms (").concat(iterations, "\u6B21\u8FED\u4EE3, \u603B\u8BA1").concat(totalTime.toFixed(2), "ms)"));
    return { result: result, avgTime: avgTime, totalTime: totalTime };
}
(0, vitest_1.describe)('简单量化查询性能测试', function () {
    (0, vitest_1.it)('使用相同测量方式测试量化查询', function () {
        var dim = 1024;
        var baseSize = 5000;
        var k = 10;
        var queryCount = 10;
        console.log("\n\uD83D\uDD0D \u6D4B\u8BD5\u914D\u7F6E:");
        console.log("  \u5411\u91CF\u7EF4\u5EA6: ".concat(dim));
        console.log("  \u5411\u91CF\u6570\u91CF: ".concat(baseSize));
        console.log("  \u67E5\u8BE2\u6B21\u6570: ".concat(queryCount));
        console.log("  \u8FD4\u56DE\u6570\u91CF: ".concat(k));
        // 生成测试数据
        console.log("\n\uD83D\uDCCA \u751F\u6210\u6D4B\u8BD5\u6570\u636E...");
        var vectors = generateVectors(baseSize, dim);
        var queryVectors = generateVectors(queryCount, dim);
        // 构建量化索引
        console.log("\n\uD83D\uDD27 \u6784\u5EFA\u91CF\u5316\u7D22\u5F15...");
        var format = new binaryQuantizationFormat_1.BinaryQuantizationFormat({
            queryBits: 4,
            indexBits: 1,
            quantizer: {
                similarityFunction: types_1.VectorSimilarityFunction.COSINE,
                lambda: 0.01,
                iters: 20
            }
        });
        var buildStart = performance.now();
        var quantizedVectors = format.quantizeVectors(vectors).quantizedVectors;
        var buildEnd = performance.now();
        var buildTime = buildEnd - buildStart;
        console.log("\u6784\u5EFA\u65F6\u95F4: ".concat(buildTime.toFixed(2), "ms"));
        // 测试量化查询 - 使用相同的测量方式
        var quantizedMethod = function () {
            var results = [];
            for (var i = 0; i < queryCount; i++) {
                var query = queryVectors[i];
                results.push(format.searchNearestNeighbors(query, quantizedVectors, k));
            }
            return results;
        };
        console.log("\n\uD83D\uDD0D \u6267\u884C\u91CF\u5316\u67E5\u8BE2\u6027\u80FD\u6D4B\u8BD5...");
        var quantizedTime = measurePerformance('量化查询（批量）', quantizedMethod, 3);
        // 计算每次查询的平均时间
        var avgQueryTime = quantizedTime.avgTime / queryCount;
        console.log("\n\uD83D\uDCC8 \u6027\u80FD\u7EDF\u8BA1:");
        console.log("\u603B\u6279\u6B21\u65F6\u95F4: ".concat(quantizedTime.avgTime.toFixed(2), "ms"));
        console.log("\u6BCF\u6B21\u67E5\u8BE2\u5E73\u5747\u65F6\u95F4: ".concat(avgQueryTime.toFixed(2), "ms"));
        console.log("\u67E5\u8BE2\u541E\u5410\u91CF: ".concat(Math.round(1000 / avgQueryTime), " \u67E5\u8BE2/\u79D2"));
        // 验证结果
        var results = quantizedTime.result;
        (0, vitest_1.expect)(results.length).toBe(queryCount);
        (0, vitest_1.expect)(results[0].length).toBe(k);
        console.log("\n\u2705 \u6D4B\u8BD5\u5B8C\u6210");
    });
});
