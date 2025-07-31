## 问题名：`get_oversampled_topk_with_heap_final_sort_overhead.review.md`

**详细描述：**
在 `src/topKSelector.ts` 文件的 `getOversampledTopKWithHeap` 函数中，虽然使用了最小堆来高效地维护 `k` 个最佳结果，但在函数末尾，它仍然对从堆中取出的所有元素进行了额外的排序：
```typescript
  // 从堆中提取结果并排序
  const topK: TopKCandidate[] = [];
  while (!minHeap.isEmpty()) {
    const item = minHeap.pop();
    if (item) {
      topK.push(item);
    }
  }
  
  // 按真实分数降序排列
  topK.sort((a, b) => b.trueScore - a.trueScore);
```
最小堆的特性是，它能保证堆顶是最小元素，但不能保证堆中其他元素的顺序。因此，当所有元素从堆中弹出并放入 `topK` 数组时，它们是无序的。为了得到最终按分数降序排列的结果，代码又调用了 `topK.sort()`。

这个额外的排序操作的时间复杂度是 O(k log k)。虽然 `k` 通常比总向量数小得多，但对于非常大的 `k` 值，或者在需要频繁调用此函数的情况下，这个额外的排序仍然会带来不必要的开销。

**解决方案：**
由于最小堆在弹出元素时会按照从小到大的顺序弹出，因此可以直接将弹出的元素逆序存储，或者在弹出时就插入到正确的位置，从而避免最终的 `sort` 操作。

1.  **逆序存储：** 最简单的方法是，当从最小堆中弹出元素时，将它们添加到数组的开头（例如使用 `unshift`），或者将它们添加到数组末尾，然后在所有元素都弹出后，对整个数组进行一次 `reverse` 操作。

    ```typescript
    // 从堆中提取结果
    const topK: TopKCandidate[] = [];
    while (!minHeap.isEmpty()) {
      const item = minHeap.pop();
      if (item) {
        topK.unshift(item); // 将元素添加到数组开头，使其自然降序
      }
    }
    // 此时 topK 已经是降序排列的，无需额外排序
    return topK;
    ```
    或者：
    ```typescript
    const topK: TopKCandidate[] = [];
    while (!minHeap.isEmpty()) {
      const item = minHeap.pop();
      if (item) {
        topK.push(item);
      }
    }
    topK.reverse(); // 逆序，使其变为降序
    return topK;
    ```
    `unshift` 操作的时间复杂度是 O(k)，因为它需要移动数组中的所有元素。`reverse` 操作的时间复杂度是 O(k)。这两种方法都比 O(k log k) 的排序更优。

2.  **在堆中维护降序：** 如果 `MinHeap` 允许自定义比较函数，可以将其修改为 `MaxHeap`，并在弹出时直接得到降序结果。但由于这里已经使用了 `MinHeap`，并且其比较函数是 `a.trueScore - b.trueScore`（从小到大），所以弹出时是升序。

最简单的优化是使用 `reverse()`，因为它避免了 `unshift` 的每次元素移动开销。