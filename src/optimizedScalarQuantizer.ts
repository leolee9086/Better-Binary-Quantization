/**
 * 优化的标量量化器
 * 基于Lucene的二值量化实现
 * 实现了各向异性损失函数和坐标下降优化算法
 */

import type { 
  QuantizationResult, 
  QuantizerConfig 
} from './types';
import { VectorSimilarityFunction } from './types';
import { 
  DEFAULT_LAMBDA, 
  DEFAULT_ITERS, 
  MINIMUM_MSE_GRID,
  NUMERICAL_CONSTANTS 
} from './constants';
import { 
  computeL2Norm, 
  computeMean, 
  computeStd, 
  clamp, 
  isNearZero, 
  isNearEqual 
} from './utils';

/**
 * 优化的标量量化器类
 * 实现了基于各向异性损失函数的向量量化
 */
export class OptimizedScalarQuantizer {
  private readonly lambda: number;
  private readonly iters: number;
  private similarityFunction: VectorSimilarityFunction;

  /**
   * 构造函数
   * 初始化优化的标量量化器
   * 
   * 参考自 Lucene 9.9.0
   * org.apache.lucene.util.quantization.OptimizedScalarQuantizer
   * 构造函数（第80-92行）
   * 
   * @param config 量化器配置，包含lambda和iters参数
   */
  constructor(config: QuantizerConfig) {
    // 参考 Lucene 第80-92行：使用默认值或配置值
    this.lambda = config.lambda ?? DEFAULT_LAMBDA;
    this.iters = config.iters ?? DEFAULT_ITERS;
    this.similarityFunction = config.similarityFunction ?? VectorSimilarityFunction.EUCLIDEAN;
  }

