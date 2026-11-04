/** Swagger examples for GET /route/status/{jobId}, one per outcome. */
const JOB = {
  jobId: '7b3e5a52-1f0c-4c55-9d1e-6a2f3c8b9e10',
  createdAt: '2026-11-04T16:43:20.498Z',
  startedAt: '2026-11-04T16:43:20.499Z',
  completedAt: '2026-11-04T16:43:20.500Z',
};
const GRAPH_ID = '3f1c2b9e-8d4a-4c6e-9b7a-2e5f1d0c8a41';

function failed(summary: string, error: Record<string, unknown>) {
  return { summary, value: { ...JOB, status: 'FAILED', error } };
}

export const STATUS_EXAMPLES = {
  completed: {
    summary: 'COMPLETED: waypoint C at 08:00 (peak)',
    value: {
      ...JOB,
      status: 'COMPLETED',
      result: {
        graphId: GRAPH_ID,
        totalCost: 39.5,
        path: ['A', 'C', 'D', 'E'],
        durationMs: 0.86,
        legs: [
          { from: 'A', to: 'C', path: ['A', 'C'], cost: 22.5 },
          { from: 'C', to: 'E', path: ['C', 'D', 'E'], cost: 17 },
        ],
      },
    },
  },
  pending: {
    summary: 'PENDING: not started yet',
    value: {
      jobId: JOB.jobId,
      createdAt: JOB.createdAt,
      status: 'PENDING',
    },
  },
  invalidNode: failed('FAILED: INVALID_NODE', {
    code: 'INVALID_NODE',
    message: 'Unknown node(s): X',
    unknownNodes: ['X'],
  }),
  unreachable: failed('FAILED: UNREACHABLE', {
    code: 'UNREACHABLE',
    message: 'No route from E to A (leg 1 of 1)',
    failedLeg: { index: 0, from: 'E', to: 'A' },
  }),
  constraints: failed('FAILED: CONSTRAINTS_BLOCK_ROUTE', {
    code: 'CONSTRAINTS_BLOCK_ROUTE',
    message:
      "Vehicle can't reach E from A: blocked by weight limit (leg 1 of 1)",
    failedLeg: { index: 0, from: 'A', to: 'E' },
    blockedBy: ['WEIGHT'],
  }),
  internal: failed('FAILED: INTERNAL_ERROR', {
    code: 'INTERNAL_ERROR',
    message: 'Unexpected error while calculating the route',
  }),
};
