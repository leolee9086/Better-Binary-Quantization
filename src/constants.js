"use strict";
/**
 * 二值量化系统常量定义
 * 基于Lucene的二值量化实现
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NUMERICAL_CONSTANTS = exports.COMPONENT_NAMES = exports.FILE_EXTENSIONS = exports.MINIMUM_MSE_GRID = exports.DEFAULT_ITERS = exports.DEFAULT_LAMBDA = exports.FOUR_BIT_SCALE = exports.INDEX_BITS = exports.QUERY_BITS = void 0;
/**
 * 查询向量位数 (4位精度)
 */
exports.QUERY_BITS = 4;
/**
 * 索引向量位数 (1位精度)
 */
exports.INDEX_BITS = 1;
/**
 * 4位缩放因子
 * 严格按照Java原版实现：1f / ((1 << 4) - 1)
 */
exports.FOUR_BIT_SCALE = 1.0 / ((1 << 4) - 1);
/**
 * 默认各向异性权重
 */
exports.DEFAULT_LAMBDA = 0.1;
/**
 * 默认优化迭代次数
 */
exports.DEFAULT_ITERS = 5;
/**
 * 最小MSE网格 - 基于均匀分布的最优MSE网格
 * 每个位数的间隔值经过理论推导和数值优化
 * 这些起始点来自均匀分布的最优MSE网格
 * 使用不同的间隔范围来确保不同位数的量化结果不同
 */
exports.MINIMUM_MSE_GRID = [
    [-0.798, 0.798], // 1位: 基于均匀分布的最优MSE间隔
    [-1.493, 1.493], // 2位: 2^2 = 4个量化级别
    [-2.051, 2.051], // 3位: 2^3 = 8个量化级别
    [-2.514, 2.514], // 4位: 2^4 = 16个量化级别
    [-2.916, 2.916], // 5位: 2^5 = 32个量化级别
    [-3.278, 3.278], // 6位: 2^6 = 64个量化级别
    [-3.611, 3.611], // 7位: 2^7 = 128个量化级别
    [-3.922, 3.922] // 8位: 2^8 = 256个量化级别
];
/**
 * 文件扩展名
 */
exports.FILE_EXTENSIONS = {
    /** 向量数据文件 */
    VECTOR_DATA: 'veb',
    /** 元数据文件 */
    META: 'vemb'
};
/**
 * 组件标识符
 */
exports.COMPONENT_NAMES = {
    /** 二值化向量组件 */
    BINARIZED_VECTOR: 'BVEC'
};
/**
 * 数值精度常量
 */
exports.NUMERICAL_CONSTANTS = {
    /** 收敛阈值 */
    CONVERGENCE_THRESHOLD: 1e-8,
    /** 最小行列式值 */
    MIN_DETERMINANT: 1e-12,
    /** 浮点数比较精度 */
    EPSILON: 1e-8
};
