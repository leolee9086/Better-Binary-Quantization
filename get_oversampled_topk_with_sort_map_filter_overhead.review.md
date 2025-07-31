## 问题名：`get_oversampled_topk_with_sort_map_filter_overhead.review.md`

**详细描述：**
在 `src/topKSelector.ts` 文件的 `getOversampledTopKWithSort` 函数中，使用了 `map` 和 `filter` 链式操作来处理 `oversampledResults`：
```typescript
export function getOversampledTopKWithSort(
  // ...
): TopKCandidate[] {
  // ...
  const oversampledResults = format.searchNearestNeighbors(query, quantizedVectors, oversampledK);
  
  const candidateScores = oversampledResults.map(result => {
    const vector = vectors[result.index];
    if (!vector) return null;
    
    return {
      index: result.index,
      quantizedScore: result.score,
      trueScore: computeCosineSimilarity(query, vector)
    };
  }).filter((candidate): candidate is TopKCandidate => candidate !== null);
  
  // ...
}
```
这种 `map` 之后紧跟着 `filter` 的模式，会导致对数组进行两次遍历。首先 `map` 会遍历 `oversampledResults` 并创建一个新的中间数组（可能包含 `null` 值），然后 `filter` 会再次遍历这个中间数组，创建一个最终的数组。对于大型 `oversampledResults` 数组，这种双重遍历会带来不必要的性能开销。

**解决方案：**
将 `map` 和 `filter` 操作合并到一次遍历中，从而避免创建中间数组和重复遍历。

```typescript
export function getOversampledTopKWithSort(
  query: Float32Array, 
  quantizedVectors: any, 
  vectors: Float32Array[], 
  k: number, 
  oversampleFactor: number, 
  format: BinaryQuantizationFormat
): TopKCandidate[] {
  const oversampledK = k * oversampleFactor;
  const oversampledResults = format.searchNearestNeighbors(query, quantizedVectors, oversampledK);
  
  const candidateScores: TopKCandidate[] = [];
  for (const result of oversampledResults) {
    const vector = vectors[result.index];
    if (vector) { // 直接在这里进行过滤
      candidateScores.push({
        index: result.index,
        quantizedScore: result.score,
        trueScore: computeCosineSimilarity(query, vector)
      });
    }
  }
  
  // 按真实分数排序并返回topK
  candidateScores.sort((a, b) => b.trueScore - a.trueScore);
  return candidateScores.slice(0, k);
}
```
这种优化将 `map` 和 `filter` 的逻辑合并到一个循环中，减少了数组遍历的次数和中间数组的创建，从而提高了性能。