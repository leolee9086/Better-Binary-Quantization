/**
 * 二值量化格式类
 * 实现完整的二值量化系统
 * 基于Lucene的二值量化实现
 */

import type { 
  QuantizationResult, 
  BinaryQuantizationConfig,
  BinarizedByteVectorValues,
  VectorDataFormat,
  MetadataFormat
} from './types';
import { QUERY_BITS, INDEX_BITS } from './constants';
import { OptimizedScalarQuantizer } from './optimizedScalarQuantizer';
import { BinaryQuantizedScorer } from './binaryQuantizedScorer';
import { computeDotProduct, computeCentroid, normalizeVector } from './vectorOperations';
import { VectorSimilarityFunction } from './types';
import { MinHeap } from './minHeap';

/**
 * 二值量化向量值实现
 */
class BinarizedByteVectorValuesImpl implements BinarizedByteVectorValues {
  private readonly vectors: Uint8Array[];
  private readonly unpackedVectors: Uint8Array[]; // 存储未打包的1位向量
  private readonly corrections: QuantizationResult[];
  private readonly centroid: Float32Array;
  private readonly unpackedVectorCache: Map<number, Uint8Array>;
  private readonly maxCacheSize: number = 10000;

  constructor(
    vectors: Uint8Array[],
    unpackedVectors: Uint8Array[],
    corrections: QuantizationResult[],
    centroid: Float32Array
  ) {
    this.vectors = vectors;
    this.unpackedVectors = unpackedVectors;
    this.corrections = corrections;
    this.centroid = centroid;
    this.unpackedVectorCache = new Map();
  }

  dimension(): number {
    return this.centroid.length;
  }

  size(): number {
    return this.vectors.length;
  }

  vectorValue(ord: number): Uint8Array {
    const vector = this.vectors[ord];
    if (!vector) {
      throw new Error(`向量索引 ${ord} 不存在`);
    }
    return vector;
  }

  /**
   * 获取未打包的1位向量（用于4位查询）
   * 使用LRU缓存优化频繁访问的向量
   * 
   * @param ord 向量序号
   * @returns 未打包的1位向量
   */
  getUnpackedVector(ord: number): Uint8Array {
    // 检查缓存
    const cached = this.unpackedVectorCache.get(ord);
    if (cached) {
      return cached;
    }

    // 获取原始向量
    const vector = this.unpackedVectors[ord];
    if (!vector) {
      throw new Error(`未打包向量索引 ${ord} 不存在`);
    }

    // 创建副本以避免修改原始数据
    const vectorCopy = new Uint8Array(vector);

    // 添加到缓存
    this.unpackedVectorCache.set(ord, vectorCopy);

    // 如果缓存太大，移除最早的条目
    if (this.unpackedVectorCache.size > this.maxCacheSize) {
      const firstKey = this.unpackedVectorCache.keys().next().value;
      if (firstKey !== undefined) {
        this.unpackedVectorCache.delete(firstKey);
      }
    }

    return vectorCopy;
  }

  /**
   * 清除未打包向量缓存
   */
  public clearUnpackedVectorCache(): void {
    this.unpackedVectorCache.clear();
  }

  getCorrectiveTerms(ord: number): QuantizationResult {
    const correction = this.corrections[ord];
    if (!correction) {
      throw new Error(`修正项索引 ${ord} 不存在`);
    }
    return correction;
  }

  getCentroidDP(queryVector?: Float32Array): number {
    if (queryVector) {
      // 动态计算查询向量与质心的点积
      return computeDotProduct(queryVector, this.centroid);
    } else {
      // 如果没有提供查询向量，返回质心与自身的点积（用于兼容性）
      return computeDotProduct(this.centroid, this.centroid);
    }
  }

  getCentroid(): Float32Array {
    return this.centroid;
  }
}

/**
 * 二值量化格式类
 * 实现完整的二值量化系统
 */
export class BinaryQuantizationFormat {
  private readonly config: BinaryQuantizationConfig;
  private readonly quantizer: OptimizedScalarQuantizer;
  private readonly scorer: BinaryQuantizedScorer;

  /**
   * 构造函数
   * @param config 二值量化配置
   */
  constructor(config: BinaryQuantizationConfig) {
    // 验证配置参数
    if (config.queryBits !== undefined && (config.queryBits < 1 || config.queryBits > 8)) {
      throw new Error('queryBits必须在1-8之间');
    }
    if (config.indexBits !== undefined && (config.indexBits < 1 || config.indexBits > 8)) {
      throw new Error('indexBits必须在1-8之间');
    }

    this.config = {
      queryBits: QUERY_BITS,
      indexBits: INDEX_BITS,
      ...config
    };

    this.quantizer = new OptimizedScalarQuantizer(config.quantizer);
    this.scorer = new BinaryQuantizedScorer(config.quantizer.similarityFunction);
  }

