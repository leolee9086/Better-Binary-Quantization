"use strict";
/**
 * 二值量化系统主入口
 * 基于Lucene的二值量化实现
 *
 * 本系统实现了完整的二值量化功能，包括：
 * - 优化的标量量化器
 * - 位运算优化的向量操作
 * - 二值量化评分器
 * - 完整的二值量化格式
 *
 * 主要特性：
 * - 各向异性损失函数
 * - 坐标下降优化算法
 * - 非对称量化策略 (查询4位 vs 索引1位)
 * - 质心中心化优化
 * - SIMD友好的位运算优化
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = exports.DEFAULT_CONFIG = exports.wasm = exports.BinaryQuantizationFormat = exports.BinaryQuantizedScorer = exports.OptimizedScalarQuantizer = void 0;
exports.createBinaryQuantizationFormat = createBinaryQuantizationFormat;
exports.quickQuantize = quickQuantize;
exports.quickSearch = quickSearch;
exports.computeAccuracy = computeAccuracy;
// 类型定义
__exportStar(require("./types"), exports);
// 常量
__exportStar(require("./constants"), exports);
// 工具函数
__exportStar(require("./utils"), exports);
// 核心组件
var optimizedScalarQuantizer_1 = require("./optimizedScalarQuantizer");
Object.defineProperty(exports, "OptimizedScalarQuantizer", { enumerable: true, get: function () { return optimizedScalarQuantizer_1.OptimizedScalarQuantizer; } });
var binaryQuantizedScorer_1 = require("./binaryQuantizedScorer");
Object.defineProperty(exports, "BinaryQuantizedScorer", { enumerable: true, get: function () { return binaryQuantizedScorer_1.BinaryQuantizedScorer; } });
var binaryQuantizationFormat_1 = require("./binaryQuantizationFormat");
Object.defineProperty(exports, "BinaryQuantizationFormat", { enumerable: true, get: function () { return binaryQuantizationFormat_1.BinaryQuantizationFormat; } });
// 向量操作函数
__exportStar(require("./vectorOperations"), exports);
__exportStar(require("./vectorSimilarity"), exports);
__exportStar(require("./vectorUtils"), exports);
__exportStar(require("./bitwiseDotProduct"), exports);
// WASM 模块
exports.wasm = require("./wasm");
// 本地导入用于函数内部使用
var binaryQuantizationFormat_2 = require("./binaryQuantizationFormat");
var types_1 = require("./types");
// 默认配置
exports.DEFAULT_CONFIG = {
    queryBits: 4,
    indexBits: 1,
    quantizer: {
        similarityFunction: types_1.VectorSimilarityFunction.COSINE,
        lambda: 0.1,
        iters: 5
    }
};
/**
 * 创建二值量化格式实例
 * @param config 配置选项
 * @returns 二值量化格式实例
 */
function createBinaryQuantizationFormat(config) {
    if (config === void 0) { config = exports.DEFAULT_CONFIG; }
    return new binaryQuantizationFormat_2.BinaryQuantizationFormat(config);
}
/**
 * 快速量化向量集合
 * @param vectors 向量集合
 * @param similarityFunction 相似性函数
 * @returns 量化结果
 */
function quickQuantize(vectors, similarityFunction) {
    if (similarityFunction === void 0) { similarityFunction = types_1.VectorSimilarityFunction.COSINE; }
    var format = new binaryQuantizationFormat_2.BinaryQuantizationFormat({
        quantizer: {
            similarityFunction: similarityFunction,
            lambda: 0.1,
            iters: 5
        }
    });
    return format.quantizeVectors(vectors);
}
/**
 * 快速搜索最近邻
 * @param queryVector 查询向量
 * @param targetVectors 目标向量集合
 * @param k 返回数量
 * @param similarityFunction 相似性函数
 * @returns 最近邻结果
 */
function quickSearch(queryVector, targetVectors, k, similarityFunction) {
    if (similarityFunction === void 0) { similarityFunction = types_1.VectorSimilarityFunction.COSINE; }
    var format = new binaryQuantizationFormat_2.BinaryQuantizationFormat({
        quantizer: {
            similarityFunction: similarityFunction,
            lambda: 0.1,
            iters: 5
        }
    });
    var quantizedVectors = format.quantizeVectors(targetVectors).quantizedVectors;
    return format.searchNearestNeighbors(queryVector, quantizedVectors, k);
}
/**
 * 计算量化精度
 * @param originalVectors 原始向量集合
 * @param queryVectors 查询向量集合
 * @param similarityFunction 相似性函数
 * @returns 量化精度统计
 */
function computeAccuracy(originalVectors, queryVectors, similarityFunction) {
    if (similarityFunction === void 0) { similarityFunction = types_1.VectorSimilarityFunction.COSINE; }
    var format = new binaryQuantizationFormat_2.BinaryQuantizationFormat({
        quantizer: {
            similarityFunction: similarityFunction,
            lambda: 0.1,
            iters: 5
        }
    });
    return format.computeQuantizationAccuracy(originalVectors, queryVectors);
}
/**
 * 版本信息
 */
exports.VERSION = '1.0.0';
