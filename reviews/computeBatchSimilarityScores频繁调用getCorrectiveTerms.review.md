# computeBatchSimilarityScores频繁调用getCorrectiveTerms

## 问题描述
在 `batchDotProduct.ts` 文件的 `computeBatchOneBitSimilarityScores` 和 `computeBatchFourBitSimilarityScores` 函数中，循环内部都调用了 `targetVectors.getCorrectiveTerms(targetOrds[i]!)` 来获取每个目标向量的修正因子：

```typescript
  for (let i = 0; i < targetOrds.length; i++) {
    const qcDist = qcDists[i]!;
    const indexCorrections = targetVectors.getCorrectiveTerms(targetOrds[i]!); // 频繁调用
    // ...
  }
```

## 性能影响
这两个函数是批量计算相似性分数的关键。在循环内部频繁调用 `targetVectors.getCorrectiveTerms` 会带来显著的性能开销，原因如下：

1.  **函数调用开销：** 每次函数调用都会有固定的开销，在大型循环中会累积。
2.  **内部计算/查找开销：** 如果 `getCorrectiveTerms` 内部涉及复杂的计算、查找（例如从一个 Map 或数组中查找）或对象创建，那么这些操作会在每次迭代中重复执行，导致性能下降。
3.  **缓存未命中：** 频繁地从 `targetVectors` 中获取不同的修正因子，可能会导致缓存未命中，从而增加内存访问延迟。

## 建议
1.  **优化 `getCorrectiveTerms`：** 首先，需要审查 `targetVectors` 类中 `getCorrectiveTerms` 方法的实现。如果它是一个简单的属性访问或者 O(1) 的操作，那么当前的调用方式可能不是主要性能问题。但如果它涉及查找、计算或创建新对象，则需要优化。
2.  **批量获取修正因子：** 最有效的优化方式是在循环外部一次性获取所有 `targetOrds` 对应的修正因子，或者在 `targetVectors` 类中添加一个批量获取修正因子的方法，例如 `getCorrectiveTermsBatch(targetOrds: number[])`。这样可以在循环内部直接使用预先获取的结果，避免重复调用。

    ```typescript
    // 示例：批量获取修正因子
    const allIndexCorrections = targetVectors.getCorrectiveTermsBatch(targetOrds);
    for (let i = 0; i < targetOrds.length; i++) {
      const qcDist = qcDists[i]!;
      const indexCorrections = allIndexCorrections[i]; // 直接使用预获取的结果
      // ...
    }
    ```

## 结论
`computeBatchOneBitSimilarityScores` 和 `computeBatchFourBitSimilarityScores` 函数中循环内部频繁调用 `targetVectors.getCorrectiveTerms` 会带来显著的性能开销。建议优先优化 `getCorrectiveTerms` 的实现，并考虑批量获取修正因子，以提高性能。
