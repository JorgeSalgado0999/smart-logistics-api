# Smart Logistics Routing API

REST API that finds the cheapest route across a logistics network. It uses Dijkstra's algorithm, skips roads a vehicle can't use, raises costs at peak hours, visits waypoints in order, and runs each calculation as an async job. The original exercise brief is in [instructions.md](instructions.md).

## Stack

- NestJS 12 with TypeScript (strict, ESM)
- Jest for unit and end-to-end tests
- Swagger (OpenAPI) generated from the code
- Storage: in-memory (default) or MongoDB

## Quick start

Developed and tested on Node.js 24.

```bash
npm install
npm run start:dev
```

- API: http://localhost:3000
- Swagger UI: http://localhost:3000/docs (OpenAPI JSON at `/docs-json`)

Try the whole flow with the brief's validation graph (needs only `curl` and `sed`):

```bash
API=http://localhost:3000

# 1. Upload the graph; keep its id
GRAPH=$(curl -s -H 'Content-Type: application/json' -d '{"edges":[
  {"from":"A","to":"B","cost":10,"maxWeight":10000,"noHazardous":false,"trafficMultiplier":1.0},
  {"from":"A","to":"C","cost":15,"maxWeight":5000,"noHazardous":true,"trafficMultiplier":1.5},
  {"from":"B","to":"D","cost":12,"maxWeight":10000,"noHazardous":false,"trafficMultiplier":2.0},
  {"from":"C","to":"D","cost":5,"maxWeight":5000,"noHazardous":true,"trafficMultiplier":1.0},
  {"from":"D","to":"E","cost":10,"maxWeight":8000,"noHazardous":false,"trafficMultiplier":1.2}
]}' $API/network/upload | sed -E 's/.*"id":"([^"]+)".*/\1/')

# 2. Start a route calculation (Test Case 1); keep the job id
JOB=$(curl -s -H 'Content-Type: application/json' -d '{
  "originNodeId":"A","destinationNodeId":"E",
  "vehicleProfile":{"type":"van","weight":3000,"hazardous":false},
  "departureTime":"12:00"
}' $API/route/optimize/$GRAPH | sed -E 's/.*"jobId":"([^"]+)".*/\1/')

# 3. Poll for the result
curl -s $API/route/status/$JOB
# {"jobId":"…","status":"COMPLETED",…,"result":{"graphId":"…","totalCost":30,"path":["A","C","D","E"],…}}
```

## API

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/network/upload` | Store a graph of directed edges. Returns `201 { id }` |
| `GET` | `/network/nodes/{id}` | List a graph's nodes |
| `POST` | `/route/optimize/{id}` | Start a route calculation. Returns `202 { jobId }` right away |
| `GET` | `/route/status/{jobId}` | Job status, plus the route once `COMPLETED` or the error once `FAILED` |
| `GET` | `/docs` | Swagger UI |

Invalid input returns `400` with one message per broken rule, unknown fields included. An unknown or evicted graph, or an unknown or expired job, returns `404`. Ids must be UUIDs.

### Graphs

```json
{ "edges": [{ "from": "A", "to": "B", "cost": 10, "maxWeight": 5000, "noHazardous": true, "trafficMultiplier": 1.5 }] }
```

- `from`, `to` and `cost` (≥ 0) are required. `maxWeight` (no limit if absent), `noHazardous` (default `false`) and `trafficMultiplier` (default `1`) are optional.
- Edges are **directed**: `A → B` doesn't allow `B → A`.
- Nodes come from the edges, in the order they first appear.

### Route requests

```json
{
  "originNodeId": "A",
  "destinationNodeId": "E",
  "waypoints": ["C"],
  "vehicleProfile": { "type": "truck", "weight": 4000, "hazardous": false },
  "departureTime": "08:00"
}
```

- `vehicleProfile` and `departureTime` (24-hour `HH:MM`) are required. `waypoints` is optional, up to 100.
- **Vehicle constraints:** an edge is skipped when the vehicle's weight is over its `maxWeight` (equal is allowed), or when the vehicle is hazardous and the edge is `noHazardous`.
- **Peak hours:** departing 07:00-09:00 or 17:00-19:00 (start included, end excluded) multiplies each edge's cost by its `trafficMultiplier`.
- **Waypoints** are visited in the given order. Each leg is solved with Dijkstra and the legs are joined into one path.

### Async jobs

1. `POST /route/optimize/{id}` checks the body and that the graph exists, creates a `PENDING` job, and returns `202`.
2. The job runs on a later turn of the event loop: `PROCESSING`, then `COMPLETED` or `FAILED`.
3. `GET /route/status/{jobId}` returns the job:

```json
{
  "jobId": "…", "status": "COMPLETED",
  "createdAt": "…", "startedAt": "…", "completedAt": "…",
  "result": {
    "graphId": "…", "totalCost": 39.5, "path": ["A", "C", "D", "E"], "durationMs": 0.86,
    "legs": [
      { "from": "A", "to": "C", "path": ["A", "C"], "cost": 22.5 },
      { "from": "C", "to": "E", "path": ["C", "D", "E"], "cost": 17 }
    ]
  }
}
```

A `FAILED` job has `error` instead of `result`:

| Code | Meaning | Extra fields | Example message |
| :--- | :--- | :--- | :--- |
| `INVALID_NODE` | Origin, destination or a waypoint isn't in the graph | `unknownNodes` | `Unknown node(s): X, Y` |
| `UNREACHABLE` | No path exists for a leg, whatever the vehicle | `failedLeg` | `No route from E to A (leg 1 of 1)` |
| `CONSTRAINTS_BLOCK_ROUTE` | A path exists, but the vehicle may not use it | `failedLeg`, `blockedBy` (`WEIGHT`, `HAZARDOUS`) | `Vehicle can't reach E from A: blocked by weight limit (leg 1 of 1)` |
| `INTERNAL_ERROR` | Unexpected failure; details are logged, not returned | none | `Unexpected error while calculating the route` |

