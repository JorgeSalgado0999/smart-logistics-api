interface HeapEntry<T> {
  readonly priority: number;
  /** Insertion counter, so equal priorities come out first-in, first-out. */
  readonly order: number;
  readonly value: T;
}

/** Binary min-heap keyed by a numeric priority. */
export class MinHeap<T> {
  private readonly entries: HeapEntry<T>[] = [];
  private inserted = 0;

  get size(): number {
    return this.entries.length;
  }

  push(value: T, priority: number): void {
    this.entries.push({ priority, order: this.inserted++, value });
    this.siftUp(this.entries.length - 1);
  }

  /** Removes and returns the lowest-priority entry, or undefined when empty. */
  pop(): { value: T; priority: number } | undefined {
    const top = this.entries[0];
    if (top === undefined) return undefined;

    const last = this.entries.pop()!;
    if (this.entries.length > 0) {
      this.entries[0] = last;
      this.siftDown(0);
    }
    return { value: top.value, priority: top.priority };
  }

  private less(i: number, j: number): boolean {
    const a = this.entries[i];
    const b = this.entries[j];
    return (
      a.priority < b.priority ||
      (a.priority === b.priority && a.order < b.order)
    );
  }

  private swap(i: number, j: number): void {
    [this.entries[i], this.entries[j]] = [this.entries[j], this.entries[i]];
  }

  private siftUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) return;
      this.swap(i, parent);
      i = parent;
    }
  }

  private siftDown(index: number): void {
    let i = index;
    const n = this.entries.length;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < n && this.less(left, smallest)) smallest = left;
      if (right < n && this.less(right, smallest)) smallest = right;
      if (smallest === i) return;
      this.swap(i, smallest);
      i = smallest;
    }
  }
}
