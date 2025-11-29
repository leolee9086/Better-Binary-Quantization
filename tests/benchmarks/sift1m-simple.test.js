"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var path_1 = require("path");
var siftDataLoader_1 = require("./siftDataLoader");
var index_1 = require("../../src/index");
(0, vitest_1.describe)('SIFT1M简单功能测试', function () {
    var datasetDir = (0, path_1.join)(__dirname, '../../dataset/sift1m');
    (0, vitest_1.it)('应该能正确量化和搜索', function () {
        var _a;
        // 加载少量数据进行测试
        var baseDataset = (0, siftDataLoader_1.loadSiftDataset)(datasetDir, 'base', 100);
        var queryData = (0, siftDataLoader_1.loadSiftQueries)(datasetDir, 10);
        console.log("\uD83D\uDCCA \u57FA\u7840\u5411\u91CF: ".concat(baseDataset.count, " \u4E2A ").concat(baseDataset.dimension, " \u7EF4"));
        console.log("\uD83D\uDCCA \u67E5\u8BE2\u5411\u91CF: ".concat(queryData.queries.length, " \u4E2A"));
        // 测试量化
        var vectors = baseDataset.vectors.map(function (v) { return v.values; });
        var quantizedResult = (0, index_1.quickQuantize)(vectors);
        console.log('📊 量化结果:', quantizedResult);
        // 测试搜索
        var queryVector = (_a = queryData.queries[0]) === null || _a === void 0 ? void 0 : _a.values;
        if (!queryVector) {
            throw new Error('查询向量为空');
        }
        var searchResult = (0, index_1.quickSearch)(queryVector, vectors, 5);
        console.log('📊 搜索结果:', searchResult);
        (0, vitest_1.expect)(quantizedResult).toBeDefined();
        (0, vitest_1.expect)(searchResult).toBeDefined();
        (0, vitest_1.expect)(searchResult.length).toBeGreaterThan(0);
    });
});
