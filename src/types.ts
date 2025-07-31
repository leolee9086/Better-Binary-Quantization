/**
 * 二值量化系统的类型定义
 * 基于Lucene的二值量化实现
 */

/**
 * 向量相似性函数类型
 */
export enum VectorSimilarityFunction {
  EUCLIDEAN = 'EUCLIDEAN',
  COSINE = 'COSINE',
  MAXIMUM_INNER_PRODUCT = 'MAXIMUM_INNER_PRODUCT'
}

/**
 * 量化结果记录
 */
export interface QuantizationResult {
  /** 下界间隔 */
  lowerInterval: number;
  /** 上界间隔 */
  upperInterval: number;
  /** 附加修正因子 */
  additionalCorrection: number;
  /** 量化分量之和 */
  quantizedComponentSum: number;
}

/**
 * 二值量化向量值接口
 */
export interface BinarizedByteVectorValues {
  /** 向量维度 */
  dimension(): number;
  /** 获取向量值 */
  vectorValue(ord: number): Uint8Array;
  /** 获取未打包的1位向量（用于4位查询） */
  getUnpackedVector(ord: number): Uint8Array;
  /** 获取修正项 */
  getCorrectiveTerms(ord: number): QuantizationResult;
  /** 获取质心点积 */
  getCentroidDP(queryVector?: Float32Array): number;
  /** 获取质心向量 */
  getCentroid(): Float32Array;
  /** 获取向量数量 */
  size(): number;
  /** 清除未打包向量缓存 */
  clearUnpackedVectorCache?(): void;
}

/**
 * 量化器配置
 */
export interface QuantizerConfig {
  /** 相似性函数 */
  similarityFunction: VectorSimilarityFunction;
  /** 各向异性权重 (默认0.1) */
  lambda?: number;
  /** 优化迭代次数 (默认5) */
  iters?: number;
}

/**
 * 二值量化格式配置
 */
export interface BinaryQuantizationConfig {
  /** 查询向量位数 (默认4) */
  queryBits?: number;
  /** 索引向量位数 (默认1) */
  indexBits?: number;
  /** 量化器配置 */
  quantizer: QuantizerConfig;
}

/**
 * 向量数据文件格式
 */
export interface VectorDataFormat {
  /** 二进制量化值 */
  binaryValues: Uint8Array;
  /** 下界间隔 */
  lowerInterval: number;
  /** 上界间隔 */
  upperInterval: number;
  /** 附加修正因子 */
  additionalCorrection: number;
  /** 量化分量之和 */
  quantizedComponentSum: number;
}

/**
 * 元数据文件格式
 */
export interface MetadataFormat {
  /** 字段号 */
  fieldNumber: number;
  /** 向量编码序号 */
  vectorEncodingOrdinal: number;
  /** 向量相似性序号 */
  vectorSimilarityOrdinal: number;
  /** 向量维度 */
  dimensions: number;
  /** 向量数据偏移 */
  vectorDataOffset: number;
  /** 向量数据长度 */
  vectorDataLength: number;
  /** 向量数量 */
  vectorCount: number;
  /** 质心向量 */
  centroid: Float32Array;
  /** 质心平方幅度 */
  centroidSquareMagnitude: number;
}

/**
 * 量化评分结果
 */
export interface QuantizedScoreResult {
  /** 相似性分数 */
  score: number;
  /** 位运算点积 */
  bitDotProduct: number;
  /** 修正因子 */
  corrections: {
    query: QuantizationResult;
    index: QuantizationResult;
  };
} 