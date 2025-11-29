"use strict";
/**
 * 二值量化评分器
 * 实现量化向量的相似性计算
 * 基于Lucene的二值量化实现
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinaryQuantizedScorer = void 0;
var types_1 = require("./types");
var constants_1 = require("./constants");
var bitwiseDotProduct_1 = require("./bitwiseDotProduct");
var vectorSimilarity_1 = require("./vectorSimilarity");
var batchDotProduct_1 = require("./batchDotProduct");
var optimizedScalarQuantizer_1 = require("./optimizedScalarQuantizer");
/**
 * 缩放最大内积分数
 * 将最大内积分数缩放到合理范围，与Lucene保持一致
 * @param score 原始分数
 * @returns 缩放后的分数
 */
function scaleMaxInnerProductScore(score) {
    if (score < 0) {
        return 1 / (1 - score);
    }
    return score + 1;
}
/**
 * 二值量化评分器类
 * 实现量化向量的相似性计算和评分
 */
var BinaryQuantizedScorer = /** @class */ (function () {
    /**
     * 构造函数
     * @param similarityFunction 相似性函数
     */
    function BinaryQuantizedScorer(similarityFunction) {
        this.similarityFunction = similarityFunction;
    }
    /**
     * 计算量化相似性分数
     * @param quantizedQuery 量化的查询向量
     * @param queryCorrections 查询向量修正因子
     * @param targetVectors 目标向量集合
     * @param targetOrd 目标向量序号
     * @param queryBits 查询向量位数（1或4）
     * @param originalQueryVector 原始查询向量（可选）
     * @returns 量化评分结果
     */
    BinaryQuantizedScorer.prototype.computeQuantizedScore = function (quantizedQuery, queryCorrections, targetVectors, targetOrd, queryBits, originalQueryVector) {
        // 2. 根据查询位数选择正确的处理方法
        if (queryBits === 1) {
            // 单比特量化：使用单比特相似性计算
            return this.computeOneBitQuantizedScore(quantizedQuery, queryCorrections, targetVectors, targetOrd);
        }
        else if (queryBits === 4) {
            // 4位查询 + 1位索引：使用4位-1位相似性计算
            return this.computeFourBitQuantizedScore(quantizedQuery, queryCorrections, targetVectors, targetOrd, originalQueryVector);
        }
        else {
            throw new Error("\u4E0D\u652F\u6301\u7684\u67E5\u8BE2\u4F4D\u6570: ".concat(queryBits, "\uFF0C\u53EA\u652F\u63011\u4F4D\u548C4\u4F4D"));
        }
    };
    /**
     * 计算1位量化相似性分数
     * 按照Lucene二值量化原始实现，不使用FOUR_BIT_SCALE
     * @param qcDist 位运算点积
     * @param queryCorrections 查询向量修正因子
     * @param indexCorrections 索引向量修正因子
     * @param dimension 向量维度
     * @param centroidDP 质心点积
     * @returns 相似性分数
     */
    BinaryQuantizedScorer.prototype.computeOneBitSimilarityScore = function (qcDist, queryCorrections, indexCorrections, dimension, centroidDP) {
        // 按照Lucene二值量化原始实现计算分数
        // 参考 Lucene102BinaryFlatVectorsScorer.quantizedScore 方法
        var x1 = indexCorrections.quantizedComponentSum;
        var ax = indexCorrections.lowerInterval;
        var lx = indexCorrections.upperInterval - ax;
        var ay = queryCorrections.lowerInterval;
        // 1位量化：查询向量是1bit的，所以不需要使用FOUR_BIT_SCALE
        var ly = queryCorrections.upperInterval - ay;
        var y1 = queryCorrections.quantizedComponentSum;
        // 计算基础分数
        var score = ax * ay * dimension +
            ay * lx * x1 +
            ax * ly * y1 +
            lx * ly * qcDist;
        // 根据相似性函数调整分数
        switch (this.similarityFunction) {
            case types_1.VectorSimilarityFunction.EUCLIDEAN:
                score = queryCorrections.additionalCorrection +
                    indexCorrections.additionalCorrection -
                    2 * score;
                return Math.max(1 / (1 + score), 0);
            case types_1.VectorSimilarityFunction.COSINE:
                // 严格按照Java原版实现：不使用FOUR_BIT_SCALE
                score += queryCorrections.additionalCorrection +
                    indexCorrections.additionalCorrection -
                    centroidDP;
                var finalScore = Math.max((1 + score) / 2, 0);
                return finalScore;
            case types_1.VectorSimilarityFunction.MAXIMUM_INNER_PRODUCT:
                score += queryCorrections.additionalCorrection +
                    indexCorrections.additionalCorrection -
                    centroidDP;
                // 1位量化：不使用FOUR_BIT_SCALE
                return scaleMaxInnerProductScore(score);
            default:
                throw new Error("\u4E0D\u652F\u6301\u7684\u76F8\u4F3C\u6027\u51FD\u6570: ".concat(this.similarityFunction));
        }
    };
    /**
     * 计算4位查询+1位索引相似性分数
     * 按照Lucene二值量化原始实现，使用FOUR_BIT_SCALE
     * @param qcDist 位运算点积
     * @param queryCorrections 查询向量修正因子
     * @param indexCorrections 索引向量修正因子
     * @param dimension 向量维度
     * @param centroidDP 质心点积
     * @returns 相似性分数
     */
    BinaryQuantizedScorer.prototype.computeFourBitSimilarityScore = function (qcDist, queryCorrections, indexCorrections, dimension, centroidDP) {
        // 4位查询的相似性分数计算
        // 严格按照Java原版实现四项公式
        var x1 = indexCorrections.quantizedComponentSum;
        var ax = indexCorrections.lowerInterval;
        var lx = indexCorrections.upperInterval - ax;
        var ay = queryCorrections.lowerInterval;
        var ly = (queryCorrections.upperInterval - ay) * constants_1.FOUR_BIT_SCALE;
        var y1 = queryCorrections.quantizedComponentSum;
        // 四项公式：score = ax * ay * dimension + ay * lx * x1 + ax * ly * y1 + lx * ly * qcDist
        var score = ax * ay * dimension + ay * lx * x1 + ax * ly * y1 + lx * ly * qcDist;
        switch (this.similarityFunction) {
            case types_1.VectorSimilarityFunction.EUCLIDEAN:
                var euclideanScore = queryCorrections.additionalCorrection +
                    indexCorrections.additionalCorrection -
                    2 * score;
                return Math.max(1 / (1 + euclideanScore), 0);
            case types_1.VectorSimilarityFunction.COSINE:
            case types_1.VectorSimilarityFunction.MAXIMUM_INNER_PRODUCT:
                var adjustedScore = score + queryCorrections.additionalCorrection +
                    indexCorrections.additionalCorrection -
                    centroidDP;
                if (this.similarityFunction === types_1.VectorSimilarityFunction.MAXIMUM_INNER_PRODUCT) {
                    return scaleMaxInnerProductScore(adjustedScore);
                }
                var finalScore = Math.max((1 + adjustedScore) / 2, 0);
                return finalScore;
            default:
                throw new Error("\u4E0D\u652F\u6301\u7684\u76F8\u4F3C\u6027\u51FD\u6570: ".concat(this.similarityFunction));
        }
    };
    /**
     * 计算1位量化相似性分数
     * @param quantizedQuery 1位量化的查询向量
     * @param queryCorrections 查询向量修正因子
     * @param targetVectors 目标向量集合
     * @param targetOrd 目标向量序号
     * @returns 量化评分结果
     */
    BinaryQuantizedScorer.prototype.computeOneBitQuantizedScore = function (quantizedQuery, queryCorrections, targetVectors, targetOrd) {
        // 2. 1位-1位点积计算（使用未打包的索引向量）
        // 修复：使用未打包的1bit索引向量与未打包的1bit查询向量进行点积
        var unpackedBinaryCode = targetVectors.getUnpackedVector(targetOrd);
        var qcDist = (0, bitwiseDotProduct_1.computeInt1BitDotProduct)(quantizedQuery, unpackedBinaryCode);
        // 3. 获取目标向量的修正因子
        var indexCorrections = targetVectors.getCorrectiveTerms(targetOrd);
        // 4. 计算1位量化相似性分数
        var score = this.computeOneBitSimilarityScore(qcDist, queryCorrections, indexCorrections, targetVectors.dimension(), targetVectors.getCentroidDP());
        return {
            score: score,
            bitDotProduct: qcDist,
            corrections: {
                query: queryCorrections,
                index: indexCorrections
            }
        };
    };
    /**
     * 计算4位查询+1位索引相似性分数
     * @param quantizedQuery 4位量化的查询向量（转置后的格式）
     * @param queryCorrections 查询向量修正因子
     * @param targetVectors 目标向量集合
     * @param targetOrd 目标向量序号
     * @returns 量化评分结果
     */
    BinaryQuantizedScorer.prototype.computeFourBitQuantizedScore = function (quantizedQuery, queryCorrections, targetVectors, targetOrd, originalQueryVector) {
        // 2. 4位-1位点积计算（使用未打包的索引向量）
        var unpackedBinaryCode = targetVectors.getUnpackedVector(targetOrd);
        // 计算点积
        var qcDist = (0, bitwiseDotProduct_1.computeInt4BitDotProduct)(quantizedQuery, unpackedBinaryCode);
        // 3. 获取目标向量的修正因子
        var indexCorrections = targetVectors.getCorrectiveTerms(targetOrd);
        // 4. 计算4位查询+1位索引相似性分数
        var score = this.computeFourBitSimilarityScore(qcDist, queryCorrections, indexCorrections, targetVectors.dimension(), originalQueryVector ? targetVectors.getCentroidDP(originalQueryVector) : 0);
        return {
            score: score,
            bitDotProduct: qcDist,
            corrections: {
                query: queryCorrections,
                index: indexCorrections
            }
        };
    };
    /**
     * 批量计算量化相似性分数
     * 使用八路循环展开的批量点积算法，显著提升性能
     * @param quantizedQuery 量化的查询向量
     * @param queryCorrections 查询向量修正因子
     * @param targetVectors 目标向量集合
     * @param targetOrds 目标向量序号数组
     * @param queryBits 查询向量位数（1或4）
     * @returns 量化评分结果数组
     */
    BinaryQuantizedScorer.prototype.computeBatchQuantizedScores = function (quantizedQuery, queryCorrections, targetVectors, targetOrds, queryBits, originalQueryVector) {
        // 批量计算（1位和4位量化）
        try {
            var qcDists = void 0;
            if (queryBits === 1) {
                // 1位量化：使用直接打包算法
                // 1. 创建打包的查询向量
                var packedQueryLength = Math.ceil(quantizedQuery.length / 8);
                var packedQuantizedQuery = new Uint8Array(packedQueryLength);
                optimizedScalarQuantizer_1.OptimizedScalarQuantizer.packAsBinary(quantizedQuery, packedQuantizedQuery);
                // 2. 创建直接打包的目标向量缓冲区
                var directPackedBuffer = (0, batchDotProduct_1.createDirectPackedBuffer)(targetVectors, targetOrds, packedQuantizedQuery.length);
                // 3. 使用直接打包算法进行批量点积计算
                qcDists = (0, batchDotProduct_1.computeBatchDotProductDirectPacked)(packedQuantizedQuery, directPackedBuffer, targetOrds.length);
            }
            else {
                // 4位量化：使用正确的直接打包算法
                // 1. 创建直接打包的目标向量缓冲区
                // 注意：1bit索引向量是打包格式，每8个bit打包成1个byte
                var packedVectorSize = Math.ceil(targetVectors.dimension() / 8);
                var directPackedBuffer = (0, batchDotProduct_1.createDirectPackedBuffer)(targetVectors, targetOrds, packedVectorSize);
                // 2. 使用直接打包算法进行批量点积计算
                qcDists = (0, batchDotProduct_1.computeBatchFourBitDotProductDirectPacked)(quantizedQuery, directPackedBuffer, targetOrds.length, targetVectors.dimension());
            }
            // 3. 批量计算相似性分数
            var scores = void 0;
            if (queryBits === 1) {
                scores = (0, batchDotProduct_1.computeBatchOneBitSimilarityScores)(qcDists, queryCorrections, targetVectors, targetOrds, targetVectors.dimension(), targetVectors.getCentroidDP(), this.similarityFunction);
            }
            else {
                // 4位量化：需要传递原始查询向量给getCentroidDP
                scores = (0, batchDotProduct_1.computeBatchFourBitSimilarityScores)(qcDists, queryCorrections, targetVectors, targetOrds, targetVectors.dimension(), targetVectors.getCentroidDP(originalQueryVector), this.similarityFunction);
            }
            // 4. 构建结果数组
            var results = [];
            for (var i = 0; i < targetOrds.length; i++) {
                var indexCorrections = targetVectors.getCorrectiveTerms(targetOrds[i]);
                results.push({
                    score: scores[i],
                    bitDotProduct: qcDists[i],
                    corrections: {
                        query: queryCorrections,
                        index: indexCorrections
                    }
                });
            }
            return results;
        }
        catch (error) {
            // 如果批量计算失败，回退到原始方法
            console.warn('批量计算失败，回退到原始方法:', error);
            var results = [];
            for (var _i = 0, targetOrds_1 = targetOrds; _i < targetOrds_1.length; _i++) {
                var targetOrd = targetOrds_1[_i];
                var result = this.computeQuantizedScore(quantizedQuery, queryCorrections, targetVectors, targetOrd, queryBits, originalQueryVector);
                results.push(result);
            }
            return results;
        }
    };
    /**
     * 计算原始向量和量化向量的相似性分数
     * @param originalQuery 原始查询向量
     * @param targetVector 目标向量
     * @param similarityFunction 相似性函数
     * @returns 原始相似性分数
     */
    BinaryQuantizedScorer.prototype.computeOriginalScore = function (originalQuery, targetVector, similarityFunction) {
        switch (similarityFunction) {
            case types_1.VectorSimilarityFunction.EUCLIDEAN:
                return (0, vectorSimilarity_1.computeSimilarity)(originalQuery, targetVector, 'EUCLIDEAN');
            case types_1.VectorSimilarityFunction.COSINE:
                return (0, vectorSimilarity_1.computeSimilarity)(originalQuery, targetVector, 'COSINE');
            case types_1.VectorSimilarityFunction.MAXIMUM_INNER_PRODUCT:
                return (0, vectorSimilarity_1.computeSimilarity)(originalQuery, targetVector, 'MAXIMUM_INNER_PRODUCT');
            default:
                throw new Error("\u4E0D\u652F\u6301\u7684\u76F8\u4F3C\u6027\u51FD\u6570: ".concat(similarityFunction));
        }
    };
    /**
     * 比较原始分数和量化分数
     * @param originalScore 原始分数
     * @param quantizedScore 量化分数
     * @returns 比较结果
     */
    BinaryQuantizedScorer.prototype.compareScores = function (originalScore, quantizedScore) {
        var difference = Math.abs(originalScore - quantizedScore);
        // 处理零值情况
        var relativeError;
        if (originalScore === 0) {
            relativeError = quantizedScore === 0 ? 0 : Infinity;
        }
        else {
            relativeError = difference / Math.abs(originalScore);
        }
        // 改进的相关性计算
        var correlation = this.computeCorrelation(originalScore, quantizedScore);
        return {
            difference: difference,
            relativeError: relativeError,
            correlation: correlation
        };
    };
    /**
     * 计算相关性
     * @param a 值a
     * @param b 值b
     * @returns 相关性系数
     */
    BinaryQuantizedScorer.prototype.computeCorrelation = function (a, b) {
        // 如果两个值相同，相关性为1
        if (a === b) {
            return 1;
        }
        // 如果其中一个为0，另一个不为0，相关性为0
        if ((a === 0 && b !== 0) || (a !== 0 && b === 0)) {
            return 0;
        }
        // 如果两个都为0，相关性为1
        if (a === 0 && b === 0) {
            return 1;
        }
        // 计算相关系数
        var meanA = a;
        var meanB = b;
        var diffA = a - meanA;
        var diffB = b - meanB;
        var numerator = diffA * diffB;
        var denominator = Math.abs(diffA) * Math.abs(diffB);
        if (denominator === 0) {
            return 0;
        }
        return numerator / denominator;
    };
    /**
     * 计算量化精度
     * @param originalScores 原始分数数组
     * @param quantizedScores 量化分数数组
     * @returns 量化精度统计
     */
    BinaryQuantizedScorer.prototype.computeQuantizationAccuracy = function (originalScores, quantizedScores) {
        if (originalScores.length !== quantizedScores.length) {
            throw new Error('原始分数和量化分数数组长度不匹配');
        }
        var errors = [];
        var sumError = 0;
        var maxError = 0;
        var minError = Infinity;
        for (var i = 0; i < originalScores.length; i++) {
            var orig = originalScores[i];
            var quant = quantizedScores[i];
            if (orig !== undefined && quant !== undefined) {
                var error = Math.abs(orig - quant);
                errors.push(error);
                sumError += error;
                maxError = Math.max(maxError, error);
                minError = Math.min(minError, error);
            }
        }
        var meanError = sumError / errors.length;
        var stdError = this.computeStandardDeviation(errors, meanError);
        var correlation = this.computePearsonCorrelation(originalScores, quantizedScores);
        return {
            meanError: meanError,
            maxError: maxError,
            minError: minError,
            stdError: stdError,
            correlation: correlation
        };
    };
    /**
     * 计算标准差
     * @param values 数值数组
     * @param mean 均值
     * @returns 标准差
     */
    BinaryQuantizedScorer.prototype.computeStandardDeviation = function (values, mean) {
        var sum = 0;
        for (var _i = 0, values_1 = values; _i < values_1.length; _i++) {
            var value = values_1[_i];
            var diff = value - mean;
            sum += diff * diff;
        }
        return Math.sqrt(sum / values.length);
    };
    /**
     * 计算皮尔逊相关系数
     * @param x 数组x
     * @param y 数组y
     * @returns 相关系数
     */
    BinaryQuantizedScorer.prototype.computePearsonCorrelation = function (x, y) {
        if (x.length !== y.length) {
            throw new Error('数组长度不匹配');
        }
        var n = x.length;
        var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        for (var i = 0; i < n; i++) {
            var xv = x[i];
            var yv = y[i];
            if (xv !== undefined && yv !== undefined) {
                sumX += xv;
                sumY += yv;
                sumXY += xv * yv;
                sumX2 += xv * xv;
                sumY2 += yv * yv;
            }
        }
        var numerator = n * sumXY - sumX * sumY;
        var denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        if (denominator === 0) {
            return 0;
        }
        return numerator / denominator;
    };
    /**
     * 获取相似性函数类型
     * @returns 相似性函数类型
     */
    BinaryQuantizedScorer.prototype.getSimilarityFunction = function () {
        return this.similarityFunction;
    };
    return BinaryQuantizedScorer;
}());
exports.BinaryQuantizedScorer = BinaryQuantizedScorer;
