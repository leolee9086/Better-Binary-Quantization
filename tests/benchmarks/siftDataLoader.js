"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSiftVectors = loadSiftVectors;
exports.loadSiftDataset = loadSiftDataset;
exports.loadSiftQueries = loadSiftQueries;
var fs_1 = require("fs");
var path_1 = require("path");
/**
 * 从.fvecs文件读取SIFT向量数据
 * @param filePath - .fvecs文件路径
 * @param maxVectors - 最大读取向量数量，默认10000
 * @returns SIFT数据集
 */
function loadSiftVectors(filePath, maxVectors) {
    if (maxVectors === void 0) { maxVectors = 10000; }
    try {
        var buffer = (0, fs_1.readFileSync)(filePath);
        var dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        // 读取第一个向量的维度
        var dimension = dataView.getUint32(0, true); // 大端序
        // 计算向量数量：文件大小 / (维度 + 1) / 4
        var totalVectors = Math.floor(buffer.length / (dimension + 1) / 4);
        var vectorsToRead = Math.min(maxVectors, totalVectors);
        var vectors = [];
        for (var i = 0; i < vectorsToRead; i++) {
            var offset = i * (dimension + 1) * 4;
            // 读取向量维度（应该是相同的）
            var vecDimension = dataView.getUint32(offset, true);
            if (vecDimension !== dimension) {
                throw new Error("\u5411\u91CF\u7EF4\u5EA6\u4E0D\u4E00\u81F4: \u671F\u671B".concat(dimension, ", \u5B9E\u9645").concat(vecDimension));
            }
            // 读取向量值
            var values = new Float32Array(dimension);
            for (var j = 0; j < dimension; j++) {
                values[j] = dataView.getFloat32(offset + 4 + j * 4, true); // 大端序
            }
            vectors.push({
                dimension: vecDimension,
                values: values
            });
        }
        return {
            vectors: vectors,
            count: vectors.length,
            dimension: dimension
        };
    }
    catch (error) {
        throw new Error("\u8BFB\u53D6SIFT\u6570\u636E\u5931\u8D25: ".concat(error instanceof Error ? error.message : String(error)));
    }
}
/**
 * 从SIFT1M数据集目录加载指定数量的向量
 * @param datasetDir - 数据集目录路径
 * @param fileType - 文件类型 ('base', 'learn', 'query')
 * @param maxVectors - 最大读取向量数量，默认10000
 * @returns SIFT数据集
 */
function loadSiftDataset(datasetDir, fileType, maxVectors) {
    if (fileType === void 0) { fileType = 'base'; }
    if (maxVectors === void 0) { maxVectors = 10000; }
    var fileName = "sift_".concat(fileType, ".fvecs");
    var filePath = (0, path_1.join)(datasetDir, fileName);
    return loadSiftVectors(filePath, maxVectors);
}
/**
 * 从SIFT1M数据集加载查询向量和真实标签
 * @param datasetDir - 数据集目录路径
 * @param maxQueries - 最大查询数量，默认100
 * @returns 查询向量和真实标签
 */
function loadSiftQueries(datasetDir, maxQueries) {
    if (maxQueries === void 0) { maxQueries = 100; }
    // 加载查询向量
    var queryDataset = loadSiftDataset(datasetDir, 'query', maxQueries);
    // 加载真实标签
    var groundtruthPath = (0, path_1.join)(datasetDir, 'sift_groundtruth.ivecs');
    var buffer = (0, fs_1.readFileSync)(groundtruthPath);
    var dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    var k = dataView.getUint32(0, true); // 每个查询的邻居数量，大端序
    var groundtruth = [];
    for (var i = 0; i < Math.min(maxQueries, queryDataset.count); i++) {
        var offset = i * (k * 4 + 4);
        var neighbors = [];
        for (var j = 0; j < k; j++) {
            var neighborId = dataView.getUint32(offset + 4 + j * 4, true); // 大端序
            neighbors.push(neighborId);
        }
        groundtruth.push(neighbors);
    }
    return {
        queries: queryDataset.vectors,
        groundtruth: groundtruth
    };
}