## Validation cases

The brief's cases, plus the other behaviours, each run as unit tests and again end to end (upload, optimize, poll):

| Case | Request | Expected | Tests |
| :--- | :--- | :--- | :--- |
| Test Case 1: standard path | van 3000, 12:00 | A → C → D → E, cost 30 | `edge-weight.spec.ts`, `route-planner.spec.ts`, `route.e2e-spec.ts` |
| Test Case 2: weight constraint | truck 6000, 12:00 | A → B → D → E, cost 32 | same |
| Test Case 3: hazardous constraint | truck 3000 hazardous, 12:00 | A → B → D → E, cost 32 | same |
| Peak hour | van 3000, 08:00 | A → C → D → E, cost 39.5 (22.5 + 5 + 12) | same |
| Waypoint | waypoint B, 12:00 | A → B → D → E, cost 32 | `multi-stop.spec.ts`, `route-planner.spec.ts`, `route.e2e-spec.ts` |
| Image in `docs/resources` | 1 → 6 | 1 → 2 → 4 → 5 → 6, cost 18 | `dijkstra.spec.ts` |
| Errors | unknown node, E → A, truck 9000, hazardous via C | each error code above | `route-planner.spec.ts`, `route.e2e-spec.ts` |

Dijkstra is also checked against a Bellman-Ford reference on 200 seeded random graphs.

## Configuration

Settings come from environment variables or a `.env` file (copy [.env.example](.env.example)). All are optional. Invalid values stop the app at startup with a message listing every problem.

| Variable | Values | Default |
| :--- | :--- | :--- |
| `STORAGE` | `memory` or `mongo` | `memory` |
| `MONGO_URI` | `mongodb://` or `mongodb+srv://` URI; required when `STORAGE=mongo` | none |
| `MONGO_DB` | Database name | `smart_logistics` |
| `PORT` | 1-65535 | `3000` |

## Storage

- **`memory`**: keeps the last 5 uploaded graphs, as the brief asks. A 6th upload removes the oldest. Data is lost on restart.
- **`mongo`**: keeps every graph in the `graphs` collection, using the graph's UUID as `_id`. If MongoDB can't be reached within 5 seconds, startup fails instead of falling back to memory.

