# 测试目录结构

## 目录说明

### `/tests/` - 核心正确性测试
包含用于验证src中代码正确性的测试文件：

- `batch-dot-product.test.ts` - 批量点积计算正确性验证
- `batch-quantized-scores.test.ts` - 批量量化分数计算正确性验证
- `computeCentroid-correctness.test.ts` - 质心计算正确性验证
- `utils.test.ts` - 工具函数正确性验证
- `simple-quantized-query.test.ts` - 简单量化查询正确性验证
- `dot-product-comparison.test.ts` - 点积计算比较验证
- `recall.test.ts` - 召回率测试（正确性测试）

### `/tests/experimental/` - 实验性测试
包含性能测试、基准测试和分析测试，这些测试主要用于性能分析和实验：

- `cache-performance.test.ts` - 缓存性能测试
- `single-similarity-breakdown.test.ts` - 单个相似度计算步骤分解测试
- `similarity-computation-breakdown.test.ts` - 相似度计算步骤分解测试
- `single-query-step-performance.test.ts` - 单步查询过程性能测试
- `brute-force-performance.test.ts` - 暴力查询性能测试
- `1bit-4bit-bottleneck.test.ts` - 1bit量化4bit查询性能瓶颈测试
- `single-query-timing.test.ts` - 单次查询时间测试
- `1024d-performance.test.ts` - 1024维向量性能测试
- `quantization-pipeline-performance.test.ts` - 量化查询流程性能测试
- `segment-size-performance.test.ts` - 段大小性能测试
- `batch-dot-product-performance.bench.ts` - 批量点积计算性能测试

### `/tests/benchmarks/` - 基准测试
包含使用真实数据集的基准测试：

- `sift1m.bench.ts` - SIFT1M数据集性能测试
- `computeCentroid-performance.bench.ts` - 质心计算性能基准测试
- `sift1m.test.ts` - SIFT1M数据集测试
- `sift1m-simple.test.ts` - SIFT1M简单测试
- `siftDataLoader.ts` - SIFT数据加载器

## 运行测试

### 运行核心正确性测试
```bash
pnpm test
# 或
pnpm test:run
```

### 运行实验性测试
```bash
pnpm test:experimental
# 或监听模式
pnpm test:experimental:watch
```

### 运行基准测试
```bash
pnpm bench
```

### 运行覆盖率测试
```bash
pnpm test:coverage
```

## 测试分类原则

### 核心正确性测试
- 验证代码功能的正确性
- 测试边界条件和异常情况
- 确保算法实现的准确性
- 在CI/CD中必须通过

### 实验性测试
- 性能分析和优化
- 算法比较和基准测试
- 大规模数据测试
- 调试和问题诊断
- 可选运行，不影响CI/CD

### 基准测试
- 使用真实数据集
- 性能基准建立
- 算法性能对比
- 长期性能监控 