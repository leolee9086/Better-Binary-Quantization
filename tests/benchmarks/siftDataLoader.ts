import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * SIFT数据集向量接口
 */
export interface SiftVector {
  dimension: number;
  values: Float32Array;
}

/**
 * SIFT数据集读取结果接口
 */
export interface SiftDataset {
  vectors: SiftVector[];
  count: number;
  dimension: number;
}

/**
 * 从.fvecs文件读取SIFT向量数据
 * @param filePath - .fvecs文件路径
 * @param maxVectors - 最大读取向量数量，默认10000
 * @returns SIFT数据集
 */
export function loadSiftVectors(filePath: string, maxVectors: number = 10000): SiftDataset {
  try {
    const buffer = readFileSync(filePath);
    const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    
    // 读取第一个向量的维度
    const dimension = dataView.getUint32(0, true); // 大端序
    
    // 计算向量数量：文件大小 / (维度 + 1) / 4
    const totalVectors = Math.floor(buffer.length / (dimension + 1) / 4);
    const vectorsToRead = Math.min(maxVectors, totalVectors);
    
    const vectors: SiftVector[] = [];
    
    for (let i = 0; i < vectorsToRead; i++) {
      const offset = i * (dimension + 1) * 4;
      
      // 读取向量维度（应该是相同的）
      const vecDimension = dataView.getUint32(offset, true);
      if (vecDimension !== dimension) {
        throw new Error(`向量维度不一致: 期望${dimension}, 实际${vecDimension}`);
      }
      
      // 读取向量值
      const values = new Float32Array(dimension);
      for (let j = 0; j < dimension; j++) {
        values[j] = dataView.getFloat32(offset + 4 + j * 4, true); // 大端序
      }
      
      vectors.push({
        dimension: vecDimension,
        values
      });
    }
    
    return {
      vectors,
      count: vectors.length,
      dimension
    };
  } catch (error) {
    throw new Error(`读取SIFT数据失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 从SIFT1M数据集目录加载指定数量的向量
 * @param datasetDir - 数据集目录路径
 * @param fileType - 文件类型 ('base', 'learn', 'query')
 * @param maxVectors - 最大读取向量数量，默认10000
 * @returns SIFT数据集
 */
export function loadSiftDataset(
  datasetDir: string, 
  fileType: 'base' | 'learn' | 'query' = 'base',
  maxVectors: number = 10000
): SiftDataset {
  const fileName = `sift_${fileType}.fvecs`;
  const filePath = join(datasetDir, fileName);
  
  return loadSiftVectors(filePath, maxVectors);
}

/**
 * 从SIFT1M数据集加载查询向量和真实标签
 * @param datasetDir - 数据集目录路径
 * @param maxQueries - 最大查询数量，默认100
 * @returns 查询向量和真实标签
 */
export function loadSiftQueries(datasetDir: string, maxQueries: number = 100): {
  queries: SiftVector[];
  groundtruth: number[][];
} {
  // 加载查询向量
  const queryDataset = loadSiftDataset(datasetDir, 'query', maxQueries);
  
  // 加载真实标签
  const groundtruthPath = join(datasetDir, 'sift_groundtruth.ivecs');
  const buffer = readFileSync(groundtruthPath);
  const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  
  const k = dataView.getUint32(0, true); // 每个查询的邻居数量，大端序
  
  const groundtruth: number[][] = [];
  
  for (let i = 0; i < Math.min(maxQueries, queryDataset.count); i++) {
    const offset = i * (k * 4 + 4);
    const neighbors: number[] = [];
    
    for (let j = 0; j < k; j++) {
      const neighborId = dataView.getUint32(offset + 4 + j * 4, true); // 大端序
      neighbors.push(neighborId);
    }
    
    groundtruth.push(neighbors);
  }
  
  return {
    queries: queryDataset.vectors,
    groundtruth
  };
} 