  /**
   * 多标量量化
   * 支持对同一向量进行不同位数的量化
   * 
   * 参考自 Lucene 9.9.0
   * org.apache.lucene.util.quantization.OptimizedScalarQuantizer
   * multiScalarQuantize 方法（第119-186行）
   * 
   * @param vector 输入向量
   * @param destinations 目标量化数组
   * @param bits 位数数组
   * @param centroid 质心向量
   * @returns 量化结果数组
   */
  public multiScalarQuantize(
    vector: Float32Array,
    destinations: Uint8Array[],
    bits: number[],
    centroid: Float32Array
  ): QuantizationResult[] {
    // 输入验证
    if (destinations.length !== bits.length) {
      throw new Error('目标数组和位数数组长度不匹配');
    }

    // 参考 Lucene 第119-186行：对每个位数分别进行量化
    const results: QuantizationResult[] = [];
    for (let i = 0; i < destinations.length; i++) {
      const destination = destinations[i];
      const bit = bits[i];
      if (destination && bit !== undefined) {
        // 参考 Lucene 第147-186行：调用 scalarQuantize 进行单次量化
        
        const result = this.scalarQuantize(vector, destination, bit, centroid);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * 标量量化
   * 对单个向量进行标量量化
   * 
   * 参考自 Lucene 9.9.0
   * org.apache.lucene.util.quantization.OptimizedScalarQuantizer
   * scalarQuantize 方法（第187-248行）
   * 
   * @param vector 输入向量
   * @param destination 量化结果存储数组
   * @param bits 量化位数
   * @param centroid 质心向量
   * @returns 量化结果
   */
  public scalarQuantize(
    vector: Float32Array,
    destination: Uint8Array,
    bits: number,
    centroid: Float32Array
  ): QuantizationResult {
    // 创建向量的副本，避免修改原始向量
    const workingVector = new Float32Array(vector);

    // 输入验证
    if (!vector) {
      throw new Error('输入向量不能为空');
    }
    if (!destination) {
      throw new Error('目标数组不能为空');
    }
    if (!centroid) {
      throw new Error('质心向量不能为空');
    }
    if (vector.length !== centroid.length) {
      throw new Error('向量和质心维度不匹配');
    }
    if (destination.length !== vector.length) {
      throw new Error('目标数组长度与向量长度不匹配');
    }
    if (bits < 1 || bits > 8) {
      throw new Error('位数必须在1-8之间');
    }

    // 检查向量值是否有效
    for (let i = 0; i < vector.length; i++) {
      const val = vector[i];
      if (val !== undefined) {
        if (isNaN(val)) {
          throw new Error(`向量位置 ${i} 包含NaN值`);
        }
        if (!isFinite(val)) {
          throw new Error(`向量位置 ${i} 包含Infinity值`);
        }
      }
    }

    // 调试信息：输出向量数据的统计特性
    

    // 1. 先计算原始向量与质心的点积（用于非欧氏距离的additionalCorrection）
    // 严格按照Java原版实现：在质心中心化之前计算
    let centroidDot = 0;
    if (this.similarityFunction !== VectorSimilarityFunction.EUCLIDEAN) {
      for (let i = 0; i < vector.length; i++) {
        const vectorVal = vector[i];
        const centroidVal = centroid[i];
        if (vectorVal !== undefined && centroidVal !== undefined) {
          centroidDot += vectorVal * centroidVal;  // 使用原始向量！
        }
      }
    }

    // 2. 质心中心化 (in-place on the working vector)
    let min = Number.MAX_VALUE;
    let max = -Number.MAX_VALUE;
    for (let i = 0; i < vector.length; i++) {
      const vectorVal = vector[i];
      const centroidVal = centroid[i];
      if (vectorVal !== undefined && centroidVal !== undefined) {
        const centeredVal = vectorVal - centroidVal;
        workingVector[i] = centeredVal;  // 中心化到workingVector
        min = Math.min(min, centeredVal);
        max = Math.max(max, centeredVal);
      }
    }
    
    // 3. 计算统计信息（使用中心化后的向量）
    const vecMean = computeMean(workingVector);
    const vecStd = computeStd(workingVector, vecMean);
    const norm2 = computeL2Norm(workingVector);

    // 4. 获取初始间隔
    const initInterval = this.getInitialInterval(bits, vecStd, vecMean, min, max);
    
    // 5. 优化间隔
    this.optimizeIntervals(initInterval, workingVector, norm2, 1 << bits);

    // 6. 量化向量 and 计算 quantizedComponentSum
    const [a, b] = initInterval;
    const points = 1 << bits;
    const nSteps = points - 1;
    const step = nSteps > 0 ? (b - a) / nSteps : 0;
    const stepInv = step > 0 ? 1 / step : 0;
    let quantizedComponentSum = 0;

    for (let i = 0; i < workingVector.length; i++) {
      const xi = workingVector[i]!;
      const clamped = clamp(xi, a, b);
      
      // 修复：对于1bit量化，使用简单的二值化
      if (bits === 1) {
        // 1bit量化：使用阈值二值化
        const threshold = (a + b) / 2; // 使用区间中点作为阈值
        const quantizedValue = clamped >= threshold ? 1 : 0;
        destination[i] = quantizedValue;
        quantizedComponentSum += quantizedValue;
      } else {
        // 其他位数：使用原有的四舍五入方法
        const assignment = Math.round((clamped - a) * stepInv);
        destination[i] = Math.min(assignment, nSteps);
        quantizedComponentSum += assignment;
      }
    }

    // 7. 根据相似性函数类型设置正确的additionalCorrection
    const finalAdditionalCorrection = this.similarityFunction === VectorSimilarityFunction.EUCLIDEAN ? norm2 : centroidDot;

    return {
      lowerInterval: initInterval[0],
      upperInterval: initInterval[1],
      additionalCorrection: finalAdditionalCorrection,
      quantizedComponentSum: quantizedComponentSum
    };
  }

  

  /**
   * 获取初始量化区间
   * 基于最小均方误差网格计算初始量化区间
   * 
   * 参考自 Lucene 9.9.0
   * org.apache.lucene.util.quantization.OptimizedScalarQuantizer
   * multiScalarQuantize 方法（第146-155行）
   * scalarQuantize 方法（第217-218行）
   * 
   * @param bits 位数
   * @param std 标准差
   * @param vecMean 向量均值
   * @returns 初始间隔 [lower, upper]
   */
  private getInitialInterval(bits: number, std: number, vecMean: number, min: number, max: number): [number, number] {
    const grid = MINIMUM_MSE_GRID[bits - 1];
    if (!grid) {
      throw new Error(`未找到位数 ${bits} 对应的网格配置`);
    }
    
    const grid0 = grid[0];
    const grid1 = grid[1];
    if (grid0 === undefined || grid1 === undefined) {
      throw new Error(`网格配置不完整: ${grid}`);
    }
    
    // 参考 Lucene 第146-155行和第217-218行：
    // MINIMUM_MSE_GRID[bits-1][0] * vecStd + vecMean
    // MINIMUM_MSE_GRID[bits-1][1] * vecStd + vecMean
    // 并且使用 clamp 函数，与Java原版保持一致
    return [
      clamp(grid0 * std + vecMean, min, max),
      clamp(grid1 * std + vecMean, min, max)
    ];
  }

  /**
   * 优化间隔
   * 使用坐标下降法优化量化间隔，最小化量化损失
   * 
   * 参考自 Lucene 9.9.0
   * org.apache.lucene.util.quantization.OptimizedScalarQuantizer
   * optimizeIntervals 方法（第276-328行）
   * 
   * @param initInterval 初始间隔，优化后的间隔将存储在此
   * @param vector 原始向量
   * @param norm2 向量的平方范数
   * @param points 量化点数
   */
  private optimizeIntervals(
    initInterval: [number, number],
    vector: Float32Array,
    norm2: number,
    points: number
  ): void {
    // 参考 Lucene 第276-328行：坐标下降优化算法
    let initialLoss = this.computeLoss(vector, initInterval, points, norm2);
    // 参考 Lucene 第278行：scale = (1.0f - lambda) / norm2
    const lambda = this.lambda; // 确保正确获取lambda
    const iters = this.iters;   // 确保正确获取iters
    const scale = (1.0 - lambda) / norm2;
    
    if (!isFinite(scale)) {
      return;
    }
    
    for (let iter = 0; iter < iters; iter++) {
      const [a, b] = initInterval;
      const stepInv = (points - 1) / (b - a);

      let daa = 0, dab = 0, dbb = 0;
      let dax = 0, dbx = 0;

      // 参考 Lucene 第287-295行：计算网格点用于坐标下降
      for (let i = 0; i < vector.length; i++) {
        const xi = vector[i];
        if (xi !== undefined) {
          const clamped = clamp(xi, a, b);
          const k = Math.round((clamped - a) * stepInv);
          const s = k / (points - 1);

          // 参考 Lucene 第290-294行：累积二阶导数矩阵元素
          daa += (1.0 - s) * (1.0 - s);
          dab += (1.0 - s) * s;
          dbb += s * s;
          dax += xi * (1.0 - s);
          dbx += xi * s;
        }
      }

      // 参考 Lucene 第296-298行：构建线性方程组
      // 注意：这里使用scale而不是1.0/(points-1)
      const m0 = scale * dax * dax + lambda * daa;
      const m1 = scale * dax * dbx + lambda * dab;
      const m2 = scale * dbx * dbx + lambda * dbb;

      // 参考 Lucene 第299-302行：求解最优间隔
      const det = m0 * m2 - m1 * m1;
      if (isNearZero(det, NUMERICAL_CONSTANTS.MIN_DETERMINANT)) {
        return; // 行列式接近零，无法求解
      }

      const aOpt = (m2 * dax - m1 * dbx) / det;
      const bOpt = (m0 * dbx - m1 * dax) / det;

      // 参考 Lucene 第303-305行：检查收敛性
      if (isNearEqual(initInterval[0], aOpt) && isNearEqual(initInterval[1], bOpt)) {
        return; // 已收敛
      }

      // 参考 Lucene 第306-310行：检查损失是否改善
      const newLoss = this.computeLoss(vector, [aOpt, bOpt], points, norm2);

      if (newLoss > initialLoss) {
        return; // 损失增加，停止优化
      }

      // 参考 Lucene 第311-313行：更新间隔和损失
      initInterval[0] = aOpt;
      initInterval[1] = bOpt;
      initialLoss = newLoss; // 严格按照Java原版：更新initialLoss
    }
  }

  

  

  /**
   * 计算损失函数
   * 各向异性损失函数，考虑向量方向的量化误差
   * 
   * 参考自 Lucene 9.9.0
   * org.apache.lucene.util.quantization.OptimizedScalarQuantizer
   * loss 方法（第249-275行）
   * 
   * @param vector 向量
   * @param interval 间隔
   * @param points 量化点数
   * @param norm2 向量平方范数
   * @returns 损失值
   */
  private computeLoss(
    vector: Float32Array,
    interval: [number, number],
    points: number,
    norm2: number
  ): number {
    // 参考 Lucene 第249-275行：各向异性损失函数计算
    const [a, b] = interval;
    const step = (b - a) / (points - 1);
    const stepInv = 1.0 / step;
    const lambda = this.lambda; // 确保正确获取lambda
    let xe = 0.0;
    let e = 0.0;

    for (let i = 0; i < vector.length; i++) {
      const xi = vector[i];
      if (xi !== undefined) {
        // 参考 Lucene 第254行：量化然后反量化向量
        // xiq = (a + step * Math.round((clamp(xi, a, b) - a) * stepInv))
        const clamped = clamp(xi, a, b);
        const k = Math.round((clamped - a) * stepInv);
        const xiq = a + step * k;

        // 参考 Lucene 第256-257行：计算量化误差
        // xe += xi * (xi - xiq);  // 平行误差分量
        // e += (xi - xiq) * (xi - xiq);  // 总误差
        xe += xi * (xi - xiq);
        e += (xi - xiq) * (xi - xiq);
      }
    }

    // 参考 Lucene 第258行：各向异性损失函数
    // return (1.0 - lambda) * xe * xe / norm2 + lambda * e;
    return (1.0 - lambda) * xe * xe / norm2 + lambda * e;
  }

  /**
   * 二进制打包
   * 将1位量化的向量打包为紧凑的二进制格式
   * 
   * 参考自 Lucene 10.2
   * org.apache.lucene.util.quantization.OptimizedScalarQuantizer
   * packAsBinary 方法
   * 
   * @param vector 要打包的1位量化向量
   * @param packed 打包后的向量
   */
  public static packAsBinary(vector: Uint8Array, packed: Uint8Array): void {
    // 二进制打包算法
    for (let i = 0; i < vector.length; ) {
      let result = 0;
      
      // 每8位打包为一个字节
      for (let j = 7; j >= 0 && i < vector.length; j--) {
        const vectorVal = vector[i];
        if (vectorVal !== undefined) {
          // 确保1位量化值为0或1
          if (vectorVal !== 0 && vectorVal !== 1) {
            throw new Error('1位量化值必须为0或1');
          }
          // 打包位
          result |= (vectorVal & 1) << j;
        }
        i++;
      }
      
      // 计算索引并存储
      const index = Math.floor((i - 1) / 8);
      if (index >= packed.length) {
        throw new Error('打包数组长度不足');
      }
      packed[index] = result;
    }
  }

  /**
   * 离散化
   * 将值离散化到指定的桶大小
   * 
   * 参考自 Lucene 9.9.0
   * org.apache.lucene.util.quantization.OptimizedScalarQuantizer
   * discretize 方法（第329-331行）
   * 
   * @param value 要离散化的值
   * @param bucket 桶大小
   * @returns 离散化后的值
   */
  public static discretize(value: number, bucket: number): number {
    // 参考 Lucene 第329-331行：((value + (bucket - 1)) / bucket) * bucket
    return Math.floor((value + (bucket - 1)) / bucket) * bucket;
  }

  /**
   * 半字节转置
   * 将4位量化的查询向量转置为4个位平面，用于高效的位运算
   * 
   * 参考自 Lucene 10.2
   * org.apache.lucene.util.quantization.OptimizedScalarQuantizer
   * transposeHalfByte 方法
   * 
   * @param q 4位量化的查询向量，值在0-15之间
   * @param quantQueryByte 转置后的字节数组，长度为q.length * 4
   */
  public static transposeHalfByte(q: Uint8Array, quantQueryByte: Uint8Array): void {
    // 输入验证
    if (!q || !quantQueryByte) {
      throw new Error('输入数组不能为空');
    }
    
    // 修复：根据Java实现，输出数组长度应该是 q.length * 4
    const expectedLength = q.length * 4;
    if (quantQueryByte.length !== expectedLength) {
      throw new Error(`转置数组长度不正确，期望${expectedLength}，实际${quantQueryByte.length}`);
    }

    // 清空输出数组
    quantQueryByte.fill(0);
    
        // 严格按照Lucene原版实现
    // 每个4位值需要4个位平面，每个位平面的大小等于原始向量长度
    const planeSize = q.length;
    
    for (let i = 0; i < q.length; i++) {
      const qVal = q[i];
      if (qVal === undefined || qVal < 0 || qVal > 15) {
        throw new Error('4位量化值必须在0-15之间');
      }
      
      // 将4位值分解为4个位平面
      // 每个位只存储0或1，不需要左移7位
      const bit0 = (qVal & 1);        // 最低位
      const bit1 = ((qVal >> 1) & 1); // 次低位
      const bit2 = ((qVal >> 2) & 1); // 次高位
      const bit3 = ((qVal >> 3) & 1); // 最高位
      
      // 存储到对应的位平面
      quantQueryByte[i] = bit0;                    // 第0个位平面
      quantQueryByte[i + planeSize] = bit1;        // 第1个位平面
      quantQueryByte[i + planeSize * 2] = bit2;    // 第2个位平面
      quantQueryByte[i + planeSize * 3] = bit3;    // 第3个位平面
    }
    }

  /**
   * 优化的半字节转置（带缓存）
   * 将4位量化的查询向量转置为4个位平面，使用缓存机制提高性能
   * 
   * 参考自 Lucene 10.2
   * org.apache.lucene.util.quantization.OptimizedScalarQuantizer
   * transposeHalfByte 方法
   * 
   * @param q 4位量化的查询向量，值在0-15之间
   * @param quantQueryByte 转置后的字节数组，长度为 Math.ceil(q.length / 8) * 4
   * @param useCache 是否使用缓存（默认true）
   */
  public static transposeHalfByteOptimized(
    q: Uint8Array, 
    quantQueryByte: Uint8Array, 
    useCache: boolean = true
  ): void {
    // 直接使用数组作为键，无需字符串转换
    if (useCache) {
      const cached = OptimizedScalarQuantizer.transposeCache.get(q);
      if (cached) {
        OptimizedScalarQuantizer.cacheStats.hits++;
        quantQueryByte.set(cached);
        return;
      }
      OptimizedScalarQuantizer.cacheStats.misses++;
    }

    // 执行转置操作
    OptimizedScalarQuantizer.transposeHalfByte(q, quantQueryByte);
    
    // 缓存结果 - WeakMap 会自动处理内存管理
    if (useCache) {
      const cached = new Uint8Array(quantQueryByte);
      OptimizedScalarQuantizer.transposeCache.set(q, cached);
    }
  }

  /**
   * 高性能半字节转置（无验证版本）
   * 用于已知输入有效的场景，跳过所有验证以提高性能
   * 
   * @param q 4位量化的查询向量，值在0-15之间
   * @param quantQueryByte 转置后的字节数组，长度为 Math.ceil(q.length / 8) * 4
   */
  public static transposeHalfByteFast(q: Uint8Array, quantQueryByte: Uint8Array): void {
    // 清空输出数组
    quantQueryByte.fill(0);
    
    // 高性能实现，跳过所有验证
    let i = 0;
    const qLength = q.length;
    const quantLength = quantQueryByte.length;
    const planeSize = quantLength / 4;
    
    while (i < qLength) {
      let lowerByte = 0;
      let lowerMiddleByte = 0;
      let upperMiddleByte = 0;
      let upperByte = 0;
      
      // 处理8个4位值（或剩余的4位值）
      for (let j = 7; j >= 0 && i < qLength; j--) {
        const currentQVal = q[i]!;
        lowerByte |= (currentQVal & 1) << j;
        lowerMiddleByte |= ((currentQVal >> 1) & 1) << j;
        upperMiddleByte |= ((currentQVal >> 2) & 1) << j;
        upperByte |= ((currentQVal >> 3) & 1) << j;
        i++;
      }
      
      // 计算索引并存储到对应的位平面
      const index = Math.floor((i + 7) / 8) - 1;
      quantQueryByte[index] = lowerByte;
      quantQueryByte[index + planeSize] = lowerMiddleByte;
      quantQueryByte[index + 2 * planeSize] = upperMiddleByte;
      quantQueryByte[index + 3 * planeSize] = upperByte;
    }
  }



  /**
   * 转置缓存
   * 存储已计算的转置结果，使用 WeakMap 避免内存泄漏
   */
  private static transposeCache = new WeakMap<Uint8Array, Uint8Array>();
  private static cacheStats = { hits: 0, misses: 0 };

  /**
   * 清除转置缓存
   * WeakMap 无法直接清除，但可以通过重新创建来清空
   */
  public static clearTransposeCache(): void {
    OptimizedScalarQuantizer.transposeCache = new WeakMap();
    OptimizedScalarQuantizer.cacheStats = { hits: 0, misses: 0 };
  }

  /**
   * 获取转置缓存统计信息
   * 
   * @returns 缓存统计信息
   */
  public static getTransposeCacheStats(): { size: number; hitRate: number } {
    const total = OptimizedScalarQuantizer.cacheStats.hits + OptimizedScalarQuantizer.cacheStats.misses;
    const hitRate = total > 0 ? OptimizedScalarQuantizer.cacheStats.hits / total : 0;
    return {
      size: 0, // WeakMap 无法获取 size
      hitRate
    };
  }
} 