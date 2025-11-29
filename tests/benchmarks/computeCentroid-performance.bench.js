"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var vectorOperations_1 = require("../../src/vectorOperations");
/**
 * computeCentroid性能回归测试
 * 测试不同实现方案的性能差异
 */
(0, vitest_1.describe)('computeCentroid性能回归测试', function () {
    // 测试数据准备
    var dimension = 128;
    var numVectors = 1000;
    var vectors = new Array(numVectors).fill(0).map(function () {
        return new Float32Array(dimension).map(function () { return Math.random() * 2 - 1; });
    });
    (0, vitest_1.describe)('当前实现性能', function () {
        (0, vitest_1.bench)('当前实现 - 1000个128维向量', function () {
            (0, vectorOperations_1.computeCentroid)(vectors);
        });
    });
    (0, vitest_1.describe)('优化实现性能', function () {
        (0, vitest_1.bench)('交换循环顺序优化 - 1000个128维向量', function () {
            computeCentroidOptimized(vectors);
        });
    });
    (0, vitest_1.describe)('不同规模数据性能', function () {
        var smallVectors = new Array(100).fill(0).map(function () {
            return new Float32Array(64).map(function () { return Math.random() * 2 - 1; });
        });
        var largeVectors = new Array(5000).fill(0).map(function () {
            return new Float32Array(256).map(function () { return Math.random() * 2 - 1; });
        });
        (0, vitest_1.bench)('当前实现 - 100个64维向量', function () {
            (0, vectorOperations_1.computeCentroid)(smallVectors);
        });
        (0, vitest_1.bench)('优化实现 - 100个64维向量', function () {
            computeCentroidOptimized(smallVectors);
        });
        (0, vitest_1.bench)('当前实现 - 5000个256维向量', function () {
            (0, vectorOperations_1.computeCentroid)(largeVectors);
        });
        (0, vitest_1.bench)('优化实现 - 5000个256维向量', function () {
            computeCentroidOptimized(largeVectors);
        });
    });
    (0, vitest_1.describe)('正确性验证', function () {
        (0, vitest_1.it)('优化实现应该产生相同结果', function () {
            var result1 = (0, vectorOperations_1.computeCentroid)(vectors);
            var result2 = computeCentroidOptimized(vectors);
            for (var i = 0; i < result1.length; i++) {
                (0, vitest_1.expect)(Math.abs(result1[i] - result2[i])).toBeLessThan(1e-10);
            }
        });
    });
});
// 优化实现：交换循环顺序
function computeCentroidOptimized(vectors) {
    if (vectors.length === 0) {
        throw new Error('向量集合不能为空');
    }
    var firstVector = vectors[0];
    if (!firstVector) {
        throw new Error('第一个向量不能为空');
    }
    var dimension = firstVector.length;
    var centroid = new Float32Array(dimension);
    // 初始化质心为第一个向量
    for (var i = 0; i < dimension; i++) {
        centroid[i] = vectors[0][i] || 0;
    }
    // 从第二个向量开始累加
    for (var j = 1; j < vectors.length; j++) {
        var vector = vectors[j];
        if (vector) {
            for (var i = 0; i < dimension; i++) {
                var val = vector[i];
                centroid[i] += val;
            }
        }
    }
    // 除以向量数量
    var numVectors = vectors.length;
    for (var i = 0; i < dimension; i++) {
        centroid[i] /= numVectors;
    }
    return centroid;
}
