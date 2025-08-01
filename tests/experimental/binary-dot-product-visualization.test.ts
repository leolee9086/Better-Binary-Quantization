import { describe, it, expect } from 'vitest';

/**
 * 可视化1024维二进制向量点积计算过程
 */
describe('1024维二进制向量点积可视化', () => {
  
  /**
   * 创建示例二进制向量（简化版本，只显示前32位）
   */
  function createExampleBinaryVectors() {
    // 创建两个1024维的二进制向量
    const vectorA = new Uint8Array(1024);
    const vectorB = new Uint8Array(1024);
    
    // 填充随机二进制值（0或1）
    for (let i = 0; i < 1024; i++) {
      vectorA[i] = Math.random() > 0.5 ? 1 : 0;
      vectorB[i] = Math.random() > 0.5 ? 1 : 0;
    }
    
    return { vectorA, vectorB };
  }
  
  /**
   * 可视化点积计算过程
   */
  function visualizeDotProduct(vectorA: Uint8Array, vectorB: Uint8Array, maxDisplay: number = 32) {
    console.log('=== 1024维二进制向量点积计算过程 ===');
    console.log(`向量A (前${maxDisplay}位): ${Array.from(vectorA.slice(0, maxDisplay)).join('')}`);
    console.log(`向量B (前${maxDisplay}位): ${Array.from(vectorB.slice(0, maxDisplay)).join('')}`);
    console.log('');
    
    let sum = 0;
    const partialSums: number[] = [];
    
    console.log('逐位计算过程:');
    console.log('位索引 | A值 | B值 | A×B | 累计和');
    console.log('-------|-----|-----|-----|--------');
    
    for (let i = 0; i < Math.min(maxDisplay, vectorA.length); i++) {
      const aVal = vectorA[i]!;
      const bVal = vectorB[i]!;
      const product = aVal * bVal;
      sum += product;
      partialSums.push(sum);
      
      console.log(`  ${i.toString().padStart(2)}   |  ${aVal}  |  ${bVal}  |  ${product}  |   ${sum}`);
    }
    
    // 计算完整的1024维点积
    let fullSum = 0;
    for (let i = 0; i < vectorA.length; i++) {
      fullSum += vectorA[i]! * vectorB[i]!;
    }
    
    console.log('');
    console.log(`前${maxDisplay}位累计和: ${sum}`);
    console.log(`完整1024维点积: ${fullSum}`);
    
    return { partialSum: sum, fullSum, partialSums };
  }
  
  /**
   * 分析二进制向量的统计特性
   */
  function analyzeBinaryVectorStats(vector: Uint8Array) {
    const ones = vector.reduce((count, val) => count + val, 0);
    const zeros = vector.length - ones;
    const sparsity = zeros / vector.length;
    
    console.log('=== 向量统计特性 ===');
    console.log(`总位数: ${vector.length}`);
    console.log(`1的个数: ${ones}`);
    console.log(`0的个数: ${zeros}`);
    console.log(`稀疏度: ${(sparsity * 100).toFixed(2)}%`);
    console.log(`密度: ${((1 - sparsity) * 100).toFixed(2)}%`);
    
    return { ones, zeros, sparsity };
  }
  
  /**
   * 分析点积结果的分布
   */
  function analyzeDotProductDistribution(vectorA: Uint8Array, vectorB: Uint8Array) {
    const aStats = analyzeBinaryVectorStats(vectorA);
    const bStats = analyzeBinaryVectorStats(vectorB);
    
    console.log('');
    console.log('=== 点积结果分析 ===');
    
    // 理论最大点积
    const maxPossible = Math.min(aStats.ones, bStats.ones);
    console.log(`理论最大点积: ${maxPossible}`);
    
    // 实际点积
    let actualDotProduct = 0;
    for (let i = 0; i < vectorA.length; i++) {
      actualDotProduct += vectorA[i]! * vectorB[i]!;
    }
    console.log(`实际点积: ${actualDotProduct}`);
    console.log(`点积占比: ${((actualDotProduct / maxPossible) * 100).toFixed(2)}%`);
    
    return { maxPossible, actualDotProduct };
  }
  
  it('可视化1024维二进制向量点积计算', () => {
    const { vectorA, vectorB } = createExampleBinaryVectors();
    
    // 可视化计算过程
    const { partialSum, fullSum } = visualizeDotProduct(vectorA, vectorB, 16);
    
    // 分析统计特性
    analyzeDotProductDistribution(vectorA, vectorB);
    
    // 验证计算正确性
    expect(fullSum).toBeGreaterThanOrEqual(0);
    expect(fullSum).toBeLessThanOrEqual(1024);
    expect(typeof fullSum).toBe('number');
  });
  
  it('分析高维向量的稀疏性对点积的影响', () => {
    // 创建不同稀疏度的向量对
    const testCases = [
      { name: '高稀疏度', sparsityA: 0.9, sparsityB: 0.9 },
      { name: '中等稀疏度', sparsityA: 0.5, sparsityB: 0.5 },
      { name: '低稀疏度', sparsityA: 0.1, sparsityB: 0.1 }
    ];
    
    testCases.forEach(({ name, sparsityA, sparsityB }) => {
      console.log(`\n=== ${name}测试 ===`);
      
      const vectorA = new Uint8Array(1024);
      const vectorB = new Uint8Array(1024);
      
      // 根据稀疏度填充向量
      for (let i = 0; i < 1024; i++) {
        vectorA[i] = Math.random() > sparsityA ? 1 : 0;
        vectorB[i] = Math.random() > sparsityB ? 1 : 0;
      }
      
      analyzeDotProductDistribution(vectorA, vectorB);
    });
  });
  
  it('比较不同维度向量的点积计算复杂度', () => {
    const dimensions = [64, 256, 512, 1024];
    
    dimensions.forEach(dim => {
      console.log(`\n=== ${dim}维向量点积 ===`);
      
      const vectorA = new Uint8Array(dim);
      const vectorB = new Uint8Array(dim);
      
      for (let i = 0; i < dim; i++) {
        vectorA[i] = Math.random() > 0.5 ? 1 : 0;
        vectorB[i] = Math.random() > 0.5 ? 1 : 0;
      }
      
      const startTime = performance.now();
      let dotProduct = 0;
      for (let i = 0; i < dim; i++) {
        dotProduct += vectorA[i]! * vectorB[i]!;
      }
      const endTime = performance.now();
      
      console.log(`维度: ${dim}`);
      console.log(`点积结果: ${dotProduct}`);
      console.log(`计算时间: ${(endTime - startTime).toFixed(6)}ms`);
      console.log(`理论最大点积: ${dim}`);
      console.log(`实际占比: ${((dotProduct / dim) * 100).toFixed(2)}%`);
    });
  });
}); 