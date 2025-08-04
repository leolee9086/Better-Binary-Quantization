# scaleMaxInnerProductScore条件判断开销

## 问题描述
在 `binaryQuantizedScorer.ts` 文件的 `scaleMaxInnerProductScore` 函数中，存在一个条件判断：

```typescript
function scaleMaxInnerProductScore(score: number): number {
  if (score < 0) {
    return 1 / (1 - score);
  }
  return score + 1;
}
```

## 性能影响
虽然 `if (score < 0)` 这个条件判断本身非常轻量，但在高频调用的场景下（例如在循环内部或者被大量相似性计算调用），累积起来可能会产生可测量的性能开销。尤其是在 `score` 的值频繁地在小于 0 和大于等于 0 之间切换时，CPU 的分支预测可能会失效，导致额外的性能损失。

## 建议
1. **分析调用频率和 `score` 分布：** 首先，需要分析 `scaleMaxInnerProductScore` 函数的实际调用频率以及 `score` 参数的数值分布。如果该函数调用频率不高，或者 `score` 的值大部分时间都落在同一个分支，那么当前的性能影响可以忽略不计。
2. **考虑无分支优化：** 如果分析结果表明该函数是性能瓶颈，并且 `score` 的分布导致分支预测失效，可以考虑使用数学方法或位运算来消除条件分支，例如使用 `Math.max` 或 `Math.min` 结合其他运算来模拟条件逻辑，但这通常会增加代码的复杂性，并且不一定能带来显著的性能提升，甚至可能因为更复杂的数学运算而降低性能。

## 结论
`scaleMaxInnerProductScore` 函数中的条件判断在极端高频调用且分支预测失效的情况下，可能带来轻微的性能开销。建议在确认其为性能瓶颈后，再考虑进行优化。
