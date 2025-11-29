"use strict";
/**
 * 位运算点积计算函数
 * 实现4位-1位和1位-1位点积计算
 * 基于Lucene的二值量化实现
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeInt4BitDotProductBitwise = computeInt4BitDotProductBitwise;
exports.computeInt1BitDotProductBitwise = computeInt1BitDotProductBitwise;
exports.computeInt4BitDotProduct = computeInt4BitDotProduct;
exports.computeInt1BitDotProduct = computeInt1BitDotProduct;
exports.computeInt4BitDotProductOptimized = computeInt4BitDotProductOptimized;
exports.computeInt4BitDotProductWithPackedIndex = computeInt4BitDotProductWithPackedIndex;
var utils_1 = require("./utils");
/**
 * 4位-1位点积计算（完全展开版本）- 原始位运算实现
 * 将4个位平面的循环完全展开，避免循环开销
 *
 * @param q 4位量化的查询向量（转置后的格式，4个位平面）
 * @param d 1位量化的索引向量
 * @returns 点积结果
 */
function computeInt4BitDotProductBitwise(q, d) {
    // 验证输入：q应该是4个位平面，d是1位向量
    if (q.length !== d.length * 4) {
        throw new Error("4\u4F4D\u67E5\u8BE2\u5411\u91CF\u957F\u5EA6".concat(q.length, "\u4E0E1\u4F4D\u7D22\u5F15\u5411\u91CF\u957F\u5EA6").concat(d.length, "\u4E0D\u5339\u914D\uFF0C\u671F\u671B\u67E5\u8BE2\u5411\u91CF\u957F\u5EA6\u4E3A").concat(d.length * 4));
    }
    var size = d.length;
    var ret = 0;
    // 完全展开4个位平面的计算
    // 位平面0
    var subRet0 = 0;
    var r0 = 0;
    var upperBound0 = d.length & -4;
    for (; r0 < upperBound0; r0 += 4) {
        var qInt = getBigEndianInt32(q, r0);
        var dInt = getBigEndianInt32(d, r0);
        var bitwiseAnd = qInt & dInt;
        subRet0 += (0, utils_1.bitCount)(bitwiseAnd);
    }
    for (; r0 < d.length; r0++) {
        var qVal = q[r0];
        var dVal = d[r0];
        if (qVal !== undefined && dVal !== undefined) {
            var bitwiseAnd = (qVal & dVal) & 0xFF;
            subRet0 += (0, utils_1.bitCount)(bitwiseAnd);
        }
    }
    // 位平面1
    var subRet1 = 0;
    var r1 = 0;
    var upperBound1 = d.length & -4;
    for (; r1 < upperBound1; r1 += 4) {
        var qInt = getBigEndianInt32(q, size + r1);
        var dInt = getBigEndianInt32(d, r1);
        var bitwiseAnd = qInt & dInt;
        subRet1 += (0, utils_1.bitCount)(bitwiseAnd);
    }
    for (; r1 < d.length; r1++) {
        var qVal = q[size + r1];
        var dVal = d[r1];
        if (qVal !== undefined && dVal !== undefined) {
            var bitwiseAnd = (qVal & dVal) & 0xFF;
            subRet1 += (0, utils_1.bitCount)(bitwiseAnd);
        }
    }
    // 位平面2
    var subRet2 = 0;
    var r2 = 0;
    var upperBound2 = d.length & -4;
    for (; r2 < upperBound2; r2 += 4) {
        var qInt = getBigEndianInt32(q, size * 2 + r2);
        var dInt = getBigEndianInt32(d, r2);
        var bitwiseAnd = qInt & dInt;
        subRet2 += (0, utils_1.bitCount)(bitwiseAnd);
    }
    for (; r2 < d.length; r2++) {
        var qVal = q[size * 2 + r2];
        var dVal = d[r2];
        if (qVal !== undefined && dVal !== undefined) {
            var bitwiseAnd = (qVal & dVal) & 0xFF;
            subRet2 += (0, utils_1.bitCount)(bitwiseAnd);
        }
    }
    // 位平面3
    var subRet3 = 0;
    var r3 = 0;
    var upperBound3 = d.length & -4;
    for (; r3 < upperBound3; r3 += 4) {
        var qInt = getBigEndianInt32(q, size * 3 + r3);
        var dInt = getBigEndianInt32(d, r3);
        var bitwiseAnd = qInt & dInt;
        subRet3 += (0, utils_1.bitCount)(bitwiseAnd);
    }
    for (; r3 < d.length; r3++) {
        var qVal = q[size * 3 + r3];
        var dVal = d[r3];
        if (qVal !== undefined && dVal !== undefined) {
            var bitwiseAnd = (qVal & dVal) & 0xFF;
            subRet3 += (0, utils_1.bitCount)(bitwiseAnd);
        }
    }
    // 加权累加所有位平面
    ret = subRet0 + (subRet1 << 1) + (subRet2 << 2) + (subRet3 << 3);
    return ret;
}
/**
 * 单比特-单比特点积计算 - 原始位运算实现
 * 用于单比特量化的向量点积计算
 *
 * @param q 单比特量化的查询向量（打包后的格式）
 * @param d 单比特量化的索引向量（打包后的格式）
 * @returns 点积结果
 */
