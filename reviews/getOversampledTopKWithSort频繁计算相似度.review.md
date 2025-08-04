# getOversampledTopKWithSort频繁计算相似度

## 问题描述
在 `topKSelector.ts` 文件的 `getOversampledTopKWithSort` 函数中，使用了 `map` 和 `filter` 方法来处理 `oversampledResults`，并在 `map` 回调函数中计算 `trueScore`：

```typescript
  const candidateScores = oversampledResults.map(result => {
    const vector = vectors[result.index];
    if (!vector) return null;
    
    return {
      index: result.index,
      quantizedScore: result.score,
      trueScore: computeCosineSimilarity(query, vector) // 频繁调用
    };
  }).filter((candidate): candidate is TopKCandidate => candidate !== null);
```

## 性能影响
`computeCosineSimilarity` 是一个计算密集型函数。在 `oversampledResults` 数组非常大时，`map` 方法会遍历整个数组，并对每个元素都重复调用 `computeCosineSimilarity`，从而带来显著的性能开销：

1.  **CPU 密集型：** 每次调用 `computeCosineSimilarity` 都会消耗大量的 CPU 周期。
2.  **内存访问：** 每次调用都会涉及到 `query` 和 `vector` 数组的内存读取，可能导致缓存未命中。
3.  **中间数组创建：** `map` 方法会创建一个新的中间数组，`filter` 方法也会创建一个新的数组，这会增加内存分配和垃圾回收的开销。

## 建议
1.  **分析 `computeCosineSimilarity` 的性能：** 首先，需要审查 `computeCosineSimilarity` 的实现，了解其内部的计算复杂度。如果它本身效率不高，那么需要优先优化它。
2.  **批量计算：** 如果 `computeCosineSimilarity` 可以进行批量计算，那么可以考虑在 `map` 之前一次性计算所有 `oversampledResults` 的真实分数，然后将结果传递给 `map`。
3.  **单次遍历：** 如果可能，考虑将 `map` 和 `filter` 的逻辑合并到一个单次遍历的循环中，以减少中间数组的创建和遍历次数。

## 结论
`getOversampledTopKWithSort` 函数中频繁计算真实分数会带来显著的性能开销。建议分析 `computeCosineSimilarity` 的性能，并考虑批量计算或单次遍历等优化措施。
