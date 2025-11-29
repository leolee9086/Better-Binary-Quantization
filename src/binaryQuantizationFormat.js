"use strict";
/**
 * 二值量化格式类
 * 实现完整的二值量化系统
 * 基于Lucene的二值量化实现
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinaryQuantizationFormat = void 0;
var constants_1 = require("./constants");
var optimizedScalarQuantizer_1 = require("./optimizedScalarQuantizer");
var binaryQuantizedScorer_1 = require("./binaryQuantizedScorer");
var vectorOperations_1 = require("./vectorOperations");
var types_1 = require("./types");
var minHeap_1 = require("./minHeap");
/**
 * 二值量化向量值实现
 */
var BinarizedByteVectorValuesImpl = /** @class */ (function () {
    function BinarizedByteVectorValuesImpl(vectors, unpackedVectors, corrections, centroid) {
        this.maxCacheSize = 10000;
        this.vectors = vectors;
        this.unpackedVectors = unpackedVectors;
        this.corrections = corrections;
        this.centroid = centroid;
        this.unpackedVectorCache = new Map();
    }
    BinarizedByteVectorValuesImpl.prototype.dimension = function () {
        return this.centroid.length;
    };
    BinarizedByteVectorValuesImpl.prototype.size = function () {
        return this.vectors.length;
    };
    BinarizedByteVectorValuesImpl.prototype.vectorValue = function (ord) {
        var vector = this.vectors[ord];
        if (!vector) {
            throw new Error("\u5411\u91CF\u7D22\u5F15 ".concat(ord, " \u4E0D\u5B58\u5728"));
        }
        return vector;
    };
    /**
     * 获取未打包的1位向量（用于4位查询）
     * 使用LRU缓存优化频繁访问的向量
     *
     * @param ord 向量序号
     * @returns 未打包的1位向量
     */
    BinarizedByteVectorValuesImpl.prototype.getUnpackedVector = function (ord) {
        // 检查缓存
        var cached = this.unpackedVectorCache.get(ord);
        if (cached) {
            return cached;
        }
        // 获取原始向量
        var vector = this.unpackedVectors[ord];
        if (!vector) {
            throw new Error("\u672A\u6253\u5305\u5411\u91CF\u7D22\u5F15 ".concat(ord, " \u4E0D\u5B58\u5728"));
        }
        // 创建副本以避免修改原始数据
        var vectorCopy = new Uint8Array(vector);
        // 添加到缓存
        this.unpackedVectorCache.set(ord, vectorCopy);
        // 如果缓存太大，移除最早的条目
        if (this.unpackedVectorCache.size > this.maxCacheSize) {
            var firstKey = this.unpackedVectorCache.keys().next().value;
            if (firstKey !== undefined) {
                this.unpackedVectorCache.delete(firstKey);
            }
        }
        return vectorCopy;
    };
    /**
     * 清除未打包向量缓存
     */
    BinarizedByteVectorValuesImpl.prototype.clearUnpackedVectorCache = function () {
        this.unpackedVectorCache.clear();
    };
    BinarizedByteVectorValuesImpl.prototype.getCorrectiveTerms = function (ord) {
        var correction = this.corrections[ord];
        if (!correction) {
            throw new Error("\u4FEE\u6B63\u9879\u7D22\u5F15 ".concat(ord, " \u4E0D\u5B58\u5728"));
        }
        return correction;
    };
    BinarizedByteVectorValuesImpl.prototype.getCentroidDP = function (queryVector) {
        if (queryVector) {
            // 动态计算查询向量与质心的点积
            return (0, vectorOperations_1.computeDotProduct)(queryVector, this.centroid);
        }
        else {
            // 如果没有提供查询向量，返回质心与自身的点积（用于兼容性）
            return (0, vectorOperations_1.computeDotProduct)(this.centroid, this.centroid);
        }
    };
    BinarizedByteVectorValuesImpl.prototype.getCentroid = function () {
        return this.centroid;
    };
    return BinarizedByteVectorValuesImpl;
}());
/**
 * 二值量化格式类
 * 实现完整的二值量化系统
 */