  /**
   * 量化向量集合
   * @param vectors 原始向量集合
   * @returns 量化结果
   */
  public quantizeVectors(vectors: Float32Array[]): {
    quantizedVectors: BinarizedByteVectorValues;
    queryQuantizer: OptimizedScalarQuantizer;
  } {
    if (vectors.length === 0) {
      throw new Error('向量集合不能为空');
    }

    // 标准化向量（如果使用余弦相似度）
    const processedVectors = this.config.quantizer.similarityFunction === VectorSimilarityFunction.COSINE
      ? vectors.map(vec => normalizeVector(vec))
      : vectors;

    const firstVector = processedVectors[0];
    if (!firstVector) {
      throw new Error('第一个向量不能为空');
    }
    const dimension = firstVector.length;

    // 检查所有向量维度是否一致
    for (let i = 1; i < processedVectors.length; i++) {
      const vector = processedVectors[i];
      if (!vector) {
        throw new Error(`向量 ${i} 不能为空`);
      }
      if (vector.length !== dimension) {
        throw new Error(`向量 ${i} 维度 ${vector.length} 与第一个向量维度 ${dimension} 不匹配`);
      }
    }

    // 检查向量值是否有效
    for (let i = 0; i < processedVectors.length; i++) {
      const vector = processedVectors[i];
      if (vector) {
        for (let j = 0; j < vector.length; j++) {
          const val = vector[j];
          if (val !== undefined) {
            if (isNaN(val)) {
              throw new Error(`向量 ${i} 位置 ${j} 包含NaN值`);
            }
            if (!isFinite(val)) {
              throw new Error(`向量 ${i} 位置 ${j} 包含Infinity值`);
            }
          }
        }
      }
    }

    // 1. 计算质心
    const centroid = computeCentroid(processedVectors);

    // 2. 量化所有向量
    const quantizedVectors: Uint8Array[] = [];
    const unpackedVectors: Uint8Array[] = []; // 存储未打包的1位向量
    const corrections: QuantizationResult[] = [];

    for (const vector of processedVectors) {
      // 创建一个副本，因为 scalarQuantize 会修改传入的向量
      const vectorCopy = new Float32Array(vector);
      // 量化索引向量
      const quantizedVector = new Uint8Array(dimension);
      const correction = this.quantizer.scalarQuantize(
        vectorCopy,
        quantizedVector,
        this.config.indexBits!,
        centroid
      );

      // 根据量化位数选择正确的处理方法
      let processedVector: Uint8Array;
      if (this.config.indexBits === 1) {
        // 1位索引量化：使用二进制打包
        processedVector = new Uint8Array(Math.ceil(dimension / 8));
        OptimizedScalarQuantizer.packAsBinary(quantizedVector, processedVector);
        // 保存未打包的1位向量（用于4位查询）
        unpackedVectors.push(new Uint8Array(quantizedVector));
      } else {
        // 其他位数：直接使用量化结果
        processedVector = quantizedVector;
        unpackedVectors.push(new Uint8Array(quantizedVector));
      }

      quantizedVectors.push(processedVector);
      corrections.push(correction);
    }

    // 3. 创建二值量化向量值对象
    const binarizedVectors = new BinarizedByteVectorValuesImpl(
      quantizedVectors,
      unpackedVectors,
      corrections,
      centroid
    );

    return {
      quantizedVectors: binarizedVectors,
      queryQuantizer: this.quantizer
    };
  }

  /** 
   * 量化查询向量
   * @param queryVector 查询向量
   * @param centroid 质心向量
   * @returns 量化结果
   */
  public quantizeQueryVector(
    queryVector: Float32Array,
    centroid: Float32Array
  ): {
    quantizedQuery: Uint8Array;
    queryCorrections: QuantizationResult;
  } {
    // 标准化查询向量（如果使用余弦相似度）
    const processedQueryVector = this.config.quantizer.similarityFunction === VectorSimilarityFunction.COSINE
      ? normalizeVector(queryVector)
      : queryVector;
      
    const dimension = processedQueryVector.length;
    const queryVectorCopy = new Float32Array(processedQueryVector);

    // 量化查询向量
    const quantizedQuery = new Uint8Array(dimension);
    const queryCorrections = this.quantizer.scalarQuantize(
      queryVectorCopy,
      quantizedQuery,
      this.config.queryBits!,
      centroid
    );

    return {
      quantizedQuery,
      queryCorrections
    };
  }

