"use strict";
/**
 * 向量工具函数
 * 提供向量创建和计算相关的工具函数
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeVectorMagnitude = computeVectorMagnitude;
exports.createRandomVector = createRandomVector;
exports.createZeroVector = createZeroVector;
/**
 * 计算向量幅度
 * @param vector 输入向量
 * @returns 向量幅度
 */
function computeVectorMagnitude(vector) {
    var sum = 0;
    for (var i = 0; i < vector.length; i++) {
        var v = vector[i];
        if (v !== undefined) {
            sum += v * v;
        }
    }
    return Math.sqrt(sum);
}
/**
 * 创建随机向量
 * @param dimension 向量维度
 * @param min 最小值
 * @param max 最大值
 * @returns 随机向量
 */
function createRandomVector(dimension, min, max) {
    if (min === void 0) { min = -1; }
    if (max === void 0) { max = 1; }
    var vector = new Float32Array(dimension);
    for (var i = 0; i < dimension; i++) {
        vector[i] = Math.random() * (max - min) + min;
    }
    return vector;
}
/**
 * 创建零向量
 * @param dimension 向量维度
 * @returns 零向量
 */
function createZeroVector(dimension) {
    return new Float32Array(dimension);
}
