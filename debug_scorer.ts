import { BinaryQuantizationFormat } from './src/binaryQuantizationFormat';
import { VectorSimilarityFunction } from './src/types';
import { normalizeVector, computeCosineSimilarity } from './src/vectorOperations';

// 创建简单的测试向量
const vector1 = normalizeVector(new Float32Array([1, 0, 0, 0]));
const vector2 = normalizeVector(new Float32Array([0.9, 0.1, 0, 0]));
const vector3 = normalizeVector(new Float32Array([0, 1, 0, 0]));

const baseVectors = [vector1, vector2, vector3];
const queryVector = vector1; // Should be most similar to vector1

console.log('Base vectors:');
baseVectors.forEach((vec, i) => {
  console.log(`  Vector ${i}: [${vec.join(', ')}]`);
});

console.log('\nQuery vector:');
console.log(`  [${queryVector.join(', ')}]`);

// 计算真实余弦相似度
console.log('
True cosine similarities:');
baseVectors.forEach((vec, i) => {
  const similarity = computeCosineSimilarity(queryVector, vec);
  console.log(`  Vector ${i}: ${similarity.toFixed(4)}`);
});

// 使用二值量化
const format = new BinaryQuantizationFormat({
  queryBits: 4,
  indexBits: 1,
  quantizer: {
    similarityFunction: VectorSimilarityFunction.COSINE,
    lambda: 0.01,
    iters: 10
  }
});

const { quantizedVectors } = format.quantizeVectors(baseVectors);
const results = format.searchNearestNeighbors(queryVector, quantizedVectors, 3);

console.log('\nQuantized search results:');
results.forEach((result, i) => {
  console.log(`  ${i+1}. Index: ${result.index}, Score: ${result.score.toFixed(4)}`);
});