  /**
   * 搜索最近邻
   * @param queryVector 查询向量
   * @param targetVectors 目标向量集合
   * @param k 返回的最近邻数量
   * @returns 最近邻结果
   */
  public searchNearestNeighbors(
    queryVector: Float32Array,
    targetVectors: BinarizedByteVectorValues,
    k: number
  ): Array<{
    index: number;
    score: number;
    originalScore?: number;
  }> {
    // 参数验证
    if (!queryVector) {
      throw new Error('查询向量不能为空');
    }
    if (!targetVectors) {
      throw new Error('目标向量集合不能为空');
    }
    if (k < 0) {
      throw new Error('k值不能为负数');
    }
    if (queryVector.length !== targetVectors.dimension()) {
      throw new Error('查询向量维度与目标向量维度不匹配');
    }

    // 如果k为0，直接返回空数组
    if (k === 0) {
      return [];
    }

    // 标准化查询向量（如果使用余弦相似度）
    const processedQueryVector = this.config.quantizer.similarityFunction === VectorSimilarityFunction.COSINE
      ? normalizeVector(queryVector)
      : queryVector;

    const centroid = targetVectors.getCentroid();

    // 1. 量化查询向量
    const { quantizedQuery, queryCorrections } = this.quantizeQueryVector(
      processedQueryVector,
      centroid
    );

    // 2. 计算所有目标向量的分数
    const vectorCount = targetVectors.size();
    
    // 使用TypedArray存储分数，避免对象分配
    const scores = new Float32Array(vectorCount);
    const indices = new Int32Array(vectorCount);

    // 初始化索引数组
    for (let i = 0; i < vectorCount; i++) {
      indices[i] = i;
    }

    // 批量计算分数
    const batchSize = 1000;
    for (let i = 0; i < vectorCount; i += batchSize) {
      const end = Math.min(i + batchSize, vectorCount);
      const batchIndices = Array.from({ length: end - i }, (_, j) => i + j);
      
      const results = this.scorer.computeBatchQuantizedScores(
        quantizedQuery,
        queryCorrections,
        targetVectors,
        batchIndices,
        this.config.queryBits!
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result) {
          scores[i + j] = result.score;
        }
      }
    }

    // 3. 使用最小堆找到前k个最大值
    const minHeap = new MinHeap<{ score: number; index: number }>((a, b) => a.score - b.score);
    const k2 = Math.min(k, vectorCount);

    for (let i = 0; i < vectorCount; i++) {
      const currentScore = scores[i];
      if (currentScore !== undefined) {
        if (minHeap.size() < k2) { // 注意这里使用k2
          minHeap.push({ score: currentScore, index: indices[i]! });
        } else {
          const peek = minHeap.peek();
          if (peek && currentScore > peek.score) {
            minHeap.pop();
            minHeap.push({ score: currentScore, index: indices[i]! });
          }
        }
      }
    }

