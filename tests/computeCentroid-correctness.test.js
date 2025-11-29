"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var vectorOperations_1 = require("../src/vectorOperations");
/**
 * computeCentroid正确性验证测试
 */
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
(0, vitest_1.describe)('computeCentroid正确性验证', function () {
    (0, vitest_1.it)('优化实现应该产生相同结果', function () {
        // 创建测试数据
        var dimension = 128;
        var numVectors = 1000;
        var vectors = new Array(numVectors).fill(0).map(function () {
            return new Float32Array(dimension).map(function () { return Math.random() * 2 - 1; });
        });
        var result1 = (0, vectorOperations_1.computeCentroid)(vectors);
        var result2 = computeCentroidOptimized(vectors);
        // 验证结果相同
        for (var i = 0; i < result1.length; i++) {
            (0, vitest_1.expect)(Math.abs(result1[i] - result2[i])).toBeLessThan(1e-7);
        }
    });
    (0, vitest_1.it)('小规模数据测试', function () {
        var vectors = [
            new Float32Array([1, 2, 3]),
            new Float32Array([4, 5, 6]),
            new Float32Array([7, 8, 9])
        ];
        var result1 = (0, vectorOperations_1.computeCentroid)(vectors);
        var result2 = computeCentroidOptimized(vectors);
        // 期望结果：[4, 5, 6]
        (0, vitest_1.expect)(result1[0]).toBeCloseTo(4, 10);
        (0, vitest_1.expect)(result1[1]).toBeCloseTo(5, 10);
        (0, vitest_1.expect)(result1[2]).toBeCloseTo(6, 10);
        // 验证两个实现结果相同
        for (var i = 0; i < result1.length; i++) {
            (0, vitest_1.expect)(result1[i]).toBeCloseTo(result2[i], 10);
        }
    });
});
