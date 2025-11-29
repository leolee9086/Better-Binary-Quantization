"use strict";
/**
 * js实现下,直接计算比lucene中使用的位运算版本更加高效
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeQuantizedDotProduct = computeQuantizedDotProduct;
exports.computeInt4BitDotProduct = computeInt4BitDotProduct;
exports.computeInt1BitDotProduct = computeInt1BitDotProduct;
/**
 * 量化向量点积计算函数（朴素实现）
 * 直接使用字节乘法计算点积，不使用位运算
 *
 * @param q 查询向量
 * @param d 索引向量
 * @returns 点积结果
 */
function computeQuantizedDotProduct(q, d) {
    if (q.length !== d.length) {
        throw new Error("\u5411\u91CF\u957F\u5EA6\u4E0D\u5339\u914D\uFF1A\u67E5\u8BE2\u5411\u91CF\u957F\u5EA6".concat(q.length, "\uFF0C\u7D22\u5F15\u5411\u91CF\u957F\u5EA6").concat(d.length));
    }
    var sum = 0;
    // 直接计算点积，不使用位运算
    for (var i = 0; i < q.length; i++) {
        var qVal = q[i];
        var dVal = d[i];
        if (qVal !== undefined && dVal !== undefined) {
            sum += qVal * dVal;
        }
    }
    return sum;
}
/**
 * 4位-1位点积计算（朴素实现）
 * 直接使用字节乘法计算点积，不使用位运算
 *
 * @param q 4位量化的查询向量（转置后的格式，4个位平面）
 * @param d 1位量化的索引向量
 * @returns 点积结果
 */
function computeInt4BitDotProduct(q, d) {
    return computeQuantizedDotProduct(q, d);
}
/**
 * 单比特-单比特点积计算（朴素实现）
 * 直接使用字节乘法计算点积，不使用位运算
 *
 * @param q 单比特量化的查询向量（打包后的格式）
 * @param d 单比特量化的索引向量（打包后的格式）
 * @returns 点积结果
 */
function computeInt1BitDotProduct(q, d) {
    return computeQuantizedDotProduct(q, d);
}