    // 4. 从堆中提取结果并按分数降序排列
    const topKResults: Array<{ index: number; score: number }> = [];
    while (!minHeap.isEmpty()) {
      const item = minHeap.pop();
      if (item) {
        topKResults.push(item);
      }
    }
    topKResults.reverse(); // 堆弹出的是升序，所以需要反转为降序
    return topKResults;
  }

  /**
   * 计算量化精度
   * @param originalVectors 原始向量集合
   * @param queryVectors 查询向量集合
   * @returns 量化精度统计
   */
  public computeQuantizationAccuracy(
    originalVectors: Float32Array[],
    queryVectors: Float32Array[]
  ): {
    meanError: number;
    maxError: number;
    minError: number;
    stdError: number;
    correlation: number;
  } {
    // 参数验证
    if (originalVectors.length === 0) {
      throw new Error('原始向量集合不能为空');
    }
    if (queryVectors.length === 0) {
      throw new Error('查询向量集合不能为空');
    }
    if (originalVectors.length !== queryVectors.length) {
      throw new Error('原始向量集合和查询向量集合长度不匹配');
    }

    // 1. 量化向量集合
    const { quantizedVectors } = this.quantizeVectors(originalVectors);

    // 2. 计算原始分数和量化分数
    const originalScores: number[] = [];
    const quantizedScores: number[] = [];

    for (const queryVector of queryVectors) {
      const centroid = quantizedVectors.getCentroid();
      const { quantizedQuery, queryCorrections } = this.quantizeQueryVector(
        queryVector,
        centroid
      );

      // 计算量化分数
      const quantizedResult = this.scorer.computeQuantizedScore(
        quantizedQuery,
        queryCorrections,
        quantizedVectors,
        0,
        this.config.queryBits!
      );
      quantizedScores.push(quantizedResult.score);

      // 计算原始分数
      const originalResult = this.scorer.computeOriginalScore(
        queryVector,
        originalVectors[0]!,
        this.config.quantizer.similarityFunction
      );
      originalScores.push(originalResult);
    }

    // 3. 计算精度统计
    return this.scorer.computeQuantizationAccuracy(originalScores, quantizedScores);
  }

  /**
   * 序列化向量数据
   * @param vectors 向量集合
   * @returns 序列化数据
   */
  public serializeVectorData(vectors: Float32Array[]): {
    vectorData: VectorDataFormat[];
    metadata: MetadataFormat;
  } {
    const { quantizedVectors } = this.quantizeVectors(vectors);
    const centroid = quantizedVectors.getCentroid();

    // 1. 序列化向量数据
    const vectorData: VectorDataFormat[] = [];
    const vectorCount = quantizedVectors.size();

    for (let i = 0; i < vectorCount; i++) {
      const binaryValues = quantizedVectors.vectorValue(i);
      const corrections = quantizedVectors.getCorrectiveTerms(i);

      // 打包二进制值
      const packedBinaryValues = new Uint8Array(Math.ceil(binaryValues.length / 8));
      OptimizedScalarQuantizer.packAsBinary(binaryValues, packedBinaryValues);

      vectorData.push({
        binaryValues: packedBinaryValues,
        lowerInterval: corrections.lowerInterval,
        upperInterval: corrections.upperInterval,
        additionalCorrection: corrections.additionalCorrection,
        quantizedComponentSum: corrections.quantizedComponentSum
      });
    }

    // 2. 序列化元数据
    const metadata: MetadataFormat = {
      fieldNumber: 0,
      vectorEncodingOrdinal: 0,
      vectorSimilarityOrdinal: 0,
      dimensions: centroid.length,
      vectorDataOffset: 0,
      vectorDataLength: 0,
      vectorCount: vectorCount,
      centroid: centroid,
      centroidSquareMagnitude: computeDotProduct(centroid, centroid)
    };

    return { vectorData, metadata };
  }

  /**
   * 反序列化向量数据
   * @param vectorData 向量数据
   * @param metadata 元数据
   * @returns 反序列化结果
   */
  public deserializeVectorData(
    vectorData: VectorDataFormat[],
    metadata: MetadataFormat
  ): BinarizedByteVectorValues {
    const quantizedVectors: Uint8Array[] = [];
    const corrections: QuantizationResult[] = [];

    for (const data of vectorData) {
      // 解包二进制值
      const unpackedBinaryValues = new Uint8Array(metadata.dimensions);
      this.unpackBinaryValues(data.binaryValues, unpackedBinaryValues);

      quantizedVectors.push(unpackedBinaryValues);
      corrections.push({
        lowerInterval: data.lowerInterval,
        upperInterval: data.upperInterval,
        additionalCorrection: data.additionalCorrection,
        quantizedComponentSum: data.quantizedComponentSum
      });
    }

    return new BinarizedByteVectorValuesImpl(
      quantizedVectors,
      quantizedVectors, // 在反序列化时，我们只有已打包的向量，所以重复使用
      corrections,
      metadata.centroid
    );
  }

  /**
   * 解包二进制值
   * @param packed 打包的二进制值
   * @param unpacked 解包后的二进制值
   */
  private unpackBinaryValues(packed: Uint8Array, unpacked: Uint8Array): void {
    let unpackedIndex = 0;
    for (let i = 0; i < packed.length; i++) {
      const byte = packed[i];
      if (byte !== undefined) {
        for (let j = 7; j >= 0 && unpackedIndex < unpacked.length; j--) {
          unpacked[unpackedIndex++] = (byte >> j) & 1;
        }
      }
    }
  }

  /**
   * 获取配置
   * @returns 二值量化配置
   */
  public getConfig(): BinaryQuantizationConfig {
    return this.config;
  }

  /**
   * 获取量化器
   * @returns 优化的标量量化器
   */
  public getQuantizer(): OptimizedScalarQuantizer {
    return this.quantizer;
  }

  /**
   * 获取评分器
   * @returns 二值量化评分器
   */
  public getScorer(): BinaryQuantizedScorer {
    return this.scorer;
  }
} 