"use strict";
/**
 * 通用最小堆实现
 * 用于高效的topK选择算法
 */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinHeap = void 0;
/**
 * 最小堆类，支持自定义比较函数
 */
var MinHeap = /** @class */ (function () {
    /**
     * 创建最小堆实例
     * @param compareFn 比较函数，返回负数表示a < b，返回正数表示a > b
     */
    function MinHeap(compareFn) {
        if (compareFn === void 0) { compareFn = function (a, b) { return a - b; }; }
        this.heap = [];
        this.compareFn = compareFn;
    }
    /**
     * 获取堆的大小
     */
    MinHeap.prototype.size = function () {
        return this.heap.length;
    };
    /**
     * 检查堆是否为空
     */
    MinHeap.prototype.isEmpty = function () {
        return this.heap.length === 0;
    };
    /**
     * 查看堆顶元素（最小值）
     */
    MinHeap.prototype.peek = function () {
        return this.heap[0];
    };
    /**
     * 向堆中添加元素
     */
    MinHeap.prototype.push = function (item) {
        this.heap.push(item);
        this._bubbleUp();
    };
    /**
     * 移除并返回堆顶元素（最小值）
     */
    MinHeap.prototype.pop = function () {
        if (this.isEmpty())
            return null;
        var min = this.heap[0];
        var last = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = last;
            this._bubbleDown();
        }
        return min;
    };
    /**
     * 向上冒泡调整堆结构
     */
    MinHeap.prototype._bubbleUp = function () {
        var _a;
        var index = this.heap.length - 1;
        while (index > 0) {
            var parentIndex = Math.floor((index - 1) / 2);
            var current = this.heap[index];
            var parent_1 = this.heap[parentIndex];
            if (this.compareFn(current, parent_1) >= 0)
                break;
            _a = [parent_1, current], this.heap[index] = _a[0], this.heap[parentIndex] = _a[1];
            index = parentIndex;
        }
    };
    /**
     * 向下冒泡调整堆结构
     */
    MinHeap.prototype._bubbleDown = function () {
        var index = 0;
        while (true) {
            var smallest = index;
            var leftChild = 2 * index + 1;
            var rightChild = 2 * index + 2;
            if (leftChild < this.heap.length) {
                var left = this.heap[leftChild];
                var current = this.heap[smallest];
                if (this.compareFn(left, current) < 0) {
                    smallest = leftChild;
                }
            }
            if (rightChild < this.heap.length) {
                var right = this.heap[rightChild];
                var current = this.heap[smallest];
                if (this.compareFn(right, current) < 0) {
                    smallest = rightChild;
                }
            }
            if (smallest === index)
                break;
            var temp = this.heap[index];
            this.heap[index] = this.heap[smallest];
            this.heap[smallest] = temp;
            index = smallest;
        }
    };
    /**
     * 将堆转换为排序后的数组
     */
    MinHeap.prototype.toArray = function () {
        return __spreadArray([], this.heap, true).sort(this.compareFn);
    };
    /**
     * 清空堆
     */
    MinHeap.prototype.clear = function () {
        this.heap = [];
    };
    return MinHeap;
}());
exports.MinHeap = MinHeap;
