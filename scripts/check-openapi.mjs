// Checks the OpenAPI document of the compiled app (`dist/`), where the
// Swagger CLI plugin has added DTO schemas. Run with `npm run test:docs`,
// which builds first.
import assert from 'node:assert/strict';

process.env.STORAGE = 'memory';
process.env.NODE_ENV = 'test'; // ignore a local .env

const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');

const app = await NestFactory.create(AppModule, { logger: false });
configureApp(app);
await app.listen(0, '127.0.0.1');
const { port } = app.getHttpServer().address();

const failures = [];
function check(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${error.message.split('\n')[0]}`);
  }
}

try {
  const res = await fetch(`http://127.0.0.1:${port}/docs-json`);
  assert.equal(res.status, 200);
  const doc = await res.json();
  const s = doc.components.schemas;
  const props = (name) => s[name]?.properties ?? {};

  check('edges reference EdgeDto', () =>
    assert.deepEqual(props('UploadNetworkDto').edges.items, {
      $ref: '#/components/schemas/EdgeDto',
    }),
  );
  check('EdgeDto requires from, to, cost', () =>
    assert.deepEqual(s.EdgeDto.required.sort(), ['cost', 'from', 'to']),
  );
  check('EdgeDto cost has minimum 0', () =>
    assert.equal(props('EdgeDto').cost.minimum, 0),
  );
  check('maxWeight and trafficMultiplier are > 0, not >= 1', () => {
    for (const field of ['maxWeight', 'trafficMultiplier']) {
      assert.equal(props('EdgeDto')[field].minimum, 0);
      assert.equal(props('EdgeDto')[field].exclusiveMinimum, true);
    }
  });
  check('OptimizeRouteDto required fields', () =>
    assert.deepEqual(s.OptimizeRouteDto.required.sort(), [
      'departureTime',
      'destinationNodeId',
      'originNodeId',
      'vehicleProfile',
    ]),
  );
  check('departureTime has the HH:MM pattern', () =>
    assert.equal(
      props('OptimizeRouteDto').departureTime.pattern,
      '^([01]\\d|2[0-3]):([0-5]\\d)$',
    ),
  );
  check('vehicleProfile references VehicleProfileDto', () =>
    assert.equal(
      props('OptimizeRouteDto').vehicleProfile.$ref,
      '#/components/schemas/VehicleProfileDto',
    ),
  );
  check('VehicleProfileDto requires type, weight, hazardous', () =>
    assert.deepEqual(s.VehicleProfileDto.required.sort(), [
      'hazardous',
      'type',
      'weight',
    ]),
  );
  check('job status enum', () =>
    assert.deepEqual(props('RouteStatusResponseDto').status.enum, [
      'PENDING',
      'PROCESSING',
      'COMPLETED',
      'FAILED',
    ]),
  );
  check('job error code enum', () =>
    assert.deepEqual(props('RouteErrorDto').code.enum, [
      'INVALID_NODE',
      'UNREACHABLE',
      'CONSTRAINTS_BLOCK_ROUTE',
      'INTERNAL_ERROR',
    ]),
  );
  check('error details fields', () => {
    assert.ok(props('RouteErrorDto').unknownNodes);
    assert.ok(props('RouteErrorDto').failedLeg);
    assert.deepEqual(props('RouteErrorDto').blockedBy.items.enum, [
      'WEIGHT',
      'HAZARDOUS',
    ]);
  });
  check('result has path, totalCost, durationMs, legs', () =>
    assert.deepEqual(s.RouteResultDto.required.sort(), [
      'durationMs',
      'graphId',
      'legs',
      'path',
      'totalCost',
    ]),
  );
  check('every 400 and 404 uses ErrorResponseDto', () => {
    for (const [path, methods] of Object.entries(doc.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        for (const code of ['400', '404']) {
          const response = op.responses[code];
          if (!response) continue;
          assert.equal(
            response.content?.['application/json']?.schema?.$ref,
            '#/components/schemas/ErrorResponseDto',
            `${method.toUpperCase()} ${path} ${code}`,
          );
        }
      }
    }
  });
  check('status endpoint has an example per outcome', () =>
    assert.deepEqual(
      Object.keys(
        doc.paths['/route/status/{jobId}'].get.responses['200'].content[
          'application/json'
        ].examples,
      ),
      [
        'completed',
        'pending',
        'invalidNode',
        'unreachable',
        'constraints',
        'internal',
      ],
    ),
  );
} finally {
  await app.close();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} OpenAPI check(s) failed`);
  process.exit(1);
}
console.log('\nOpenAPI document OK');
