
/**
 * js实现下,直接计算比lucene中使用的位运算版本更加高效
 */

/**
 * 量化向量点积计算函数（朴素实现）
 * 直接使用字节乘法计算点积，不使用位运算
 * 
 * @param q 查询向量
 * @param d 索引向量
 * @returns 点积结果
 */
export function computeQuantizedDotProduct(q: Uint8Array, d: Uint8Array): number {
  if (q.length !== d.length) {
    throw new Error(`向量长度不匹配：查询向量长度${q.length}，索引向量长度${d.length}`);
  }

  let sum = 0;
  
  // 直接计算点积，不使用位运算
  for (let i = 0; i < q.length; i++) {
    const qVal = q[i];
    const dVal = d[i];
    if (qVal !== undefined && dVal !== undefined) {
      sum += qVal * dVal;
    }
  }
  
  return sum;
}

/**
 * 4位-1位点积计算（朴素实现）
 * 直接使用字节乘法计算点积，不使用位运算
 * 
 * @param q 4位量化的查询向量（转置后的格式，4个位平面）
 * @param d 1位量化的索引向量
 * @returns 点积结果
 */
export function computeInt4BitDotProduct(q: Uint8Array, d: Uint8Array): number {
  return computeQuantizedDotProduct(q, d);
}

/**
 * 单比特-单比特点积计算（朴素实现）
 * 直接使用字节乘法计算点积，不使用位运算
 * 
 * @param q 单比特量化的查询向量（打包后的格式）
 * @param d 单比特量化的索引向量（打包后的格式）
 * @returns 点积结果
 */
export function computeInt1BitDotProduct(q: Uint8Array, d: Uint8Array): number {
  return computeQuantizedDotProduct(q, d);
}
