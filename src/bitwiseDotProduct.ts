/**
 * 位运算点积计算函数
 * 实现4位-1位和1位-1位点积计算
 * 基于Lucene的二值量化实现
 */

import { bitCount } from './utils';

/**
 * 4位-1位点积计算
 * 计算4位量化的查询向量与1位量化的索引向量的点积
 * 
 * 严格按照Java原版实现
 * org.apache.lucene.internal.vectorization.DefaultVectorUtilSupport
 * int4BitDotProductImpl 方法
 * 
 * @param q 4位量化的查询向量（转置后的格式，4个位平面）
 * @param d 1位量化的索引向量
 * @returns 点积结果
 */
export function computeInt4BitDotProduct(q: Uint8Array, d: Uint8Array): number {
  // 修复：转置后的4bit查询向量长度应该是 Math.ceil(d.length / 8) * 4
  // 因为d是未打包的1bit索引向量，长度等于原始维度
  const expectedLength = Math.ceil(d.length / 8) * 4;
  if (q.length !== expectedLength) {
    throw new Error(`4位查询向量长度不正确，期望${expectedLength}，实际${q.length}`);
  }

  // 简化实现：直接处理转置后的4bit查询向量和1bit索引向量
  let ret = 0;
  const planeSize = Math.ceil(d.length / 8); // 每个位平面的大小
  
  // 分别计算4个位平面的点积
  for (let i = 0; i < 4; i++) {
    let subRet = 0;
    
    // 处理每个位平面
    for (let j = 0; j < planeSize; j++) {
      const qVal = q[i * planeSize + j];
      if (qVal !== undefined) {
        // 计算这个字节与对应索引向量的点积
        for (let k = 0; k < 8 && j * 8 + k < d.length; k++) {
          const dVal = d[j * 8 + k];
          if (dVal !== undefined) {
            // 检查对应位是否都为1
            if ((qVal & (1 << (7 - k))) && dVal) {
              subRet++;
            }
          }
        }
      }
    }
    
    // 将结果左移i位并累加
    ret += subRet << i;
  }
  return ret;
}

/**
 * 单比特-单比特点积计算
 * 用于单比特量化的向量点积计算
 * 
 * @param q 单比特量化的查询向量（打包后的格式）
 * @param d 单比特量化的索引向量（打包后的格式）
 * @returns 点积结果
 */
export function computeInt1BitDotProduct(q: Uint8Array, d: Uint8Array): number {
  if (q.length !== d.length) {
    throw new Error('单比特向量长度必须相同');
  }

  let ret = 0;
  
  // 逐字节计算位运算点积
  for (let i = 0; i < q.length; i++) {
    const qVal = q[i];
    const dVal = d[i];
    if (qVal !== undefined && dVal !== undefined) {
      // 计算位运算AND，然后统计1的个数
      const bitwiseAnd = (qVal & dVal) & 0xFF;
      ret += bitCount(bitwiseAnd);
    }
  }

  return ret;
}

/**
 * 优化的4位-1位点积计算
 * 使用查找表优化的版本，提高性能
 * 
 * @param q 4位量化的查询向量（转置后的格式，4个位平面）
 * @param d 1位量化的索引向量
 * @returns 点积结果
 */
export function computeInt4BitDotProductOptimized(q: Uint8Array, d: Uint8Array): number {
  if (q.length !== d.length * 4) {
    throw new Error('4位查询向量长度必须是1位索引向量长度的4倍');
  }

  let ret = 0;
  const size = d.length;
  
  // 分别计算4个位平面的点积 - 完全按照Lucene原始实现
  for (let i = 0; i < 4; i++) {
    let r = 0;
    let subRet = 0;
    
    // 处理整数边界对齐的部分
    const upperBound = d.length & -4; // Integer.BYTES = 4
    for (; r < upperBound; r += 4) {
      // 使用32位整数进行位运算
      const qInt = getBigEndianInt32(q, i * size + r);
      const dInt = getBigEndianInt32(d, r);
      const bitwiseAnd = qInt & dInt;
      subRet += bitCount(bitwiseAnd);
    }
    
    // 处理剩余的部分
    for (; r < d.length; r++) {
      const qVal = q[i * size + r];
      const dVal = d[r];
      if (qVal !== undefined && dVal !== undefined) {
        const bitwiseAnd = (qVal & dVal) & 0xFF;
        subRet += bitCount(bitwiseAnd);
      }
    }
    
    // 加权累加
    ret += subRet << i;
  }

  return ret;
}

/**
 * 4位查询-已打包1位索引点积计算
 * 计算4位量化的查询向量与已打包的1位量化索引向量的点积
 * 
 * @param q 4位量化的查询向量（转置后的格式，4个位平面）
 * @param d 已打包的1位量化的索引向量
 * @returns 点积结果
 */
export function computeInt4BitDotProductWithPackedIndex(q: Uint8Array, d: Uint8Array): number {
  // 验证输入：q应该是4个位平面，d应该是打包后的1位向量
  const dimension = d.length * 8; // 1个字节包含8位
  if (q.length !== dimension * 4) {
    throw new Error(`4位查询向量长度${q.length}与1位索引向量长度${d.length}不匹配，期望查询向量长度为${dimension * 4}`);
  }

  let ret = 0;
  const size = d.length;

  // 对每个位平面计算点积
  for (let i = 0; i < 4; i++) {
    let subRet = 0;
    
    // 处理每个字节
    for (let r = 0; r < size; r++) {
      const qByte = q[i * size + r];
      const dByte = d[r];
      
      if (qByte !== undefined && dByte !== undefined) {
        // 计算位与操作并统计1的个数
        const bitwiseAnd = qByte & dByte;
        const count = bitCount(bitwiseAnd);
        subRet += count;
      }
    }
    
    // 将结果左移i位并累加
    ret += subRet << i;
  }

  return ret;
}

/**
 * 从字节数组中读取32位整数（大端序）
 * 参考 Lucene 的 BitUtil.VH_NATIVE_INT.get 方法
 * @param array 字节数组
 * @param offset 偏移量
 * @returns 32位整数
 */
function getBigEndianInt32(array: Uint8Array, offset: number): number {
  if (offset + 3 >= array.length) {
    throw new Error('数组越界');
  }
  
  // 大端序读取32位整数
  const val0 = array[offset];
  const val1 = array[offset + 1];
  const val2 = array[offset + 2];
  const val3 = array[offset + 3];
  
  if (val0 === undefined || val1 === undefined || val2 === undefined || val3 === undefined) {
    throw new Error('数组访问越界');
  }
  
  return ((val0 & 0xFF) << 24) |
         ((val1 & 0xFF) << 16) |
         ((val2 & 0xFF) << 8) |
         (val3 & 0xFF);
} 