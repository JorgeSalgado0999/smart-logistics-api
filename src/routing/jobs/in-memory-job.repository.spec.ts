import { InMemoryJobRepository } from './in-memory-job.repository.js';
import type { JobStatus, RouteJob } from './route-job.types.js';

const START = new Date('2026-01-01T00:00:00Z').getTime();
const MINUTE = 60_000;

/** Clock the test moves by hand. */
function fakeClock() {
  let now = START;
  return {
    clock: () => new Date(now),
    advance: (ms: number) => {
      now += ms;
    },
  };
}

function job(id: string, status: JobStatus, completedAt?: number): RouteJob {
  return {
    id,
    graphId: 'g',
    status,
    createdAt: new Date(START),
    completedAt: completedAt === undefined ? undefined : new Date(completedAt),
  };
}

describe('InMemoryJobRepository', () => {
  it('reads back a saved job', async () => {
    const { clock } = fakeClock();
    const repo = new InMemoryJobRepository(
      { ttlMs: MINUTE, maxJobs: 10 },
      clock,
    );
    await repo.save(job('j1', 'PENDING'));

    expect(await repo.findById('j1')).toEqual(job('j1', 'PENDING'));
  });

  it('returns undefined for an unknown id', async () => {
    const { clock } = fakeClock();
    const repo = new InMemoryJobRepository(
      { ttlMs: MINUTE, maxJobs: 10 },
      clock,
    );

    expect(await repo.findById('missing')).toBeUndefined();
  });

  it('replaces a job saved again with the same id', async () => {
    const { clock } = fakeClock();
    const repo = new InMemoryJobRepository(
      { ttlMs: MINUTE, maxJobs: 10 },
      clock,
    );
    await repo.save(job('j1', 'PENDING'));
    await repo.save(job('j1', 'PROCESSING'));

    expect((await repo.findById('j1'))?.status).toBe('PROCESSING');
  });

  it('expires a finished job once ttl has passed since completion', async () => {
    const { clock, advance } = fakeClock();
    const repo = new InMemoryJobRepository(
      { ttlMs: MINUTE, maxJobs: 10 },
      clock,
    );
    await repo.save(job('j1', 'COMPLETED', START));

    advance(MINUTE - 1);
    expect(await repo.findById('j1')).toBeDefined();
    advance(1);
    expect(await repo.findById('j1')).toBeUndefined();
  });

  it('never expires unfinished jobs', async () => {
    const { clock, advance } = fakeClock();
    const repo = new InMemoryJobRepository(
      { ttlMs: MINUTE, maxJobs: 10 },
      clock,
    );
    await repo.save(job('pending', 'PENDING'));
    await repo.save(job('processing', 'PROCESSING'));

    advance(10 * MINUTE);
    await repo.save(job('trigger', 'PENDING'));

    expect(await repo.findById('pending')).toBeDefined();
    expect(await repo.findById('processing')).toBeDefined();
  });

  it('removes expired jobs on save, not only on read', async () => {
    const { clock, advance } = fakeClock();
    const repo = new InMemoryJobRepository(
      { ttlMs: MINUTE, maxJobs: 2 },
      clock,
    );
    await repo.save(job('old', 'FAILED', START));
    await repo.save(job('keep', 'PENDING'));

    advance(MINUTE);
    // Over the cap only if 'old' was still stored.
    await repo.save(job('new', 'PENDING'));

    expect(await repo.findById('keep')).toBeDefined();
    expect(await repo.findById('new')).toBeDefined();
  });

  it('over the cap, drops the oldest finished job first', async () => {
    const { clock } = fakeClock();
    const repo = new InMemoryJobRepository(
      { ttlMs: MINUTE, maxJobs: 3 },
      clock,
    );
    await repo.save(job('running', 'PROCESSING'));
    await repo.save(job('done-1', 'COMPLETED', START));
    await repo.save(job('done-2', 'FAILED', START));
    await repo.save(job('new', 'PENDING'));

    expect(await repo.findById('running')).toBeDefined();
    expect(await repo.findById('done-1')).toBeUndefined();
    expect(await repo.findById('done-2')).toBeDefined();
    expect(await repo.findById('new')).toBeDefined();
  });

  it('keeps unfinished jobs even when they alone exceed the cap', async () => {
    const { clock } = fakeClock();
    const repo = new InMemoryJobRepository(
      { ttlMs: MINUTE, maxJobs: 2 },
      clock,
    );
    for (const id of ['a', 'b', 'c']) await repo.save(job(id, 'PENDING'));

    for (const id of ['a', 'b', 'c']) {
      expect(await repo.findById(id)).toBeDefined();
    }
  });

  it.each([
    { ttlMs: 0, maxJobs: 1 },
    { ttlMs: MINUTE, maxJobs: 0 },
    { ttlMs: MINUTE, maxJobs: 1.5 },
    { ttlMs: Number.NaN, maxJobs: 1 },
  ])('rejects invalid limits %p', (limits) => {
    expect(() => new InMemoryJobRepository(limits, () => new Date())).toThrow();
  });
});
