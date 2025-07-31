# 召回率测试失败根本原因诊断报告

## 1. 摘要

`tests/recall.test.ts` 中的召回率测试失败，其根本原因在于 `optimizedScalarQuantizer.ts` 文件中的 `scalarQuantize` 方法，未能完全精确地复现其参考原型 `org.apache.lucene.util.quantization.OptimizedScalarQuantizer.java` 的核心计算流程。

具体来说，我们的TypeScript实现**错误地计算了在非欧氏距离（余弦相似度、最大内积）下所需的修正项 `additionalCorrection`**。它本应是**原始向量**与质心的点积，但我们的代码却在计算该值前丢失了原始向量的信息，导致计分器 `BinaryQuantizedScorer` 使用了错误的修正参数，最终生成了与真实相似度排序不一致的量化分数，导致召回率测试失败。

## 2. 问题现象

- **测试失败**: `vitest --run` 命令显示 `tests/recall.test.ts` 中的 “量化检索的 recall@5 应大于 0.6” 测试用例失败。
- **指标差距**: 预期的 `recall@5` 大于等于 `0.6`，而实际平均值仅为 `0.16`。
- **排序错误**: 从测试日志可以看出，量化搜索返回的Top-K结果，与真实近邻的排序结果存在巨大差异，甚至完全不相关。

## 3. 诊断过程

1.  **初步审查**: 首先怀疑 `BinaryQuantizedScorer` 中的计分公式本身有问题。
2.  **错误溯源**: 错误地将计分公式与一个简化的Java实现 (`ScalarQuantizedVectorSimilarity.java`) 进行对比，得出了“公式本身错误”的草率结论。
3.  **修正方向**: 在你的指引下，我认识到必须找到我们代码所参考的、最精确的原始Java实现。
4.  **锁定源头**: `optimizedScalarQuantizer.ts` 文件中的注释明确指向了 `OptimizedScalarQuantizer.java`。通过深入阅读此文件，我发现了构建修正项 `additionalCorrection` 的关键逻辑。
5.  **发现真相**: Java源码中，`QuantizationResult` 的 `additionalCorrection` 是一个**条件值**：
    - 当相似度为 `EUCLIDEAN` 时，它是 `norm2` (中心化后向量的范数平方)。
    - 当相似度为 `COSINE` 或 `MAXIMUM_INNER_PRODUCT` 时，它是 `centroidDot` (**原始向量**与质心的点积)。
6.  **定位偏差**: 将Java的实现流程与TypeScript的实现流程进行并排比对，最终定位到了两者之间一个细微但致命的执行顺序差异。

## 4. 根本原因

**问题的根源在于 `optimizedScalarQuantizer.ts` 的 `scalarQuantize` 方法中，计算流程与Java原型不一致，导致未能正确计算 `centroidDot`。**

#### Java 实现流程 (`OptimizedScalarQuantizer.java`):

```java
// 伪代码
float centroidDot = 0;
// 1. 在一个循环中，首先使用【原始向量】计算 centroidDot
for (int i=0; ... ) {
  if (similarityFunction != EUCLIDEAN) {
    centroidDot += vector[i] * centroid[i];
  }
  // 2. 然后【就地修改】向量，将其中心化
  vector[i] = vector[i] - centroid[i];
}
// 3. 后续所有优化和量化都在【中心化之后】的vector上进行
// 4. 最后返回结果时，根据条件传入正确的 additionalCorrection
return new QuantizationResult(..., (similarityFunction == EUCLIDEAN ? norm2 : centroidDot), ...);
```

#### TypeScript 实现流程 (`optimizedScalarQuantizer.ts`):

```typescript
// 伪代码
// 1. 直接调用一个辅助函数，返回一个【全新的、已经中心化】的向量
const centeredVector = this.centerVector(vector, centroid);

// 2. 【原始向量】的信息在此处已经丢失，无法再用于计算 centroidDot

// 3. 后续所有计算都在 centeredVector 上进行
// ...

// 4. 在 computeCorrections 方法中，只能基于 centeredVector 计算修正项
//    导致返回的 additionalCorrection 在非欧氏距离下是错误的
const corrections = this.computeCorrections(centeredVector, ...);
return corrections;
```

这个流程上的偏差，导致了当相似度函数为 `COSINE` 时，我们传递给计分器的 `additionalCorrection` 是一个错误的值，计分公式虽然本身没错，但代入的参数错了，自然得出了错误的排序结果。

## 5. 修复建议 (如可修改代码)

应重构 `optimizedScalarQuantizer.ts` 中的 `scalarQuantize` 方法，使其严格遵守Java版本的计算流程。

1.  在方法开始时，先用**原始（未中心化的）`vector`** 和 `centroid` 计算出 `centroidDot` 并暂存。
2.  然后，再对 `vector` 进行中心化。
3.  执行后续的统计、优化和量化步骤。
4.  在方法末尾创建并返回 `QuantizationResult` 对象时，根据 `similarityFunction` 的类型，将正确的修正值（`norm2` 或先前计算好的 `centroidDot`）赋给 `additionalCorrection` 字段。

通过以上修改，即可确保计分器获得正确的修正参数，从而生成与真实相似度排序一致的量化分数，解决召回率低的问题。
