"use strict";
/**
 * 向量相似性计算函数
 * 实现各种向量相似性度量方法
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeSimilarity = computeSimilarity;
exports.computeEuclideanDistance = computeEuclideanDistance;
exports.computeEuclideanSimilarity = computeEuclideanSimilarity;
exports.computeCosineSimilarity = computeCosineSimilarity;
exports.computeMaximumInnerProduct = computeMaximumInnerProduct;
/**
 * 向量相似性计算
 * @param a 向量a
 * @param b 向量b
 * @param similarityFunction 相似性函数类型
 * @returns 相似性分数
 */
function computeSimilarity(a, b, similarityFunction) {
    switch (similarityFunction) {
        case 'EUCLIDEAN':
            return computeEuclideanSimilarity(a, b);
        case 'COSINE':
            return computeCosineSimilarity(a, b);
        case 'MAXIMUM_INNER_PRODUCT':
            return computeMaximumInnerProduct(a, b);
        default:
            throw new Error("\u4E0D\u652F\u6301\u7684\u76F8\u4F3C\u6027\u51FD\u6570: ".concat(similarityFunction));
    }
}
/**
 * 计算欧几里得距离
 * @param a 向量a
 * @param b 向量b
 * @returns 欧几里得距离
 */
function computeEuclideanDistance(a, b) {
    if (!a || !b) {
        throw new Error('向量不能为空');
    }
    if (a.length !== b.length) {
        throw new Error('向量维度不匹配');
    }
    var sum = 0;
    for (var i = 0; i < a.length; i++) {
        var av = a[i];
        var bv = b[i];
        if (av !== undefined && bv !== undefined) {
            var diff = av - bv;
            sum += diff * diff;
        }
    }
    return Math.sqrt(sum);
}
/**
 * 计算欧几里得相似性
 * @param a 向量a
 * @param b 向量b
 * @returns 欧几里得相似性分数
 */
function computeEuclideanSimilarity(a, b) {
    var distance = computeEuclideanDistance(a, b);
    return 1.0 / (1.0 + distance);
}
/**
 * 计算余弦相似性
 * @param a 向量a
 * @param b 向量b
 * @returns 余弦相似性分数
 */
function computeCosineSimilarity(a, b) {
    if (!a || !b) {
        throw new Error('向量不能为空');
    }
    if (a.length !== b.length) {
        throw new Error('向量维度不匹配');
    }
    var dotProduct = 0;
    var normA = 0;
    var normB = 0;
    for (var i = 0; i < a.length; i++) {
        var av = a[i];
        var bv = b[i];
        if (av !== undefined && bv !== undefined) {
            dotProduct += av * bv;
            normA += av * av;
            normB += bv * bv;
        }
    }
    if (normA === 0 || normB === 0) {
        return 0;
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
/**
 * 计算最大内积
 * @param a 向量a
 * @param b 向量b
 * @returns 最大内积
 */
function computeMaximumInnerProduct(a, b) {
    var dotProduct = 0;
    for (var i = 0; i < a.length; i++) {
        var av = a[i];
        var bv = b[i];
        if (av !== undefined && bv !== undefined) {
            dotProduct += av * bv;
        }
    }
    return dotProduct;
}
