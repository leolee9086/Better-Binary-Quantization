/**
 * 基础向量操作函数
 * 实现向量的基本数学运算
 */

/**
 * 向量归一化
 * @param vector 输入向量
 * @returns 归一化后的向量
 */
export function normalizeVector(vector: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) {
    const v = vector[i];
    if (v !== undefined) {
      norm += v * v;
    }
  }
  norm = Math.sqrt(norm);

  if (norm === 0) {
    return new Float32Array(vector.length);
  }

  const normalized = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    const v = vector[i];
    if (v !== undefined) {
      normalized[i] = v / norm;
    }
  }

  return normalized;
}

/**
 * 向量加法
 * @param a 向量a
 * @param b 向量b
 * @returns 结果向量
 */
export function addVectors(a: Float32Array, b: Float32Array): Float32Array {
  if (a.length !== b.length) {
    throw new Error('向量维度不匹配');
  }

  const result = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    if (av !== undefined && bv !== undefined) {
      result[i] = av + bv;
    }
  }
  return result;
}

/**
 * 向量减法
 * @param a 向量a
 * @param b 向量b
 * @returns 结果向量
 */
export function subtractVectors(a: Float32Array, b: Float32Array): Float32Array {
  if (a.length !== b.length) {
    throw new Error('向量维度不匹配');
  }

  const result = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    if (av !== undefined && bv !== undefined) {
      result[i] = av - bv;
    }
  }
  return result;
}

/**
 * 向量标量乘法
 * @param vector 向量
 * @param scalar 标量
 * @returns 结果向量
 */
export function scaleVector(vector: Float32Array, scalar: number): Float32Array {
  const result = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    const v = vector[i];
    if (v !== undefined) {
      result[i] = v * scalar;
    }
  }
  return result;
}

/**
 * 向量中心化
 * @param vector 输入向量
 * @param centroid 质心向量
 * @returns 中心化后的向量
 */
export function centerVector(vector: Float32Array, centroid: Float32Array): Float32Array {
  if (vector.length !== centroid.length) {
    throw new Error('向量和质心维度不匹配');
  }

  const centered = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    const v = vector[i];
    const c = centroid[i];
    if (v !== undefined && c !== undefined) {
      centered[i] = v - c;
    }
  }

  return centered;
}

/**
 * 计算向量集合的质心 - 优化版本
 * 交换循环顺序以改善缓存局部性
 * @param vectors 向量集合
 * @returns 质心向量
 */
export function computeCentroid(vectors: Float32Array[]): Float32Array {
  if (vectors.length === 0) {
    throw new Error('向量集合不能为空');
  }

  const firstVector = vectors[0];
  if (!firstVector) {
    throw new Error('第一个向量不能为空');
  }
  const dimension = firstVector.length;
  const centroid = new Float32Array(dimension);

  // 初始化质心为第一个向量
  for (let i = 0; i < dimension; i++) {
    centroid[i] = vectors[0]![i] ?? 0;
  }

  // 从第二个向量开始累加
  for (let j = 1; j < vectors.length; j++) {
    const vector = vectors[j];
    if (vector) {
      for (let i = 0; i < dimension; i++) {
        const val = vector[i];
        if (val !== undefined) {
          centroid[i]! += val;
        }
      }
    }
  }

  // 除以向量数量
  const numVectors = vectors.length;
  for (let i = 0; i < dimension; i++) {
    centroid[i]! /= numVectors;
  }

  return centroid;
}

/**
 * 计算两个向量的点积
 * @param a 向量a
 * @param b 向量b
 * @returns 点积
 */
export function computeDotProduct(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error('向量维度不匹配');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    if (av !== undefined && bv !== undefined) {
      sum += av * bv;
    }
  }
  return sum;
}


/**
 * 复制向量
 * @param vector 源向量
 * @returns 复制的向量
 */
export function copyVector(vector: Float32Array): Float32Array {
  return new Float32Array(vector);
} 