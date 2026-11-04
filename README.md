# Smart Logistics Routing API

REST API that finds optimal routes on a logistics network. The original exercise brief is in [instructions.md](instructions.md).

## Stack

- NestJS 12 with TypeScript (strict, ESM)
- Jest for tests
- Swagger (OpenAPI) generated from code

## Getting started

```bash
npm install
npm run start:dev
```

The server listens on `PORT`, or 3000 by default.

- Swagger UI: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs-json

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run start:dev` | Start in watch mode |
| `npm run build` | Compile to `dist/` |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:cov` | Run unit tests with coverage |
| `npm run lint` | Run oxlint |

Jest runs with `--experimental-vm-modules` because the project is ESM, so each run prints an `ExperimentalWarning`. To use `jest.fn()` and similar in a test, add `import { jest } from '@jest/globals'`.

## Progress

- [x] NestJS project setup
- [x] Jest configuration
- [x] Swagger UI at `/docs`
- [ ] Network endpoints: `POST /network/upload`, `GET /network/nodes/{id}`
- [ ] Dijkstra's algorithm with unit tests
- [ ] Vehicle constraints and time-dependent edge costs
- [ ] Multi-stop routing through waypoints
- [ ] Async jobs: `POST /route/optimize/{id}`, `GET /route/status/{jobId}`
- [ ] Error handling in job results
