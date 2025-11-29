"use strict";
/**
 * 二值量化系统的类型定义
 * 基于Lucene的二值量化实现
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorSimilarityFunction = void 0;
/**
 * 向量相似性函数类型
 */
var VectorSimilarityFunction;
(function (VectorSimilarityFunction) {
    VectorSimilarityFunction["EUCLIDEAN"] = "EUCLIDEAN";
    VectorSimilarityFunction["COSINE"] = "COSINE";
    VectorSimilarityFunction["MAXIMUM_INNER_PRODUCT"] = "MAXIMUM_INNER_PRODUCT";
})(VectorSimilarityFunction || (exports.VectorSimilarityFunction = VectorSimilarityFunction = {}));
