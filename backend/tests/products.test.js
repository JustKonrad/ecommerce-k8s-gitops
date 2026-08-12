const request = require('supertest');
const app = require('../src/index');

describe('Products API', () => {
  it('should GET all products', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toBe(200);
    expect(res.body.products).toBeDefined();
  });
  it('should GET a product by ID', async () => {
    const res = await request(app).get('/api/products/1');
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(1);
  });
  it('should POST a new product', async () => {
    const res = await request(app).post('/api/products').send({ name: 'Test Product', price: 99.99, description: 'A test product' });
    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('Test Product');
  });
  it('should GET /health endpoint', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
  });
});
