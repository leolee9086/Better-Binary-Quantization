## 问题名：`compute_centroid_nested_loop_overhead.review.md`

**详细描述：**
在 `src/vectorOperations.ts` 文件的 `computeCentroid` 函数中，用于计算向量集合质心的逻辑包含一个嵌套循环：
```typescript
export function computeCentroid(vectors: Float32Array[]): Float32Array {
  // ...
  const dimension = firstVector.length;
  const centroid = new Float32Array(dimension);

  for (let i = 0; i < dimension; i++) { // 外层循环：遍历维度
    let sum = 0;
    for (let j = 0; j < vectors.length; j++) { // 内层循环：遍历向量集合
      const vector = vectors[j];
      const val = vector?.[i];
      if (val !== undefined) {
        sum += val;
      }
    }
    centroid[i] = sum / vectors.length;
  }

  return centroid;
}
```
这个嵌套循环的结构是 `O(dimension * vectors.length)`。当向量维度很高且向量集合非常大时，这种遍历方式会带来显著的性能开销。

**解决方案：**
优化 `computeCentroid` 函数，减少遍历次数或优化遍历方式。

1.  **交换循环顺序：** 将循环顺序交换，先遍历向量集合，再遍历维度。这样可以更好地利用 CPU 缓存，因为在内层循环中访问的是连续的内存区域（单个向量的元素）。

    ```typescript
    export function computeCentroid(vectors: Float32Array[]): Float32Array {
      if (vectors.length === 0) {
        throw new Error('向量集合不能为空');
      }

      const firstVector = vectors[0];
      if (!firstVector) {
        throw new Error('第一个向量不能为空');
      }
      const dimension = firstVector.length;
      const centroid = new Float32Array(dimension);

      // 初始化质心为第一个向量
      for (let i = 0; i < dimension; i++) {
        centroid[i] = vectors[0]![i] || 0; // 确保处理 undefined
      }

      // 从第二个向量开始累加
      for (let j = 1; j < vectors.length; j++) { // 外层循环：遍历向量集合
        const vector = vectors[j];
        if (vector) {
          for (let i = 0; i < dimension; i++) { // 内层循环：遍历维度
            const val = vector[i];
            if (val !== undefined) {
              centroid[i] += val;
            }
          }
        }
      }

      // 除以向量数量
      const numVectors = vectors.length;
      for (let i = 0; i < dimension; i++) {
        centroid[i] /= numVectors;
      }

      return centroid;
    }
    ```
    这种交换循环顺序的优化通常在处理矩阵或多维数组时非常有效，因为它改善了数据局部性。

2.  **并行化：** 对于非常大的向量集合，可以考虑使用 Web Workers 将向量集合分成多个批次，并行计算每个批次的局部质心，然后将局部质心合并。但这会增加代码的复杂性。

交换循环顺序是更直接且易于实现的优化。