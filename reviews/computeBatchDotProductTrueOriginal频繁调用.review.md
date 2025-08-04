# computeBatchDotProductTrueOriginal频繁调用

## 问题描述
在 `batchDotProduct.ts` 文件的 `computeBatchDotProductTrueOriginal` 函数中，循环内部对每个 `targetOrd` 都调用了 `targetVectors.getUnpackedVector` 和 `computeInt1BitDotProduct`：

```typescript
  for (let i = 0; i < targetOrds.length; i++) {
    const unpackedBinaryCode = targetVectors.getUnpackedVector(targetOrds[i]!); // 频繁调用
    results[i] = computeInt1BitDotProduct(queryVector, unpackedBinaryCode); // 频繁调用
  }
```

## 性能影响
`computeBatchDotProductTrueOriginal` 被描述为“真正的原始算法：逐个调用 `computeInt1BitDotProduct`”，这表明它可能不是为高性能设计的。然而，如果这个函数在某些场景下仍然被使用，那么其内部的频繁函数调用会带来显著的性能开销：

1.  **`targetVectors.getUnpackedVector` 的开销：** 如前所述，如果 `getUnpackedVector` 涉及解压或数据复制，那么每次调用都会产生开销。
2.  **`computeInt1BitDotProduct` 的开销：** 每次调用 `computeInt1BitDotProduct` 都会有函数调用的开销，并且其内部也包含一个循环来计算点积。重复的函数调用和内部循环会累积成较大的开销。
3.  **缓存未命中：** 频繁地从 `targetVectors` 中获取不同的向量，可能会导致缓存未命中，从而增加内存访问延迟。

## 建议
1.  **避免使用：** 如果可能，应尽量避免在性能敏感的路径上使用 `computeBatchDotProductTrueOriginal`，而优先使用 `computeBatchDotProductOptimized` 等优化过的批量计算方法。
2.  **优化 `getUnpackedVector` 和 `computeInt1BitDotProduct`：** 如果无法避免使用此函数，那么需要重点优化 `targetVectors.getUnpackedVector` 和 `computeInt1BitDotProduct` 这两个被频繁调用的函数，例如通过缓存、批量操作或更底层的优化。
3.  **批量处理：** 如果 `computeBatchDotProductTrueOriginal` 仍然是必要的，可以考虑将其内部逻辑重构为更批量化的操作，例如一次性获取所有 `unpackedBinaryCode`，然后进行批量点积计算。

## 结论
`computeBatchDotProductTrueOriginal` 函数内部的频繁函数调用会带来显著的性能开销。建议尽量避免使用此函数，或者对其内部依赖的函数进行深度优化。
