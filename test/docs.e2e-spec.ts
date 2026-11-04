import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

/**
 * Checks Swagger serves every endpoint with its status codes. DTO schemas
 * come from the Swagger CLI plugin, which only runs in `nest build`, so
 * `npm run test:docs` checks those against the compiled app.
 */
describe('Swagger docs (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves Swagger UI at /docs', async () => {
    const res = await request(app.getHttpServer()).get('/docs').expect(200);

    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Swagger UI');
  });

  it('lists every endpoint with its status codes', async () => {
    const res = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const doc = res.body as {
      paths: Record<string, Record<string, { responses: object }>>;
    };

    const endpoints = Object.fromEntries(
      Object.entries(doc.paths).flatMap(([path, methods]) =>
        Object.entries(methods).map(([method, op]) => [
          `${method.toUpperCase()} ${path}`,
          Object.keys(op.responses).sort(),
        ]),
      ),
    );
    expect(endpoints).toEqual({
      'POST /network/upload': ['201', '400'],
      'GET /network/nodes/{id}': ['200', '400', '404'],
      'POST /route/optimize/{id}': ['202', '400', '404'],
      'GET /route/status/{jobId}': ['200', '400', '404'],
    });
  });
});
