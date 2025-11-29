"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var binaryQuantizationFormat_1 = require("./src/binaryQuantizationFormat");
var types_1 = require("./src/types");
var vectorOperations_1 = require("./src/vectorOperations");
// 创建简单的测试向量
var vector1 = (0, vectorOperations_1.normalizeVector)(new Float32Array([1, 0, 0, 0]));
var vector2 = (0, vectorOperations_1.normalizeVector)(new Float32Array([0.9, 0.1, 0, 0]));
var vector3 = (0, vectorOperations_1.normalizeVector)(new Float32Array([0, 1, 0, 0]));
var baseVectors = [vector1, vector2, vector3];
var queryVector = vector1; // Should be most similar to vector1
console.log('Base vectors:');
baseVectors.forEach(function (vec, i) {
    console.log("  Vector ".concat(i, ": [").concat(vec.join(', '), "]"));
});
console.log('\nQuery vector:');
console.log("  [".concat(queryVector.join(', '), "]"));
// 计算真实余弦相似度
console.log(', True, cosine, similarities, ');, baseVectors.forEach(function (vec, i) {
    var similarity = (0, vectorOperations_1.computeCosineSimilarity)(queryVector, vec);
    console.log("  Vector ".concat(i, ": ").concat(similarity.toFixed(4)));
}));
// 使用二值量化
var format = new binaryQuantizationFormat_1.BinaryQuantizationFormat({
    queryBits: 4,
    indexBits: 1,
    quantizer: {
        similarityFunction: types_1.VectorSimilarityFunction.COSINE,
        lambda: 0.01,
        iters: 10
    }
});
var quantizedVectors = format.quantizeVectors(baseVectors).quantizedVectors;
var results = format.searchNearestNeighbors(queryVector, quantizedVectors, 3);
console.log('\nQuantized search results:');
results.forEach(function (result, i) {
    console.log("  ".concat(i + 1, ". Index: ").concat(result.index, ", Score: ").concat(result.score.toFixed(4)));
});