var BinaryQuantizationFormat = /** @class */ (function () {
    /**
     * 构造函数
     * @param config 二值量化配置
     */
    function BinaryQuantizationFormat(config) {
        // 验证配置参数
        if (config.queryBits !== undefined && (config.queryBits < 1 || config.queryBits > 8)) {
            throw new Error('queryBits必须在1-8之间');
        }
        if (config.indexBits !== undefined && (config.indexBits < 1 || config.indexBits > 8)) {
            throw new Error('indexBits必须在1-8之间');
        }
        this.config = __assign({ queryBits: constants_1.QUERY_BITS, indexBits: constants_1.INDEX_BITS }, config);
        this.quantizer = new optimizedScalarQuantizer_1.OptimizedScalarQuantizer(config.quantizer);
        this.scorer = new binaryQuantizedScorer_1.BinaryQuantizedScorer(config.quantizer.similarityFunction);
    }
    /**
     * 量化向量集合
     * @param vectors 原始向量集合
     * @returns 量化结果
     */
    BinaryQuantizationFormat.prototype.quantizeVectors = function (vectors) {
        if (vectors.length === 0) {
            throw new Error('向量集合不能为空');
        }
        // 标准化向量（如果使用余弦相似度）
        var processedVectors = this.config.quantizer.similarityFunction === types_1.VectorSimilarityFunction.COSINE
            ? vectors.map(function (vec) { return (0, vectorOperations_1.normalizeVector)(vec); })
            : vectors;
        var firstVector = processedVectors[0];
        if (!firstVector) {
            throw new Error('第一个向量不能为空');
        }
        var dimension = firstVector.length;
        // 检查所有向量维度是否一致
        for (var i = 1; i < processedVectors.length; i++) {
            var vector = processedVectors[i];
            if (!vector) {
                throw new Error("\u5411\u91CF ".concat(i, " \u4E0D\u80FD\u4E3A\u7A7A"));
            }
            if (vector.length !== dimension) {
                throw new Error("\u5411\u91CF ".concat(i, " \u7EF4\u5EA6 ").concat(vector.length, " \u4E0E\u7B2C\u4E00\u4E2A\u5411\u91CF\u7EF4\u5EA6 ").concat(dimension, " \u4E0D\u5339\u914D"));
            }
        }
        // 检查向量值是否有效
        for (var i = 0; i < processedVectors.length; i++) {
            var vector = processedVectors[i];
            if (vector) {
                for (var j = 0; j < vector.length; j++) {
                    var val = vector[j];
                    if (val !== undefined) {
                        if (isNaN(val)) {
                            throw new Error("\u5411\u91CF ".concat(i, " \u4F4D\u7F6E ").concat(j, " \u5305\u542BNaN\u503C"));
                        }
                        if (!isFinite(val)) {
                            throw new Error("\u5411\u91CF ".concat(i, " \u4F4D\u7F6E ").concat(j, " \u5305\u542BInfinity\u503C"));
                        }
                    }
                }
            }
        }
        // 1. 计算质心
        var centroid = (0, vectorOperations_1.computeCentroid)(processedVectors);
        // 2. 量化所有向量
        var quantizedVectors = [];
        var unpackedVectors = []; // 存储未打包的1位向量
        var corrections = [];
        for (var _i = 0, processedVectors_1 = processedVectors; _i < processedVectors_1.length; _i++) {
            var vector = processedVectors_1[_i];
            // 创建一个副本，因为 scalarQuantize 会修改传入的向量
            var vectorCopy = new Float32Array(vector);
            // 量化索引向量
            var quantizedVector = new Uint8Array(dimension);
            var correction = this.quantizer.scalarQuantize(vectorCopy, quantizedVector, this.config.indexBits, centroid);
            // 根据量化位数选择正确的处理方法
            var processedVector = void 0;
            if (this.config.indexBits === 1) {
                // 1位索引量化：使用二进制打包
                processedVector = new Uint8Array(Math.ceil(dimension / 8));
                optimizedScalarQuantizer_1.OptimizedScalarQuantizer.packAsBinary(quantizedVector, processedVector);
                // 保存未打包的1位向量（用于4位查询）
                unpackedVectors.push(new Uint8Array(quantizedVector));
            }
            else {
                // 其他位数：直接使用量化结果
                processedVector = quantizedVector;
                unpackedVectors.push(new Uint8Array(quantizedVector));
            }
            quantizedVectors.push(processedVector);
            corrections.push(correction);
        }
        // 3. 创建二值量化向量值对象
        var binarizedVectors = new BinarizedByteVectorValuesImpl(quantizedVectors, unpackedVectors, corrections, centroid);
        return {
            quantizedVectors: binarizedVectors,
            queryQuantizer: this.quantizer
        };
    };
    /**
     * 量化查询向量
     * @param queryVector 查询向量
     * @param centroid 质心向量
     * @returns 量化结果
     */
    BinaryQuantizationFormat.prototype.quantizeQueryVector = function (queryVector, centroid) {
        // 标准化查询向量（如果使用余弦相似度）
        var processedQueryVector = this.config.quantizer.similarityFunction === types_1.VectorSimilarityFunction.COSINE
            ? (0, vectorOperations_1.normalizeVector)(queryVector)
            : queryVector;
        var dimension = processedQueryVector.length;
        var queryVectorCopy = new Float32Array(processedQueryVector);
        // 量化查询向量
        var quantizedQuery = new Uint8Array(dimension);
        var queryCorrections = this.quantizer.scalarQuantize(queryVectorCopy, quantizedQuery, this.config.queryBits, centroid);
        return {
            quantizedQuery: quantizedQuery,
            queryCorrections: queryCorrections
        };
    };
    /**
     * 搜索最近邻
     * @param queryVector 查询向量
     * @param targetVectors 目标向量集合
     * @param k 返回的最近邻数量
     * @returns 最近邻结果
     */
    BinaryQuantizationFormat.prototype.searchNearestNeighbors = function (queryVector, targetVectors, k) {
        // 参数验证
        if (!queryVector) {
            throw new Error('查询向量不能为空');
        }
        if (!targetVectors) {
            throw new Error('目标向量集合不能为空');
        }
        if (k < 0) {
            throw new Error('k值不能为负数');
        }
        if (queryVector.length !== targetVectors.dimension()) {
            throw new Error('查询向量维度与目标向量维度不匹配');
        }
        // 如果k为0，直接返回空数组
        if (k === 0) {
            return [];
        }
        // 标准化查询向量（如果使用余弦相似度）
        var processedQueryVector = this.config.quantizer.similarityFunction === types_1.VectorSimilarityFunction.COSINE
            ? (0, vectorOperations_1.normalizeVector)(queryVector)
            : queryVector;
        var centroid = targetVectors.getCentroid();
        // 1. 量化查询向量
        var _a = this.quantizeQueryVector(processedQueryVector, centroid), quantizedQuery = _a.quantizedQuery, queryCorrections = _a.queryCorrections;
        // 2. 计算所有目标向量的分数
        var vectorCount = targetVectors.size();
        // 使用TypedArray存储分数，避免对象分配
        var scores = new Float32Array(vectorCount);
        var indices = new Int32Array(vectorCount);
        // 初始化索引数组
        for (var i = 0; i < vectorCount; i++) {
            indices[i] = i;
        }
        // 批量计算分数
        var batchSize = 1000;
        var _loop_1 = function (i) {
            var end = Math.min(i + batchSize, vectorCount);
            var batchIndices = Array.from({ length: end - i }, function (_, j) { return i + j; });
            var results = this_1.scorer.computeBatchQuantizedScores(quantizedQuery, queryCorrections, targetVectors, batchIndices, this_1.config.queryBits);
            for (var j = 0; j < results.length; j++) {
                var result = results[j];
                if (result) {
                    scores[i + j] = result.score;
                }
            }
        };
        var this_1 = this;
        for (var i = 0; i < vectorCount; i += batchSize) {
            _loop_1(i);
        }
        // 3. 使用最小堆找到前k个最大值
        var minHeap = new minHeap_1.MinHeap(function (a, b) { return a.score - b.score; });
        var k2 = Math.min(k, vectorCount);
        for (var i = 0; i < vectorCount; i++) {
            var currentScore = scores[i];
            if (currentScore !== undefined) {
                if (minHeap.size() < k2) { // 注意这里使用k2
                    minHeap.push({ score: currentScore, index: indices[i] });
                }
                else {
                    var peek = minHeap.peek();
                    if (peek && currentScore > peek.score) {
                        minHeap.pop();
                        minHeap.push({ score: currentScore, index: indices[i] });
                    }
                }
            }
        }
        // 4. 从堆中提取结果并按分数降序排列
        var topKResults = [];
        while (!minHeap.isEmpty()) {
            var item = minHeap.pop();
            if (item) {
                topKResults.push(item);
            }
        }
        topKResults.reverse(); // 堆弹出的是升序，所以需要反转为降序
        return topKResults;
    };
    /**
     * 计算量化精度
     * @param originalVectors 原始向量集合
     * @param queryVectors 查询向量集合
     * @returns 量化精度统计
     */
    BinaryQuantizationFormat.prototype.computeQuantizationAccuracy = function (originalVectors, queryVectors) {
        // 参数验证
        if (originalVectors.length === 0) {
            throw new Error('原始向量集合不能为空');
        }
        if (queryVectors.length === 0) {
            throw new Error('查询向量集合不能为空');
        }
        if (originalVectors.length !== queryVectors.length) {
            throw new Error('原始向量集合和查询向量集合长度不匹配');
        }
        // 1. 量化向量集合
        var quantizedVectors = this.quantizeVectors(originalVectors).quantizedVectors;
        // 2. 计算原始分数和量化分数
        var originalScores = [];
        var quantizedScores = [];
        for (var _i = 0, queryVectors_1 = queryVectors; _i < queryVectors_1.length; _i++) {
            var queryVector = queryVectors_1[_i];
            var centroid = quantizedVectors.getCentroid();
            var _a = this.quantizeQueryVector(queryVector, centroid), quantizedQuery = _a.quantizedQuery, queryCorrections = _a.queryCorrections;
            // 计算量化分数
            var quantizedResult = this.scorer.computeQuantizedScore(quantizedQuery, queryCorrections, quantizedVectors, 0, this.config.queryBits);
            quantizedScores.push(quantizedResult.score);
            // 计算原始分数
            var originalResult = this.scorer.computeOriginalScore(queryVector, originalVectors[0], this.config.quantizer.similarityFunction);
            originalScores.push(originalResult);
        }
        // 3. 计算精度统计
        return this.scorer.computeQuantizationAccuracy(originalScores, quantizedScores);
    };
    /**
     * 序列化向量数据
     * @param vectors 向量集合
     * @returns 序列化数据
     */
    BinaryQuantizationFormat.prototype.serializeVectorData = function (vectors) {
        var quantizedVectors = this.quantizeVectors(vectors).quantizedVectors;
        var centroid = quantizedVectors.getCentroid();
        // 1. 序列化向量数据
        var vectorData = [];
        var vectorCount = quantizedVectors.size();
        for (var i = 0; i < vectorCount; i++) {
            var binaryValues = quantizedVectors.vectorValue(i);
            var corrections = quantizedVectors.getCorrectiveTerms(i);
            // 打包二进制值
            var packedBinaryValues = new Uint8Array(Math.ceil(binaryValues.length / 8));
            optimizedScalarQuantizer_1.OptimizedScalarQuantizer.packAsBinary(binaryValues, packedBinaryValues);
            vectorData.push({
                binaryValues: packedBinaryValues,
                lowerInterval: corrections.lowerInterval,
                upperInterval: corrections.upperInterval,
                additionalCorrection: corrections.additionalCorrection,
                quantizedComponentSum: corrections.quantizedComponentSum
            });
        }
        // 2. 序列化元数据
        var metadata = {
            fieldNumber: 0,
            vectorEncodingOrdinal: 0,
            vectorSimilarityOrdinal: 0,
            dimensions: centroid.length,
            vectorDataOffset: 0,
            vectorDataLength: 0,
            vectorCount: vectorCount,
            centroid: centroid,
            centroidSquareMagnitude: (0, vectorOperations_1.computeDotProduct)(centroid, centroid)
        };
        return { vectorData: vectorData, metadata: metadata };
    };
    /**
     * 反序列化向量数据
     * @param vectorData 向量数据
     * @param metadata 元数据
     * @returns 反序列化结果
     */
    BinaryQuantizationFormat.prototype.deserializeVectorData = function (vectorData, metadata) {
        var quantizedVectors = [];
        var corrections = [];
        for (var _i = 0, vectorData_1 = vectorData; _i < vectorData_1.length; _i++) {
            var data = vectorData_1[_i];
            // 解包二进制值
            var unpackedBinaryValues = new Uint8Array(metadata.dimensions);
            this.unpackBinaryValues(data.binaryValues, unpackedBinaryValues);
            quantizedVectors.push(unpackedBinaryValues);
            corrections.push({
                lowerInterval: data.lowerInterval,
                upperInterval: data.upperInterval,
                additionalCorrection: data.additionalCorrection,
                quantizedComponentSum: data.quantizedComponentSum
            });
        }
        return new BinarizedByteVectorValuesImpl(quantizedVectors, quantizedVectors, // 在反序列化时，我们只有已打包的向量，所以重复使用
        corrections, metadata.centroid);
    };
    /**
     * 解包二进制值
     * @param packed 打包的二进制值
     * @param unpacked 解包后的二进制值
     */
    BinaryQuantizationFormat.prototype.unpackBinaryValues = function (packed, unpacked) {
        var unpackedIndex = 0;
        for (var i = 0; i < packed.length; i++) {
            var byte = packed[i];
            if (byte !== undefined) {
                for (var j = 7; j >= 0 && unpackedIndex < unpacked.length; j--) {
                    unpacked[unpackedIndex++] = (byte >> j) & 1;
                }
            }
        }
    };
    /**
     * 获取配置
     * @returns 二值量化配置
     */
    BinaryQuantizationFormat.prototype.getConfig = function () {
        return this.config;
    };
    /**
     * 获取量化器
     * @returns 优化的标量量化器
     */
    BinaryQuantizationFormat.prototype.getQuantizer = function () {
        return this.quantizer;
    };
    /**
     * 获取评分器
     * @returns 二值量化评分器
     */
    BinaryQuantizationFormat.prototype.getScorer = function () {
        return this.scorer;
    };
    return BinaryQuantizationFormat;
}());
exports.BinaryQuantizationFormat = BinaryQuantizationFormat;
