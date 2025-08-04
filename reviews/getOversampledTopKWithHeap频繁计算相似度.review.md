# getOversampledTopKWithHeap频繁计算相似度

## 问题描述
在 `topKSelector.ts` 文件的 `getOversampledTopKWithHeap` 函数中，在遍历 `oversampledResults` 数组时，循环内部对每个结果都调用了 `computeCosineSimilarity(query, vector)` 来计算真实分数：

```typescript
  for (const result of oversampledResults) {
    const vector = vectors[result.index];
    if (!vector) continue;
    
    const trueScore = computeCosineSimilarity(query, vector); // 频繁调用
    const candidate: TopKCandidate = {
      index: result.index,
      quantizedScore: result.score,
      trueScore: trueScore
    };
    // ...
  }
```

## 性能影响
`computeCosineSimilarity` 是一个计算密集型函数，它需要遍历两个向量并执行乘法和加法操作。在 `oversampledResults` 数组非常大时，每次循环迭代都重复调用 `computeCosineSimilarity` 会带来显著的性能开销：

1.  **CPU 密集型：** 每次调用 `computeCosineSimilarity` 都会消耗大量的 CPU 周期。
2.  **内存访问：** 每次调用都会涉及到 `query` 和 `vector` 数组的内存读取，可能导致缓存未命中。

## 建议
1.  **分析 `computeCosineSimilarity` 的性能：** 首先，需要审查 `computeCosineSimilarity` 的实现，了解其内部的计算复杂度。如果它本身效率不高，那么需要优先优化它。
2.  **延迟计算：** 如果可能，考虑延迟计算 `trueScore`。例如，只在需要比较真实分数时才计算，或者只对最终的 `k` 个候选结果计算真实分数。但这需要重新设计算法逻辑。
3.  **批量计算：** 如果 `computeCosineSimilarity` 可以进行批量计算，那么可以考虑在循环外部一次性计算所有 `oversampledResults` 的真实分数，然后将结果传递给循环。

## 结论
`getOversampledTopKWithHeap` 函数中频繁计算真实分数会带来显著的性能开销。建议分析 `computeCosineSimilarity` 的性能，并考虑延迟计算或批量计算等优化措施。