Route jobs are always kept in memory (see [Design notes](#design-notes)).

### Running MongoDB locally

Any one of these gives you MongoDB on `127.0.0.1:27017`:

- **Docker**: `docker compose up -d`
- **Homebrew**: `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`
- **Official binary**: download the server from https://www.mongodb.com/try/download/community, then run `mongod --dbpath <data dir> --bind_ip 127.0.0.1`

Then start the API with Mongo:

```bash
STORAGE=mongo MONGO_URI=mongodb://127.0.0.1:27017 npm run start:dev
```

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run start:dev` | Start in watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled app |
| `npm test` | Unit tests |
| `npm run test:cov` | Unit tests with coverage |
| `npm run test:e2e` | End-to-end tests, in-memory storage |
| `npm run test:e2e:mongo` | End-to-end tests against MongoDB |
| `npm run test:docs` | Build, then check the OpenAPI schemas of the compiled app |
| `npm run typecheck` | Type-check everything, specs included |
| `npm run lint` | oxlint |
| `npm run format` | Prettier |

- `npm test`, `npm run test:e2e` and `npm run test:docs` need no database.
- `npm run test:e2e:mongo` needs MongoDB and fails if it can't connect. It uses `mongodb://127.0.0.1:27017`, or `TEST_MONGO_URI` when set, and works in throwaway databases (`smart_logistics_test*`) that it drops. It never reads `MONGO_URI`, so it can't touch the app's data.
- DTO schemas come from the Swagger CLI plugin, which runs only in `nest build`. That is why `test:docs` checks them against `dist/`, while the e2e suite checks endpoints and status codes.
- Jest runs with `--experimental-vm-modules` because the project is ESM, so each run prints an `ExperimentalWarning`. To use `jest.fn()` and similar in a test, add `import { jest } from '@jest/globals'`.

## Project structure

```
src/
  domain/graph.types.ts      Node, Edge, Graph, VehicleProfile
  network/                   upload + nodes endpoints, graph repositories (memory, Mongo)
  routing/
    algorithm/               min-heap, Dijkstra, multi-stop (pure functions)
    constraints/             departure time, peak hours, vehicle rules → edge weight
    route-planner.ts         request → route or error code (pure)
    jobs/                    job types, in-memory job store, scheduler
    route.service.ts         submit and run jobs
    route.controller.ts      optimize + status endpoints
  config/                    environment validation
  database/                  MongoDB connection (only when STORAGE=mongo)
  common/                    shared DTOs
test/                        e2e suites, Mongo test setup
scripts/check-openapi.mjs    OpenAPI schema check for the compiled app
```

The algorithm, constraints and planner have no NestJS or I/O code, so they are tested directly.

## Design notes

- **Dijkstra with a binary heap**, O((V + E) log E). A node gets a new heap entry when a cheaper route to it is found, and stale entries are skipped, instead of updating entries in place. Ties resolve the same way on every run.
- **Constraints plug in as an edge weight function.** The vehicle rules return "can't use", peak hours return `cost × trafficMultiplier`, and Dijkstra itself knows neither.
- **Peak is decided by the departure time only.** The clock doesn't advance along the route, because edge costs have no time unit.
- **A vehicle exactly at `maxWeight` may use the edge.** The brief's wording is "exceeds".
- **Multi-stop** solves each leg separately, which is optimal for the fixed waypoint order the brief asks for. It is not a search for the best order.
- **Error codes are worked out after a failure.** If a leg also fails with no vehicle rules, it is `UNREACHABLE`. Otherwise it is `CONSTRAINTS_BLOCK_ROUTE`, and `blockedBy` names each rule whose removal alone opens a route, or both if only removing both does. Unknown nodes are checked before any search.
- **Bad node ids fail the job rather than the request.** The brief asks for these errors "in the job result". A missing graph is still a `404`, since there is nothing to queue.
- **Costs are rounded to 6 decimals** to drop float noise such as `0.30000000000000004`.
- **Required `vehicleProfile` and `departureTime`** keep results reproducible. A default of "now" would give different routes at different times.
- **Jobs live in memory**, even with Mongo storage. They are short-lived and run in the same process, so persisting them only helps with several instances. Finished jobs expire after 1 hour, and the store holds at most 10,000, dropping the oldest finished first. A job keeps the graph it was submitted with, so eviction can't break it.
- **`setImmediate`, not worker threads.** The response is sent before routing starts. Routing a 90,000-node grid takes about 0.2 s on the main thread, and uploads are capped at 100 kb, so real graphs are far smaller. The scheduler sits behind an interface, so a worker-thread version can replace it.
- **Storage and scheduling are abstract classes** (`GraphRepository`, `JobRepository`, `JobScheduler`) used as DI tokens, so implementations swap without touching services.

## Known limits

- Routing runs on the main thread, so a very large graph would delay other requests while it computes.
- Uploads are limited to Express's default 100 kb body, roughly 1-2k edges.
- Jobs, and in-memory graphs, are lost on restart.
- No authentication or rate limiting.
- `npm audit` reports moderate and low issues in dev tooling (Jest, Nest CLI). The only fixes npm offers downgrade those tools to old major versions, so they are left as is. Production dependencies have none.

## Progress

- [x] NestJS project setup
- [x] Jest configuration
- [x] Swagger UI at `/docs`
- [x] Global request validation (`class-validator`) and Swagger CLI plugin for DTO schemas
- [x] Network endpoints: `POST /network/upload`, `GET /network/nodes/{id}`
- [x] Dijkstra's algorithm with unit tests
- [x] MongoDB storage (optional, `STORAGE=mongo`)
- [x] Vehicle constraints and time-dependent edge costs
- [x] Multi-stop routing through waypoints
- [x] Async jobs: `POST /route/optimize/{id}`, `GET /route/status/{jobId}`
- [x] Error handling in job results
