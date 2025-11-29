"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var recall_common_1 = require("./recall-common");
/**
 * @织: 全维度召回率测试
 * 本测试使用通用工具测试所有常见嵌入引擎维度的召回率
 * 包括：384d、768d、1024d、1536d
 * 测试配置：1位、4位、8位查询 + 超采样策略
 */
(0, vitest_1.describe)('全维度召回率测试', function () {
    // 为每个维度创建数据集
    var datasets = {};
    // 初始化所有数据集
    for (var _i = 0, _a = Object.entries(recall_common_1.RECALL_TEST_CONFIGS); _i < _a.length; _i++) {
        var _b = _a[_i], dimensionKey = _b[0], config = _b[1];
        datasets[dimensionKey] = (0, recall_common_1.createFixedDataset)(config);
    }
    var _loop_1 = function (dimensionKey, config) {
        var dataset = datasets[dimensionKey];
        if (!dataset)
            return "continue";
        var baseVectors = dataset.baseVectors, queryVectors = dataset.queryVectors;
        (0, vitest_1.describe)("".concat(dimensionKey, "\u7EF4\u5EA6\u6D4B\u8BD5"), function () {
            (0, vitest_1.it)('数据集验证', function () {
                var _a, _b;
                (0, vitest_1.expect)(baseVectors.length).toBe(config.baseSize);
                (0, vitest_1.expect)(queryVectors.length).toBe(config.querySize);
                (0, vitest_1.expect)((_a = baseVectors[0]) === null || _a === void 0 ? void 0 : _a.length).toBe(config.dimension);
                (0, vitest_1.expect)((_b = queryVectors[0]) === null || _b === void 0 ? void 0 : _b.length).toBe(config.dimension);
                // eslint-disable-next-line no-console
                console.log("".concat(dimensionKey, "\u6570\u636E\u96C6\u4FE1\u606F:"));
                // eslint-disable-next-line no-console
                console.log('- 维度:', config.dimension);
                // eslint-disable-next-line no-console
                console.log('- Base向量数量:', config.baseSize);
                // eslint-disable-next-line no-console
                console.log('- Query向量数量:', config.querySize);
            });
            (0, vitest_1.describe)('1位查询 + 1位索引', function () {
                (0, vitest_1.it)("1\u4F4D\u67E5\u8BE2\u7684 recall@".concat(config.k, " \u5E94\u5927\u4E8E ").concat(config.recallThreshold1bit), function () {
                    var avgRecall = (0, recall_common_1.executeRecallTest)(config, 1, // queryBits
                    1, // indexBits
                    baseVectors, queryVectors, "".concat(dimensionKey, "-1bit"));
                    (0, vitest_1.expect)(avgRecall).toBeGreaterThanOrEqual(config.recallThreshold1bit);
                });
            });
            (0, vitest_1.describe)('4位查询 + 1位索引', function () {
                (0, vitest_1.it)("4\u4F4D\u67E5\u8BE2\u7684 recall@".concat(config.k, " \u5E94\u5927\u4E8E ").concat(config.recallThreshold4bit), function () {
                    var avgRecall = (0, recall_common_1.executeRecallTest)(config, 4, // queryBits
                    1, // indexBits
                    baseVectors, queryVectors, "".concat(dimensionKey, "-4bit"));
                    (0, vitest_1.expect)(avgRecall).toBeGreaterThanOrEqual(config.recallThreshold4bit);
                });
            });
            (0, vitest_1.describe)('超采样4位查询', function () {
                (0, vitest_1.it)("\u8D85\u91C7\u68374\u4F4D\u67E5\u8BE2\u7684 recall@".concat(config.k, " \u5E94\u5927\u4E8E ").concat(config.recallThresholdOversample), function () {
                    var avgRecall = (0, recall_common_1.executeOversampledRecallTest)(config, baseVectors, queryVectors, "".concat(dimensionKey, "-oversample"));
                    (0, vitest_1.expect)(avgRecall).toBeGreaterThanOrEqual(config.recallThresholdOversample);
                });
            });
        });
    };
    // 测试每个维度
    for (var _c = 0, _d = Object.entries(recall_common_1.RECALL_TEST_CONFIGS); _c < _d.length; _c++) {
        var _e = _d[_c], dimensionKey = _e[0], config = _e[1];
        _loop_1(dimensionKey, config);
    }
    // 跨维度性能对比测试
    (0, vitest_1.describe)('跨维度性能对比', function () {
        (0, vitest_1.it)('不同维度的4位查询召回率对比', function () {
            var results = {};
            for (var _i = 0, _a = Object.entries(recall_common_1.RECALL_TEST_CONFIGS); _i < _a.length; _i++) {
                var _b = _a[_i], dimensionKey = _b[0], config = _b[1];
                var dataset = datasets[dimensionKey];
                if (!dataset)
                    continue;
                var baseVectors = dataset.baseVectors, queryVectors = dataset.queryVectors;
                var avgRecall = (0, recall_common_1.executeRecallTest)(config, 4, // queryBits
                1, // indexBits
                baseVectors, queryVectors, "".concat(dimensionKey, "-4bit-comparison"));
                results[dimensionKey] = avgRecall;
            }
            // eslint-disable-next-line no-console
            console.log('=== 跨维度4位查询召回率对比 ===');
            for (var _c = 0, _d = Object.entries(results); _c < _d.length; _c++) {
                var _e = _d[_c], dimensionKey = _e[0], recall = _e[1];
                // eslint-disable-next-line no-console
                console.log("".concat(dimensionKey, ": ").concat(recall.toFixed(3)));
            }
            // 验证召回率随维度增加而降低的趋势
            var dimensions = Object.keys(results).sort();
            for (var i = 1; i < dimensions.length; i++) {
                var prevDimension = dimensions[i - 1];
                var currDimension = dimensions[i];
                if (!prevDimension || !currDimension)
                    continue;
                var prevRecall = results[prevDimension];
                var currRecall = results[currDimension];
                if (prevRecall !== undefined && currRecall !== undefined) {
                    // 高维度召回率应该低于或等于低维度（考虑到随机性，允许相等）
                    (0, vitest_1.expect)(currRecall).toBeLessThanOrEqual(prevRecall + 0.1); // 允许10%的容差
                }
            }
        });
        (0, vitest_1.it)('不同维度的超采样召回率对比', function () {
            var results = {};
            for (var _i = 0, _a = Object.entries(recall_common_1.RECALL_TEST_CONFIGS); _i < _a.length; _i++) {
                var _b = _a[_i], dimensionKey = _b[0], config = _b[1];
                var dataset = datasets[dimensionKey];
                if (!dataset)
                    continue;
                var baseVectors = dataset.baseVectors, queryVectors = dataset.queryVectors;
                var avgRecall = (0, recall_common_1.executeOversampledRecallTest)(config, baseVectors, queryVectors, "".concat(dimensionKey, "-oversample-comparison"));
                results[dimensionKey] = avgRecall;
            }
            // eslint-disable-next-line no-console
            console.log('=== 跨维度超采样召回率对比 ===');
            for (var _c = 0, _d = Object.entries(results); _c < _d.length; _c++) {
                var _e = _d[_c], dimensionKey = _e[0], recall = _e[1];
                // eslint-disable-next-line no-console
                console.log("".concat(dimensionKey, ": ").concat(recall.toFixed(3)));
            }
            // 验证超采样能提高召回率
            for (var _f = 0, _g = Object.entries(recall_common_1.RECALL_TEST_CONFIGS); _f < _g.length; _f++) {
                var _h = _g[_f], dimensionKey = _h[0], config = _h[1];
                var dataset = datasets[dimensionKey];
                if (!dataset)
                    continue;
                var baseVectors = dataset.baseVectors, queryVectors = dataset.queryVectors;
                var normalRecall = (0, recall_common_1.executeRecallTest)(config, 4, // queryBits
                1, // indexBits
                baseVectors, queryVectors, "".concat(dimensionKey, "-4bit-vs-oversample"));
                var oversampledRecall = results[dimensionKey];
                // 超采样召回率应该大于等于普通4位查询
                (0, vitest_1.expect)(oversampledRecall).toBeGreaterThanOrEqual(normalRecall - 0.05); // 允许5%的容差
            }
        });
    });
});
