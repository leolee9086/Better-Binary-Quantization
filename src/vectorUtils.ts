/**
 * 向量工具函数
 * 提供向量创建和计算相关的工具函数
 */

/**
 * 计算向量幅度
 * @param vector 输入向量
 * @returns 向量幅度
 */
export function computeVectorMagnitude(vector: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    const v = vector[i];
    if (v !== undefined) {
      sum += v * v;
    }
  }
  return Math.sqrt(sum);
}

/**
 * 创建随机向量
 * @param dimension 向量维度
 * @param min 最小值
 * @param max 最大值
 * @returns 随机向量
 */
export function createRandomVector(dimension: number, min: number = -1, max: number = 1): Float32Array {
  const vector = new Float32Array(dimension);
  for (let i = 0; i < dimension; i++) {
    vector[i] = Math.random() * (max - min) + min;
  }
  return vector;
}

/**
 * 创建零向量
 * @param dimension 向量维度
 * @returns 零向量
 */
export function createZeroVector(dimension: number): Float32Array {
  return new Float32Array(dimension);
} 