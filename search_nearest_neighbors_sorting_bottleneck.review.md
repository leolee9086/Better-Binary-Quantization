## 问题名：`search_nearest_neighbors_sorting_bottleneck.review.md`

**详细描述：**
在 `src/binaryQuantizationFormat.ts` 文件的 `searchNearestNeighbors` 方法中，为了找到前 `k` 个最大值，代码实现了一个简单的选择排序（selection sort）算法。

```typescript
    // 3. 使用快速选择算法找到前k个最大值
    const k2 = Math.min(k, vectorCount);
    for (let i = 0; i < k2; i++) {
      let maxIdx = i;
      for (let j = i + 1; j < vectorCount; j++) {
        const idxJ = indices[j];
        const idxMax = indices[maxIdx];
        if (idxJ !== undefined && idxMax !== undefined && 
            idxJ < scores.length && idxMax < scores.length && 
            scores[idxJ] !== undefined && scores[idxMax] !== undefined &&
            scores[idxJ] > scores[idxMax]) {
          maxIdx = j;
        }
      }
      if (maxIdx !== i) {
        const temp = indices[i];
        const maxIdxValue = indices[maxIdx];
        if (temp !== undefined && maxIdxValue !== undefined) {
          indices[i] = maxIdxValue;
          indices[maxIdx] = temp;
        }
      }
    }
```
尽管注释写着“使用快速选择算法”，但实际实现是选择排序。选择排序的时间复杂度为 O(N^2)，其中 N 是 `vectorCount`。当 `vectorCount` 很大时，这会成为一个严重的性能瓶颈，尤其是在 `k` 值相对较小的情况下。对于寻找前 `k` 个最大值的问题，更优的算法是使用最小堆（Min-Heap）或快速选择（Quickselect）算法，它们的时间复杂度通常为 O(N log k) 或 O(N)（平均情况）。

**解决方案：**
将选择排序替换为最小堆（Min-Heap）或快速选择（Quickselect）算法。由于项目中已经存在 `minHeap.ts`，可以直接利用现有的 `MinHeap` 类来实现。

使用最小堆的步骤如下：
1. 创建一个大小为 `k` 的最小堆。
2. 遍历所有向量的分数。
3. 如果堆的大小小于 `k`，则将当前向量的 (分数, 索引) 对推入堆中。
4. 如果堆的大小等于 `k` 且当前向量的分数大于堆顶元素的分数，则弹出堆顶元素，并将当前向量的 (分数, 索引) 对推入堆中。
5. 遍历结束后，堆中剩下的 `k` 个元素就是分数最高的 `k` 个向量。

这将把时间复杂度从 O(N^2) 降低到 O(N log k)，显著提高性能。