/**
 * 向量相似性计算函数
 * 实现各种向量相似性度量方法
 */



/**
 * 向量相似性计算
 * @param a 向量a
 * @param b 向量b
 * @param similarityFunction 相似性函数类型
 * @returns 相似性分数
 */
export function computeSimilarity(
  a: Float32Array,
  b: Float32Array,
  similarityFunction: 'EUCLIDEAN' | 'COSINE' | 'MAXIMUM_INNER_PRODUCT'
): number {
  switch (similarityFunction) {
    case 'EUCLIDEAN':
      return computeEuclideanSimilarity(a, b);
    case 'COSINE':
      return computeCosineSimilarity(a, b);
    case 'MAXIMUM_INNER_PRODUCT':
      return computeMaximumInnerProduct(a, b);
    default:
      throw new Error(`不支持的相似性函数: ${similarityFunction}`);
  }
}

/**
 * 计算欧几里得距离
 * @param a 向量a
 * @param b 向量b
 * @returns 欧几里得距离
 */
export function computeEuclideanDistance(a: Float32Array, b: Float32Array): number {
  if (!a || !b) {
    throw new Error('向量不能为空');
  }
  if (a.length !== b.length) {
    throw new Error('向量维度不匹配');
  }
  
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    if (av !== undefined && bv !== undefined) {
      const diff = av - bv;
      sum += diff * diff;
    }
  }
  return Math.sqrt(sum);
}

/**
 * 计算欧几里得相似性
 * @param a 向量a
 * @param b 向量b
 * @returns 欧几里得相似性分数
 */
export function computeEuclideanSimilarity(a: Float32Array, b: Float32Array): number {
  const distance = computeEuclideanDistance(a, b);
  return 1.0 / (1.0 + distance);
}

/**
 * 计算余弦相似性
 * @param a 向量a
 * @param b 向量b
 * @returns 余弦相似性分数
 */
export function computeCosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (!a || !b) {
    throw new Error('向量不能为空');
  }
  if (a.length !== b.length) {
    throw new Error('向量维度不匹配');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    if (av !== undefined && bv !== undefined) {
      dotProduct += av * bv;
      normA += av * av;
      normB += bv * bv;
    }
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 计算最大内积
 * @param a 向量a
 * @param b 向量b
 * @returns 最大内积
 */
export function computeMaximumInnerProduct(a: Float32Array, b: Float32Array): number {
  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    if (av !== undefined && bv !== undefined) {
      dotProduct += av * bv;
    }
  }
  return dotProduct;
} 