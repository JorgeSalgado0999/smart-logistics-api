# Smart Logistics Routing API

REST API that finds optimal routes on a logistics network. The original exercise brief is in [instructions.md](instructions.md).

## Stack

- NestJS 12 with TypeScript (strict, ESM)
- Jest for tests
- Swagger (OpenAPI) generated from code
- Storage: in-memory (default) or MongoDB

## Getting started

```bash
npm install
npm run start:dev
```

The server listens on `PORT`, or 3000 by default.

- Swagger UI: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs-json

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
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests (in-memory storage) |
| `npm run test:e2e:mongo` | Run end-to-end tests against MongoDB |
| `npm run test:cov` | Run unit tests with coverage |
| `npm run lint` | Run oxlint |

`npm test` and `npm run test:e2e` need no database. `npm run test:e2e:mongo` needs MongoDB running and fails if it can't connect. It uses `mongodb://127.0.0.1:27017`, or `TEST_MONGO_URI` when set, and works in throwaway databases (`smart_logistics_test*`) that it drops. It never reads `MONGO_URI`, so it can't touch the app's data.

Jest runs with `--experimental-vm-modules` because the project is ESM, so each run prints an `ExperimentalWarning`. To use `jest.fn()` and similar in a test, add `import { jest } from '@jest/globals'`.

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
- [ ] Async jobs: `POST /route/optimize/{id}`, `GET /route/status/{jobId}`
- [ ] Error handling in job results
