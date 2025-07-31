/**
 * 通用最小堆实现
 * 用于高效的topK选择算法
 */

/**
 * 最小堆类，支持自定义比较函数
 */
export class MinHeap<T> {
  private heap: T[] = [];
  private compareFn: (a: T, b: T) => number;

  /**
   * 创建最小堆实例
   * @param compareFn 比较函数，返回负数表示a < b，返回正数表示a > b
   */
  constructor(compareFn: (a: T, b: T) => number = (a: T, b: T) => (a as any) - (b as any)) {
    this.compareFn = compareFn;
  }
  
  /**
   * 获取堆的大小
   */
  size(): number {
    return this.heap.length;
  }
  
  /**
   * 检查堆是否为空
   */
  isEmpty(): boolean {
    return this.heap.length === 0;
  }
  
  /**
   * 查看堆顶元素（最小值）
   */
  peek(): T | undefined {
    return this.heap[0];
  }
  
  /**
   * 向堆中添加元素
   */
  push(item: T): void {
    this.heap.push(item);
    this._bubbleUp();
  }
  
  /**
   * 移除并返回堆顶元素（最小值）
   */
  pop(): T | null {
    if (this.isEmpty()) return null;
    
    const min = this.heap[0]!;
    const last = this.heap.pop()!;
    
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._bubbleDown();
    }
    
    return min;
  }
  
  /**
   * 向上冒泡调整堆结构
   */
  private _bubbleUp(): void {
    let index = this.heap.length - 1;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const current = this.heap[index]!;
      const parent = this.heap[parentIndex]!;
      if (this.compareFn(current, parent) >= 0) break;
      
      [this.heap[index], this.heap[parentIndex]] = [parent, current];
      index = parentIndex;
    }
  }
  
  /**
   * 向下冒泡调整堆结构
   */
  private _bubbleDown(): void {
    let index = 0;
    while (true) {
      let smallest = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      
      if (leftChild < this.heap.length) {
        const left = this.heap[leftChild]!;
        const current = this.heap[smallest]!;
        if (this.compareFn(left, current) < 0) {
          smallest = leftChild;
        }
      }
      
      if (rightChild < this.heap.length) {
        const right = this.heap[rightChild]!;
        const current = this.heap[smallest]!;
        if (this.compareFn(right, current) < 0) {
          smallest = rightChild;
        }
      }
      
      if (smallest === index) break;
      
      const temp = this.heap[index]!;
      this.heap[index] = this.heap[smallest]!;
      this.heap[smallest] = temp;
      index = smallest;
    }
  }
  
  /**
   * 将堆转换为排序后的数组
   */
  toArray(): T[] {
    return [...this.heap].sort(this.compareFn);
  }
  
  /**
   * 清空堆
   */
  clear(): void {
    this.heap = [];
  }
} 