function computeInt1BitDotProductBitwise(q, d) {
    if (q.length !== d.length) {
        throw new Error('单比特向量长度必须相同');
    }
    var ret = 0;
    // 逐字节计算位运算点积
    for (var i = 0; i < q.length; i++) {
        var qVal = q[i];
        var dVal = d[i];
        if (qVal !== undefined && dVal !== undefined) {
            // 计算位运算AND，然后统计1的个数
            var bitwiseAnd = (qVal & dVal) & 0xFF;
            ret += (0, utils_1.bitCount)(bitwiseAnd);
        }
    }
    return ret;
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
    // 验证输入：q应该是4个位平面，d是1位向量
    if (q.length !== d.length) {
        throw new Error("4\u4F4D\u67E5\u8BE2\u5411\u91CF\u957F\u5EA6".concat(q.length, "\u4E0E1\u4F4D\u7D22\u5F15\u5411\u91CF\u957F\u5EA6").concat(d.length, "\u4E0D\u5339\u914D\uFF0C\u671F\u671B\u67E5\u8BE2\u5411\u91CF\u957F\u5EA6\u4E3A").concat(d.length * 4));
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
 * 单比特-单比特点积计算（朴素实现）
 * 直接使用字节乘法计算点积，不使用位运算
 *
 * @param q 单比特量化的查询向量（打包后的格式）
 * @param d 单比特量化的索引向量（打包后的格式）
 * @returns 点积结果
 */
function computeInt1BitDotProduct(q, d) {
    if (q.length !== d.length) {
        throw new Error('单比特向量长度必须相同');
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
 * 优化的4位-1位点积计算
 * 使用查找表优化的版本，提高性能
 *
 * @param q 4位量化的查询向量（转置后的格式，4个位平面）
 * @param d 1位量化的索引向量
 * @returns 点积结果
 */
function computeInt4BitDotProductOptimized(q, d) {
    if (q.length !== d.length * 4) {
        throw new Error('4位查询向量长度必须是1位索引向量长度的4倍');
    }
    var ret = 0;
    var size = d.length;
    // 分别计算4个位平面的点积 - 完全按照Lucene原始实现
    for (var i = 0; i < 4; i++) {
        var r = 0;
        var subRet = 0;
        // 处理整数边界对齐的部分
        var upperBound = d.length & -4; // Integer.BYTES = 4
        for (; r < upperBound; r += 4) {
            // 使用32位整数进行位运算
            var qInt = getBigEndianInt32(q, i * size + r);
            var dInt = getBigEndianInt32(d, r);
            var bitwiseAnd = qInt & dInt;
            subRet += (0, utils_1.bitCount)(bitwiseAnd);
        }
        // 处理剩余的部分
        for (; r < d.length; r++) {
            var qVal = q[i * size + r];
            var dVal = d[r];
            if (qVal !== undefined && dVal !== undefined) {
                var bitwiseAnd = (qVal & dVal) & 0xFF;
                subRet += (0, utils_1.bitCount)(bitwiseAnd);
            }
        }
        // 加权累加
        ret += subRet << i;
    }
    return ret;
}
/**
 * 4位查询-已打包1位索引点积计算
 * 计算4位量化的查询向量与已打包的1位量化索引向量的点积
 *
 * @param q 4位量化的查询向量（转置后的格式，4个位平面）
 * @param d 已打包的1位量化的索引向量
 * @returns 点积结果
 */
function computeInt4BitDotProductWithPackedIndex(q, d) {
    // 验证输入：q应该是4个位平面，d应该是打包后的1位向量
    var dimension = d.length * 8; // 1个字节包含8位
    if (q.length !== dimension * 4) {
        throw new Error("4\u4F4D\u67E5\u8BE2\u5411\u91CF\u957F\u5EA6".concat(q.length, "\u4E0E1\u4F4D\u7D22\u5F15\u5411\u91CF\u957F\u5EA6").concat(d.length, "\u4E0D\u5339\u914D\uFF0C\u671F\u671B\u67E5\u8BE2\u5411\u91CF\u957F\u5EA6\u4E3A").concat(dimension * 4));
    }
    var ret = 0;
    var size = d.length;
    // 对每个位平面计算点积
    for (var i = 0; i < 4; i++) {
        var subRet = 0;
        // 处理每个字节
        for (var r = 0; r < size; r++) {
            var qByte = q[i * size + r];
            var dByte = d[r];
            if (qByte !== undefined && dByte !== undefined) {
                // 计算位与操作并统计1的个数
                var bitwiseAnd = qByte & dByte;
                var count = (0, utils_1.bitCount)(bitwiseAnd);
                subRet += count;
            }
        }
        // 将结果左移i位并累加
        ret += subRet << i;
    }
    return ret;
}
/**
 * 从字节数组中读取32位整数（大端序）
 * 参考 Lucene 的 BitUtil.VH_NATIVE_INT.get 方法
 * @param array 字节数组
 * @param offset 偏移量
 * @returns 32位整数
 */
function getBigEndianInt32(array, offset) {
    // 假设调用方已经确保了安全偏移量
    var val0 = array[offset];
    var val1 = array[offset + 1];
    var val2 = array[offset + 2];
    var val3 = array[offset + 3];
    // 仍然保留 undefined 检查，以防万一，或者在调用方确保不会出现 undefined
    if (val0 === undefined || val1 === undefined || val2 === undefined || val3 === undefined) {
        // 这通常不应该发生，如果外部循环逻辑正确
        throw new Error('内部错误：数组访问越界');
    }
    return ((val0 & 0xFF) << 24) |
        ((val1 & 0xFF) << 16) |
        ((val2 & 0xFF) << 8) |
        (val3 & 0xFF);
}
