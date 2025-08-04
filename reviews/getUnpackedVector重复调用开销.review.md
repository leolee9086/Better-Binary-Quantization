# getUnpackedVector重复调用开销

## 问题描述
在 `binaryQuantizedScorer.ts` 文件的 `computeOneBitQuantizedScore` 和 `computeFourBitQuantizedScore` 方法中，都调用了 `targetVectors.getUnpackedVector(targetOrd)` 来获取未打包的索引向量：

```typescript
  private computeOneBitQuantizedScore(
    // ...
  ): QuantizedScoreResult {
    // ...
    const unpackedBinaryCode = targetVectors.getUnpackedVector(targetOrd); // 调用1
    const qcDist = computeInt1BitDotProduct(quantizedQuery, unpackedBinaryCode);
    // ...
  }

  private computeFourBitQuantizedScore(
    // ...
  ): QuantizedScoreResult {
    // ...
    const unpackedBinaryCode = targetVectors.getUnpackedVector(targetOrd); // 调用2
    // ...
  }
```

## 性能影响
如果 `targetVectors.getUnpackedVector` 方法内部涉及以下操作，那么每次调用都会产生性能开销：

1.  **数据解压：** 如果索引向量是经过压缩存储的，`getUnpackedVector` 需要对其进行解压操作，这通常是 CPU 密集型的。
2.  **数据复制：** 如果 `getUnpackedVector` 返回的是原始数据的副本而不是引用，那么每次调用都会产生内存分配和数据复制的开销。

在 `computeBatchQuantizedScores` 方法中，虽然使用了 `createConcatenatedBuffer` 来批量处理，但在回退到单次计算时，仍然会频繁调用 `getUnpackedVector`，这会加剧性能问题。

## 建议
1.  **审查 `getUnpackedVector` 实现：** 首先，需要审查 `BinarizedByteVectorValues` 类中 `getUnpackedVector` 方法的实现，了解其内部的具体操作。如果它确实涉及解压或复制，则需要考虑优化。
2.  **缓存未打包向量：** 如果未打包的向量在短时间内会被多次访问，可以考虑在 `BinarizedByteVectorValues` 内部实现一个 LRU 缓存机制，以避免重复的解压或复制操作。
3.  **批量解压：** 如果可能，考虑在 `BinarizedByteVectorValues` 中添加一个批量解压向量的方法，例如 `getUnpackedVectorsBatch(targetOrds: number[])`，这样可以在一次操作中解压多个向量，减少重复开销。
4.  **优化数据结构：** 重新评估 `BinarizedByteVectorValues` 的内部数据存储方式，看是否可以直接以未打包的形式存储部分常用向量，或者优化打包/解包算法。

## 结论
`computeOneBitQuantizedScore` 和 `computeFourBitQuantizedScore` 方法中重复调用 `targetVectors.getUnpackedVector` 可能会导致性能问题。建议审查 `getUnpackedVector` 的实现，并考虑缓存、批量解压或优化数据结构，以提高性能。
