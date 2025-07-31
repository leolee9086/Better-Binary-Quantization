## 问题名：`compute_quantization_accuracy_loop_overhead.review.md`

**详细描述：**
在 `src/binaryQuantizedScorer.ts` 文件的 `computeQuantizationAccuracy` 方法中，存在一个循环，用于计算原始分数和量化分数之间的误差、均值、最大值、最小值和标准差。
```typescript
  public computeQuantizationAccuracy(
    originalScores: number[],
    quantizedScores: number[]
  ): {
    meanError: number;
    maxError: number;
    minError: number;
    stdError: number;
    correlation: number;
  } {
    // ...
    const errors: number[] = [];
    let sumError = 0;
    let maxError = 0;
    let minError = Infinity;

    for (let i = 0; i < originalScores.length; i++) {
      const orig = originalScores[i];
      const quant = quantizedScores[i];
      if (orig !== undefined && quant !== undefined) {
        const error = Math.abs(orig - quant);
        errors.push(error); // 每次循环都向 errors 数组中添加元素
        sumError += error;
        maxError = Math.max(maxError, error);
        minError = Math.min(minError, error);
      }
    }

    const meanError = sumError / errors.length;
    const stdError = this.computeStandardDeviation(errors, meanError); // 再次遍历 errors 数组
    const correlation = this.computePearsonCorrelation(originalScores, quantizedScores); // 再次遍历 originalScores 和 quantizedScores
    // ...
  }
```
这个方法存在以下性能问题：
1.  **`errors` 数组的创建和填充：** 在循环中，每次迭代都会向 `errors` 数组中 `push` 一个新元素。这会导致频繁的内存重新分配和数据复制，尤其是在分数数组很大时。
2.  **重复遍历：** 在计算完 `errors` 数组后，`computeStandardDeviation` 和 `computePearsonCorrelation` 方法会再次遍历 `errors`、`originalScores` 和 `quantizedScores` 数组。这意味着原始数据被遍历了多次，增加了不必要的计算开销。

**解决方案：**
优化 `computeQuantizationAccuracy` 方法，减少内存分配和重复遍历。

1.  **避免创建 `errors` 数组：** 可以在第一次遍历时直接计算 `meanError`、`maxError`、`minError` 和 `sumError`，而不需要显式地存储所有 `error` 值。`stdError` 的计算也可以在同一次遍历中完成，或者在第二次遍历时只遍历一次 `originalScores` 和 `quantizedScores`。

2.  **合并统计计算：** 尝试将 `meanError`、`stdError` 和 `correlation` 的计算合并到一次遍历中。

```typescript
  public computeQuantizationAccuracy(
    originalScores: number[],
    quantizedScores: number[]
  ): {
    meanError: number;
    maxError: number;
    minError: number;
    stdError: number;
    correlation: number;
  } {
    if (originalScores.length !== quantizedScores.length) {
      throw new Error('原始分数和量化分数数组长度不匹配');
    }

    const n = originalScores.length;
    let sumError = 0;
    let maxError = 0;
    let minError = Infinity;

    // 用于计算标准差和皮尔逊相关系数的变量
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    let sumSquaredDiffError = 0; // 用于计算标准差

    for (let i = 0; i < n; i++) {
      const orig = originalScores[i];
      const quant = quantizedScores[i];
      if (orig !== undefined && quant !== undefined) {
        const error = Math.abs(orig - quant);
        sumError += error;
        maxError = Math.max(maxError, error);
        minError = Math.min(minError, error);

        // 为标准差计算累积平方差
        // 注意：这里需要先计算均值，或者使用两遍法
        // 为了单次遍历，我们先累积平方和，然后用公式计算方差
        sumSquaredDiffError += error * error;

        // 为皮尔逊相关系数累积值
        sumX += orig;
        sumY += quant;
        sumXY += orig * quant;
        sumX2 += orig * orig;
        sumY2 += quant * quant;
      }
    }

    const meanError = sumError / n;

    // 计算标准差
    const varianceError = (sumSquaredDiffError / n) - (meanError * meanError);
    const stdError = Math.sqrt(Math.max(0, varianceError)); // 确保非负

    // 计算皮尔逊相关系数
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    const correlation = denominator === 0 ? 0 : numerator / denominator;

    return {
      meanError,
      maxError,
      minError,
      stdError,
      correlation
    };
  }
```
这种优化将所有统计计算合并到一次遍历中，显著减少了内存分配和重复遍历的开销，从而提高了性能。