# @leolee9086/better-binary-quantization

基于Lucene的二值量化实现，提供优化的向量量化和搜索功能。

## 🚀 特性

- **优化的标量量化器** - 高效的向量量化算法
- **位运算优化的向量操作** - SIMD友好的高性能实现
- **二值量化评分器** - 精确的相似性计算
- **完整的二值量化格式** - 标准化的数据格式
- **各向异性损失函数** - 改进的量化精度
- **坐标下降优化算法** - 快速收敛的优化方法
- **非对称量化策略** - 查询4位 vs 索引1位
- **质心中心化优化** - 提高搜索精度
- **SIMD友好的位运算优化** - 充分利用现代CPU特性

## 📦 安装

```bash
pnpm add @leolee9086/better-binary-quantization
```

## 🔧 使用

### 基本用法

```typescript
import { 
  createBinaryQuantizationFormat, 
  quickQuantize, 
  quickSearch,
  VectorSimilarityFunction 
} from '@leolee9086/better-binary-quantization';

// 创建量化格式实例
const format = createBinaryQuantizationFormat();

// 准备向量数据
const vectors = [
  new Float32Array([1, 2, 3, 4]),
  new Float32Array([5, 6, 7, 8]),
  new Float32Array([9, 10, 11, 12])
];

// 量化向量集合
const { quantizedVectors, queryQuantizer } = quickQuantize(vectors);

// 搜索最近邻
const queryVector = new Float32Array([1, 2, 3, 4]);
const results = quickSearch(queryVector, vectors, 2);
console.log(results);
// 输出: [{ index: 0, score: 1.0 }, { index: 1, score: 0.8 }]
```

### 自定义配置

```typescript
import { createBinaryQuantizationFormat, VectorSimilarityFunction } from '@leolee9086/better-binary-quantization';

const customConfig = {
  queryBits: 8,
  indexBits: 2,
  quantizer: {
    similarityFunction: VectorSimilarityFunction.EUCLIDEAN,
    lambda: 0.2,
    iters: 10
  }
};

const format = createBinaryQuantizationFormat(customConfig);
```

### 计算量化精度

```typescript
import { computeAccuracy } from '@leolee9086/better-binary-quantization';

const originalVectors = [/* 原始向量 */];
const queryVectors = [/* 查询向量 */];

const accuracy = computeAccuracy(originalVectors, queryVectors);
console.log(accuracy);
// 输出: { meanError: 0.05, maxError: 0.1, minError: 0.01, stdError: 0.02, correlation: 0.95 }
```

## 🧪 测试

```bash
# 运行所有测试
pnpm test

# 运行测试并生成覆盖率报告
pnpm test:coverage

# 运行性能基准测试
pnpm bench

# 类型检查
pnpm type-check
```

## 📊 性能基准

### 向量操作性能 (1000维向量)
- `computeDotProduct`: ~0.1ms
- `computeEuclideanDistance`: ~0.2ms
- `computeCosineSimilarity`: ~0.3ms
- `normalizeVector`: ~0.1ms

### 量化性能
- 100个128维向量量化: ~5ms
- 1000个256维向量量化: ~50ms

### 搜索性能
- 1000个目标向量，k=10: ~2ms
- 1000个目标向量，k=100: ~8ms

## 🔧 开发

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 开发脚本

```bash
# 安装依赖
pnpm install

# 开发模式 (监听文件变化)
pnpm dev

# 构建项目
pnpm build

# 代码检查
pnpm lint

# 自动修复代码格式
pnpm lint:fix

# 清理构建文件
pnpm clean
```

### 项目结构

```
src/
├── index.ts                 # 主入口文件
├── types.ts                 # 类型定义
├── constants.ts             # 常量定义
├── utils.ts                 # 工具函数
├── vectorUtil.ts            # 向量操作工具
├── optimizedScalarQuantizer.ts  # 优化的标量量化器
├── binaryQuantizedScorer.ts     # 二值量化评分器
└── binaryQuantizationFormat.ts  # 二值量化格式

tests/
├── index.test.ts            # 主入口测试
├── types.test.ts            # 类型定义测试
├── utils.test.ts            # 工具函数测试
└── benchmarks/
    └── performance.bench.ts # 性能基准测试
```

## 📝 API 文档

### 主要函数

#### `createBinaryQuantizationFormat(config?)`
创建二值量化格式实例。

**参数:**
- `config` (可选): 量化配置对象

**返回:** `BinaryQuantizationFormat` 实例

#### `quickQuantize(vectors, similarityFunction?)`
快速量化向量集合。

**参数:**
- `vectors`: `Float32Array[]` - 向量集合
- `similarityFunction` (可选): `VectorSimilarityFunction` - 相似性函数

**返回:** 量化结果对象

#### `quickSearch(queryVector, targetVectors, k, similarityFunction?)`
快速搜索最近邻。

**参数:**
- `queryVector`: `Float32Array` - 查询向量
- `targetVectors`: `Float32Array[]` - 目标向量集合
- `k`: `number` - 返回结果数量
- `similarityFunction` (可选): `VectorSimilarityFunction` - 相似性函数

**返回:** 最近邻结果数组

#### `computeAccuracy(originalVectors, queryVectors, similarityFunction?)`
计算量化精度。

**参数:**
- `originalVectors`: `Float32Array[]` - 原始向量集合
- `queryVectors`: `Float32Array[]` - 查询向量集合
- `similarityFunction` (可选): `VectorSimilarityFunction` - 相似性函数

**返回:** 精度统计对象

### 类型定义

#### `VectorSimilarityFunction`
```typescript
enum VectorSimilarityFunction {
  EUCLIDEAN = 'EUCLIDEAN',
  COSINE = 'COSINE',
  MAXIMUM_INNER_PRODUCT = 'MAXIMUM_INNER_PRODUCT'
}
```

#### `BinaryQuantizationConfig`
```typescript
interface BinaryQuantizationConfig {
  queryBits?: number;
  indexBits?: number;
  quantizer: QuantizerConfig;
}
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发流程

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 编写完整的测试用例
- 添加 JSDoc 注释

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- 基于 [Apache Lucene](https://lucene.apache.org/) 的二值量化实现
- 感谢所有贡献者的支持

## 📞 联系方式

- 项目主页: [https://github.com/leolee9086/better-binary-quantization](https://github.com/leolee9086/better-binary-quantization)
- 问题反馈: [https://github.com/leolee9086/better-binary-quantization/issues](https://github.com/leolee9086/better-binary-quantization/issues)

## 赞赏

如果这个项目帮到了你，可以请我喝杯咖啡：

![赞赏码](assets/sponsor-qr.png)

也欢迎通过 [爱发电](https://afdian.net/a/leolee9086) 支持。