import { describe, it, expect } from 'vitest';
import { 
  computeDotProduct, 
  normalizeVector,
  addVectors,
  subtractVectors,
  scaleVector
} from '../src/vectorOperations';
import { 
  computeEuclideanDistance, 
  computeCosineSimilarity, 
  computeMaximumInnerProduct
} from '../src/vectorSimilarity';
import { computeVectorMagnitude } from '../src/vectorUtils';

describe('VectorUtil', () => {
  describe('computeDotProduct', () => {
    it('应该计算两个向量的点积', () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([5, 6, 7, 8]);
      
      const result = computeDotProduct(a, b);
      const expected = 1*5 + 2*6 + 3*7 + 4*8;
      
      expect(result).toBe(expected);
    });

    it('应该处理零向量', () => {
      const a = new Float32Array([0, 0, 0, 0]);
      const b = new Float32Array([1, 2, 3, 4]);
      
      const result = computeDotProduct(a, b);
      expect(result).toBe(0);
    });

    it('应该处理单位向量', () => {
      const a = new Float32Array([1, 0, 0, 0]);
      const b = new Float32Array([0, 1, 0, 0]);
      
      const result = computeDotProduct(a, b);
      expect(result).toBe(0);
    });

    it('应该处理相同向量', () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const result = computeDotProduct(a, a);
      const expected = 1*1 + 2*2 + 3*3 + 4*4;
      
      expect(result).toBe(expected);
    });
  });

  describe('computeEuclideanDistance', () => {
    it('应该计算两个向量的欧几里得距离', () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([5, 6, 7, 8]);
      
      const result = computeEuclideanDistance(a, b);
      const expected = Math.sqrt((1-5)**2 + (2-6)**2 + (3-7)**2 + (4-8)**2);
      
      expect(result).toBeCloseTo(expected, 6);
    });

    it('应该处理相同向量', () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const result = computeEuclideanDistance(a, a);
      expect(result).toBe(0);
    });

    it('应该处理零向量', () => {
      const a = new Float32Array([0, 0, 0, 0]);
      const b = new Float32Array([1, 2, 3, 4]);
      
      const result = computeEuclideanDistance(a, b);
      const expected = Math.sqrt(1**2 + 2**2 + 3**2 + 4**2);
      
      expect(result).toBeCloseTo(expected, 6);
    });
  });

  describe('computeCosineSimilarity', () => {
    it('应该计算两个向量的余弦相似度', () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([5, 6, 7, 8]);
      
      const result = computeCosineSimilarity(a, b);
      
      const dotProduct = 1*5 + 2*6 + 3*7 + 4*8;
      const normA = Math.sqrt(1**2 + 2**2 + 3**2 + 4**2);
      const normB = Math.sqrt(5**2 + 6**2 + 7**2 + 8**2);
      const expected = dotProduct / (normA * normB);
      
      expect(result).toBeCloseTo(expected, 6);
    });

    it('应该处理相同向量', () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const result = computeCosineSimilarity(a, a);
      expect(result).toBeCloseTo(1, 6);
    });

    it('应该处理正交向量', () => {
      const a = new Float32Array([1, 0, 0, 0]);
      const b = new Float32Array([0, 1, 0, 0]);
      
      const result = computeCosineSimilarity(a, b);
      expect(result).toBeCloseTo(0, 6);
    });

    it('应该处理零向量', () => {
      const a = new Float32Array([0, 0, 0, 0]);
      const b = new Float32Array([1, 2, 3, 4]);
      
      // 零向量的余弦相似度应该是 NaN 或 0
      const result = computeCosineSimilarity(a, b);
      expect(isNaN(result) || result === 0).toBe(true);
    });
  });

  describe('computeMaximumInnerProduct', () => {
    it('应该计算两个向量的最大内积', () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([5, 6, 7, 8]);
      
      const result = computeMaximumInnerProduct(a, b);
      const expected = 1*5 + 2*6 + 3*7 + 4*8;
      
      expect(result).toBe(expected);
    });

    it('应该处理负值', () => {
      const a = new Float32Array([-1, -2, -3, -4]);
      const b = new Float32Array([5, 6, 7, 8]);
      
      const result = computeMaximumInnerProduct(a, b);
      const expected = (-1)*5 + (-2)*6 + (-3)*7 + (-4)*8;
      
      expect(result).toBe(expected);
    });

    it('应该处理零向量', () => {
      const a = new Float32Array([0, 0, 0, 0]);
      const b = new Float32Array([1, 2, 3, 4]);
      
      const result = computeMaximumInnerProduct(a, b);
      expect(result).toBe(0);
    });
  });

  describe('normalizeVector', () => {
    it('应该归一化向量', () => {
      const vector = new Float32Array([3, 4, 0, 0]);
      const result = normalizeVector(vector);
      
      const norm = Math.sqrt(3**2 + 4**2);
      const expected = new Float32Array([3/norm, 4/norm, 0, 0]);
      
      for (let i = 0; i < result.length; i++) {
        const expectedValue = expected[i];
        if (expectedValue === undefined) {
          throw new Error(`期望值索引${i}不存在`);
        }
        expect(result[i]).toBeCloseTo(expectedValue, 6);
      }
    });

    it('应该处理零向量', () => {
      const vector = new Float32Array([0, 0, 0, 0]);
      const result = normalizeVector(vector);
      
      // 零向量归一化后应该保持为零向量
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(0);
      }
    });

    it('应该处理单位向量', () => {
      const vector = new Float32Array([1, 0, 0, 0]);
      const result = normalizeVector(vector);
      
      expect(result[0]).toBeCloseTo(1, 6);
      expect(result[1]).toBeCloseTo(0, 6);
      expect(result[2]).toBeCloseTo(0, 6);
      expect(result[3]).toBeCloseTo(0, 6);
    });
  });

  describe('computeVectorMagnitude', () => {
    it('应该计算向量幅度', () => {
      const vector = new Float32Array([3, 4, 0, 0]);
      const result = computeVectorMagnitude(vector);
      const expected = Math.sqrt(3**2 + 4**2);
      
      expect(result).toBeCloseTo(expected, 6);
    });

    it('应该处理零向量', () => {
      const vector = new Float32Array([0, 0, 0, 0]);
      const result = computeVectorMagnitude(vector);
      expect(result).toBe(0);
    });

    it('应该处理单位向量', () => {
      const vector = new Float32Array([1, 0, 0, 0]);
      const result = computeVectorMagnitude(vector);
      expect(result).toBe(1);
    });
  });

  describe('addVectors', () => {
    it('应该添加两个向量', () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([5, 6, 7, 8]);
      
      const result = addVectors(a, b);
      const expected = new Float32Array([6, 8, 10, 12]);
      
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(expected[i]);
      }
    });

    it('应该处理零向量', () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([0, 0, 0, 0]);
      
      const result = addVectors(a, b);
      
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(a[i]);
      }
    });
  });

  describe('subtractVectors', () => {
    it('应该减去两个向量', () => {
      const a = new Float32Array([5, 6, 7, 8]);
      const b = new Float32Array([1, 2, 3, 4]);
      
      const result = subtractVectors(a, b);
      const expected = new Float32Array([4, 4, 4, 4]);
      
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(expected[i]);
      }
    });

    it('应该处理零向量', () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([0, 0, 0, 0]);
      
      const result = subtractVectors(a, b);
      
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(a[i]);
      }
    });
  });

  describe('scaleVector', () => {
    it('应该缩放向量', () => {
      const vector = new Float32Array([1, 2, 3, 4]);
      const scale = 2.5;
      
      const result = scaleVector(vector, scale);
      const expected = new Float32Array([2.5, 5, 7.5, 10]);
      
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(expected[i]);
      }
    });

    it('应该处理零缩放', () => {
      const vector = new Float32Array([1, 2, 3, 4]);
      const scale = 0;
      
      const result = scaleVector(vector, scale);
      
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(0);
      }
    });

    it('应该处理负缩放', () => {
      const vector = new Float32Array([1, 2, 3, 4]);
      const scale = -1;
      
      const result = scaleVector(vector, scale);
      const expected = new Float32Array([-1, -2, -3, -4]);
      
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBe(expected[i]);
      }
    });
  });
}); 