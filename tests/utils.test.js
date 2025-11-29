"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var vectorOperations_1 = require("../src/vectorOperations");
var vectorSimilarity_1 = require("../src/vectorSimilarity");
var vectorUtils_1 = require("../src/vectorUtils");
(0, vitest_1.describe)('VectorUtil', function () {
    (0, vitest_1.describe)('computeDotProduct', function () {
        (0, vitest_1.it)('应该计算两个向量的点积', function () {
            var a = new Float32Array([1, 2, 3, 4]);
            var b = new Float32Array([5, 6, 7, 8]);
            var result = (0, vectorOperations_1.computeDotProduct)(a, b);
            var expected = 1 * 5 + 2 * 6 + 3 * 7 + 4 * 8;
            (0, vitest_1.expect)(result).toBe(expected);
        });
        (0, vitest_1.it)('应该处理零向量', function () {
            var a = new Float32Array([0, 0, 0, 0]);
            var b = new Float32Array([1, 2, 3, 4]);
            var result = (0, vectorOperations_1.computeDotProduct)(a, b);
            (0, vitest_1.expect)(result).toBe(0);
        });
        (0, vitest_1.it)('应该处理单位向量', function () {
            var a = new Float32Array([1, 0, 0, 0]);
            var b = new Float32Array([0, 1, 0, 0]);
            var result = (0, vectorOperations_1.computeDotProduct)(a, b);
            (0, vitest_1.expect)(result).toBe(0);
        });
        (0, vitest_1.it)('应该处理相同向量', function () {
            var a = new Float32Array([1, 2, 3, 4]);
            var result = (0, vectorOperations_1.computeDotProduct)(a, a);
            var expected = 1 * 1 + 2 * 2 + 3 * 3 + 4 * 4;
            (0, vitest_1.expect)(result).toBe(expected);
        });
    });
    (0, vitest_1.describe)('computeEuclideanDistance', function () {
        (0, vitest_1.it)('应该计算两个向量的欧几里得距离', function () {
            var a = new Float32Array([1, 2, 3, 4]);
            var b = new Float32Array([5, 6, 7, 8]);
            var result = (0, vectorSimilarity_1.computeEuclideanDistance)(a, b);
            var expected = Math.sqrt(Math.pow((1 - 5), 2) + Math.pow((2 - 6), 2) + Math.pow((3 - 7), 2) + Math.pow((4 - 8), 2));
            (0, vitest_1.expect)(result).toBeCloseTo(expected, 6);
        });
        (0, vitest_1.it)('应该处理相同向量', function () {
            var a = new Float32Array([1, 2, 3, 4]);
            var result = (0, vectorSimilarity_1.computeEuclideanDistance)(a, a);
            (0, vitest_1.expect)(result).toBe(0);
        });
        (0, vitest_1.it)('应该处理零向量', function () {
            var a = new Float32Array([0, 0, 0, 0]);
            var b = new Float32Array([1, 2, 3, 4]);
            var result = (0, vectorSimilarity_1.computeEuclideanDistance)(a, b);
            var expected = Math.sqrt(Math.pow(1, 2) + Math.pow(2, 2) + Math.pow(3, 2) + Math.pow(4, 2));
            (0, vitest_1.expect)(result).toBeCloseTo(expected, 6);
        });
    });
    (0, vitest_1.describe)('computeCosineSimilarity', function () {
        (0, vitest_1.it)('应该计算两个向量的余弦相似度', function () {
            var a = new Float32Array([1, 2, 3, 4]);
            var b = new Float32Array([5, 6, 7, 8]);
            var result = (0, vectorSimilarity_1.computeCosineSimilarity)(a, b);
            var dotProduct = 1 * 5 + 2 * 6 + 3 * 7 + 4 * 8;
            var normA = Math.sqrt(Math.pow(1, 2) + Math.pow(2, 2) + Math.pow(3, 2) + Math.pow(4, 2));
            var normB = Math.sqrt(Math.pow(5, 2) + Math.pow(6, 2) + Math.pow(7, 2) + Math.pow(8, 2));
            var expected = dotProduct / (normA * normB);
            (0, vitest_1.expect)(result).toBeCloseTo(expected, 6);
        });
        (0, vitest_1.it)('应该处理相同向量', function () {
            var a = new Float32Array([1, 2, 3, 4]);
            var result = (0, vectorSimilarity_1.computeCosineSimilarity)(a, a);
            (0, vitest_1.expect)(result).toBeCloseTo(1, 6);
        });
        (0, vitest_1.it)('应该处理正交向量', function () {
            var a = new Float32Array([1, 0, 0, 0]);
            var b = new Float32Array([0, 1, 0, 0]);
            var result = (0, vectorSimilarity_1.computeCosineSimilarity)(a, b);
            (0, vitest_1.expect)(result).toBeCloseTo(0, 6);
        });
        (0, vitest_1.it)('应该处理零向量', function () {
            var a = new Float32Array([0, 0, 0, 0]);
            var b = new Float32Array([1, 2, 3, 4]);
            // 零向量的余弦相似度应该是 NaN 或 0
            var result = (0, vectorSimilarity_1.computeCosineSimilarity)(a, b);
            (0, vitest_1.expect)(isNaN(result) || result === 0).toBe(true);
        });
    });
    (0, vitest_1.describe)('computeMaximumInnerProduct', function () {
        (0, vitest_1.it)('应该计算两个向量的最大内积', function () {
            var a = new Float32Array([1, 2, 3, 4]);
            var b = new Float32Array([5, 6, 7, 8]);
            var result = (0, vectorSimilarity_1.computeMaximumInnerProduct)(a, b);
            var expected = 1 * 5 + 2 * 6 + 3 * 7 + 4 * 8;
            (0, vitest_1.expect)(result).toBe(expected);
        });
        (0, vitest_1.it)('应该处理负值', function () {
            var a = new Float32Array([-1, -2, -3, -4]);
            var b = new Float32Array([5, 6, 7, 8]);
            var result = (0, vectorSimilarity_1.computeMaximumInnerProduct)(a, b);
            var expected = (-1) * 5 + (-2) * 6 + (-3) * 7 + (-4) * 8;
            (0, vitest_1.expect)(result).toBe(expected);
        });
        (0, vitest_1.it)('应该处理零向量', function () {
            var a = new Float32Array([0, 0, 0, 0]);
            var b = new Float32Array([1, 2, 3, 4]);
            var result = (0, vectorSimilarity_1.computeMaximumInnerProduct)(a, b);
            (0, vitest_1.expect)(result).toBe(0);
        });
    });
    (0, vitest_1.describe)('normalizeVector', function () {
        (0, vitest_1.it)('应该归一化向量', function () {
            var vector = new Float32Array([3, 4, 0, 0]);
            var result = (0, vectorOperations_1.normalizeVector)(vector);
            var norm = Math.sqrt(Math.pow(3, 2) + Math.pow(4, 2));
            var expected = new Float32Array([3 / norm, 4 / norm, 0, 0]);
            for (var i = 0; i < result.length; i++) {
                var expectedValue = expected[i];
                if (expectedValue === undefined) {
                    throw new Error("\u671F\u671B\u503C\u7D22\u5F15".concat(i, "\u4E0D\u5B58\u5728"));
                }
                (0, vitest_1.expect)(result[i]).toBeCloseTo(expectedValue, 6);
            }
        });
        (0, vitest_1.it)('应该处理零向量', function () {
            var vector = new Float32Array([0, 0, 0, 0]);
            var result = (0, vectorOperations_1.normalizeVector)(vector);
            // 零向量归一化后应该保持为零向量
            for (var i = 0; i < result.length; i++) {
                (0, vitest_1.expect)(result[i]).toBe(0);
            }
        });
        (0, vitest_1.it)('应该处理单位向量', function () {
            var vector = new Float32Array([1, 0, 0, 0]);
            var result = (0, vectorOperations_1.normalizeVector)(vector);
            (0, vitest_1.expect)(result[0]).toBeCloseTo(1, 6);
            (0, vitest_1.expect)(result[1]).toBeCloseTo(0, 6);
            (0, vitest_1.expect)(result[2]).toBeCloseTo(0, 6);
            (0, vitest_1.expect)(result[3]).toBeCloseTo(0, 6);
        });
    });
    (0, vitest_1.describe)('computeVectorMagnitude', function () {
        (0, vitest_1.it)('应该计算向量幅度', function () {
            var vector = new Float32Array([3, 4, 0, 0]);
            var result = (0, vectorUtils_1.computeVectorMagnitude)(vector);
            var expected = Math.sqrt(Math.pow(3, 2) + Math.pow(4, 2));
            (0, vitest_1.expect)(result).toBeCloseTo(expected, 6);
        });
        (0, vitest_1.it)('应该处理零向量', function () {
            var vector = new Float32Array([0, 0, 0, 0]);
            var result = (0, vectorUtils_1.computeVectorMagnitude)(vector);
            (0, vitest_1.expect)(result).toBe(0);
        });
        (0, vitest_1.it)('应该处理单位向量', function () {
            var vector = new Float32Array([1, 0, 0, 0]);
            var result = (0, vectorUtils_1.computeVectorMagnitude)(vector);
            (0, vitest_1.expect)(result).toBe(1);
        });
    });
    (0, vitest_1.describe)('addVectors', function () {
        (0, vitest_1.it)('应该添加两个向量', function () {
            var a = new Float32Array([1, 2, 3, 4]);
            var b = new Float32Array([5, 6, 7, 8]);
            var result = (0, vectorOperations_1.addVectors)(a, b);
            var expected = new Float32Array([6, 8, 10, 12]);
            for (var i = 0; i < result.length; i++) {
                (0, vitest_1.expect)(result[i]).toBe(expected[i]);
            }
        });
        (0, vitest_1.it)('应该处理零向量', function () {
            var a = new Float32Array([1, 2, 3, 4]);
            var b = new Float32Array([0, 0, 0, 0]);
            var result = (0, vectorOperations_1.addVectors)(a, b);
            for (var i = 0; i < result.length; i++) {
                (0, vitest_1.expect)(result[i]).toBe(a[i]);
            }
        });
    });
    (0, vitest_1.describe)('subtractVectors', function () {
        (0, vitest_1.it)('应该减去两个向量', function () {
            var a = new Float32Array([5, 6, 7, 8]);
            var b = new Float32Array([1, 2, 3, 4]);
            var result = (0, vectorOperations_1.subtractVectors)(a, b);
            var expected = new Float32Array([4, 4, 4, 4]);
            for (var i = 0; i < result.length; i++) {
                (0, vitest_1.expect)(result[i]).toBe(expected[i]);
            }
        });
        (0, vitest_1.it)('应该处理零向量', function () {
            var a = new Float32Array([1, 2, 3, 4]);
            var b = new Float32Array([0, 0, 0, 0]);
            var result = (0, vectorOperations_1.subtractVectors)(a, b);
            for (var i = 0; i < result.length; i++) {
                (0, vitest_1.expect)(result[i]).toBe(a[i]);
            }
        });
    });
    (0, vitest_1.describe)('scaleVector', function () {
        (0, vitest_1.it)('应该缩放向量', function () {
            var vector = new Float32Array([1, 2, 3, 4]);
            var scale = 2.5;
            var result = (0, vectorOperations_1.scaleVector)(vector, scale);
            var expected = new Float32Array([2.5, 5, 7.5, 10]);
            for (var i = 0; i < result.length; i++) {
                (0, vitest_1.expect)(result[i]).toBe(expected[i]);
            }
        });
        (0, vitest_1.it)('应该处理零缩放', function () {
            var vector = new Float32Array([1, 2, 3, 4]);
            var scale = 0;
            var result = (0, vectorOperations_1.scaleVector)(vector, scale);
            for (var i = 0; i < result.length; i++) {
                (0, vitest_1.expect)(result[i]).toBe(0);
            }
        });
        (0, vitest_1.it)('应该处理负缩放', function () {
            var vector = new Float32Array([1, 2, 3, 4]);
            var scale = -1;
            var result = (0, vectorOperations_1.scaleVector)(vector, scale);
            var expected = new Float32Array([-1, -2, -3, -4]);
            for (var i = 0; i < result.length; i++) {
                (0, vitest_1.expect)(result[i]).toBe(expected[i]);
            }
        });
    });
});
