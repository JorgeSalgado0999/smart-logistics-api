import { MinHeap } from './min-heap.js';

describe('MinHeap', () => {
  it('pops entries in priority order', () => {
    const heap = new MinHeap<string>();
    heap.push('c', 3);
    heap.push('a', 1);
    heap.push('b', 2);

    expect(heap.pop()).toEqual({ value: 'a', priority: 1 });
    expect(heap.pop()).toEqual({ value: 'b', priority: 2 });
    expect(heap.pop()).toEqual({ value: 'c', priority: 3 });
  });

  it('returns undefined when empty', () => {
    const heap = new MinHeap<string>();

    expect(heap.pop()).toBeUndefined();
    heap.push('a', 1);
    heap.pop();
    expect(heap.pop()).toBeUndefined();
  });

  it('tracks its size', () => {
    const heap = new MinHeap<number>();
    expect(heap.size).toBe(0);
    heap.push(1, 1);
    heap.push(2, 2);
    expect(heap.size).toBe(2);
    heap.pop();
    expect(heap.size).toBe(1);
  });

  it('pops equal priorities first-in, first-out', () => {
    const heap = new MinHeap<string>();
    for (const value of ['first', 'second', 'third', 'fourth']) {
      heap.push(value, 5);
    }
    heap.push('lower', 1);

    const out = [];
    while (heap.size > 0) out.push(heap.pop()!.value);
    expect(out).toEqual(['lower', 'first', 'second', 'third', 'fourth']);
  });

  it('sorts 1,000 scrambled priorities, including duplicates', () => {
    const heap = new MinHeap<number>();
    const priorities = Array.from({ length: 1000 }, (_, i) => (i * 7919) % 211);
    priorities.forEach((p) => heap.push(p, p));

    const out = [];
    while (heap.size > 0) out.push(heap.pop()!.priority);
    expect(out).toEqual([...priorities].sort((a, b) => a - b));
  });
});
