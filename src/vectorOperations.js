"use strict";
/**
 * 基础向量操作函数
 * 实现向量的基本数学运算
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeVector = normalizeVector;
exports.addVectors = addVectors;
exports.subtractVectors = subtractVectors;
exports.scaleVector = scaleVector;
exports.centerVector = centerVector;
exports.computeCentroid = computeCentroid;
exports.computeDotProduct = computeDotProduct;
exports.copyVector = copyVector;
/**
 * 向量归一化
 * @param vector 输入向量
 * @returns 归一化后的向量
 */
function normalizeVector(vector) {
    var norm = 0;
    for (var i = 0; i < vector.length; i++) {
        var v = vector[i];
        if (v !== undefined) {
            norm += v * v;
        }
    }
    norm = Math.sqrt(norm);
    if (norm === 0) {
        return new Float32Array(vector.length);
    }
    var normalized = new Float32Array(vector.length);
    for (var i = 0; i < vector.length; i++) {
        var v = vector[i];
        if (v !== undefined) {
            normalized[i] = v / norm;
        }
    }
    return normalized;
}
/**
 * 向量加法
 * @param a 向量a
 * @param b 向量b
 * @returns 结果向量
 */
function addVectors(a, b) {
    if (a.length !== b.length) {
        throw new Error('向量维度不匹配');
    }
    var result = new Float32Array(a.length);
    for (var i = 0; i < a.length; i++) {
        var av = a[i];
        var bv = b[i];
        if (av !== undefined && bv !== undefined) {
            result[i] = av + bv;
        }
    }
    return result;
}
/**
 * 向量减法
 * @param a 向量a
 * @param b 向量b
 * @returns 结果向量
 */
function subtractVectors(a, b) {
    if (a.length !== b.length) {
        throw new Error('向量维度不匹配');
    }
    var result = new Float32Array(a.length);
    for (var i = 0; i < a.length; i++) {
        var av = a[i];
        var bv = b[i];
        if (av !== undefined && bv !== undefined) {
            result[i] = av - bv;
        }
    }
    return result;
}
/**
 * 向量标量乘法
 * @param vector 向量
 * @param scalar 标量
 * @returns 结果向量
 */
function scaleVector(vector, scalar) {
    var result = new Float32Array(vector.length);
    for (var i = 0; i < vector.length; i++) {
        var v = vector[i];
        if (v !== undefined) {
            result[i] = v * scalar;
        }
    }
    return result;
}
/**
 * 向量中心化
 * @param vector 输入向量
 * @param centroid 质心向量
 * @returns 中心化后的向量
 */
function centerVector(vector, centroid) {
    if (vector.length !== centroid.length) {
        throw new Error('向量和质心维度不匹配');
    }
    var centered = new Float32Array(vector.length);
    for (var i = 0; i < vector.length; i++) {
        var v = vector[i];
        var c = centroid[i];
        if (v !== undefined && c !== undefined) {
            centered[i] = v - c;
        }
    }
    return centered;
}
/**
 * 计算向量集合的质心 - 优化版本
 * 交换循环顺序以改善缓存局部性
 * @param vectors 向量集合
 * @returns 质心向量
 */
function computeCentroid(vectors) {
    var _a;
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
        centroid[i] = (_a = vectors[0][i]) !== null && _a !== void 0 ? _a : 0;
    }
    // 从第二个向量开始累加
    for (var j = 1; j < vectors.length; j++) {
        var vector = vectors[j];
        if (vector) {
            for (var i = 0; i < dimension; i++) {
                var val = vector[i];
                if (val !== undefined) {
                    centroid[i] += val;
                }
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
/**
 * 计算两个向量的点积
 * @param a 向量a
 * @param b 向量b
 * @returns 点积
 */
function computeDotProduct(a, b) {
    if (a.length !== b.length) {
        throw new Error('向量维度不匹配');
    }
    var sum = 0;
    for (var i = 0; i < a.length; i++) {
        var av = a[i];
        var bv = b[i];
        if (av !== undefined && bv !== undefined) {
            sum += av * bv;
        }
    }
    return sum;
}
/**
 * 复制向量
 * @param vector 源向量
 * @returns 复制的向量
 */
function copyVector(vector) {
    return new Float32Array(vector);
}
