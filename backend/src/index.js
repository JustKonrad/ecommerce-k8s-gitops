const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Counter, Histogram, register } = require('prom-client');

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status']
});

const productOperations = new Counter({
  name: 'product_operations_total',
  help: 'Total product operations',
  labelNames: ['operation', 'status']
});

const requestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    httpRequests.labels(req.method, route, res.statusCode).inc();
    requestDuration.labels(req.method, route).observe(duration);
  });
  next();
});

let products = [
  { id: 1, name: 'Laptop Pro', price: 1299.99, category: 'Electronics', description: 'High-performance laptop', stock: 10 },
  { id: 2, name: 'Wireless Mouse', price: 29.99, category: 'Accessories', description: 'Ergonomic wireless mouse', stock: 50 },
  { id: 3, name: 'USB-C Hub', price: 49.99, category: 'Accessories', description: 'Multi-port USB-C hub', stock: 30 },
  { id: 4, name: '4K Monitor', price: 449.99, category: 'Electronics', description: '27-inch 4K monitor', stock: 15 }
];

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/ready', (req, res) => {
  res.json({ ready: true, timestamp: new Date().toISOString() });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/api/products', (req, res) => {
  const { category, minPrice, maxPrice, search } = req.query;
  let filtered = products;
  if (category) filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
  if (minPrice) filtered = filtered.filter(p => p.price >= parseFloat(minPrice));
  if (maxPrice) filtered = filtered.filter(p => p.price <= parseFloat(maxPrice));
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s));
  }
  productOperations.labels('GET', 'success').inc();
  res.json({ count: filtered.length, products: filtered });
});

app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) {
    productOperations.labels('GET_BY_ID', 'not_found').inc();
    return res.status(404).json({ error: 'Product not found' });
  }
  productOperations.labels('GET_BY_ID', 'success').inc();
  res.json(product);
});

app.post('/api/products', (req, res) => {
  const { name, price, category, description, stock } = req.body;
  if (!name || !price || !description) return res.status(400).json({ error: 'Missing required fields' });
  if (typeof price !== 'number' || price <= 0) return res.status(400).json({ error: 'Price must be a positive number' });
  const newProduct = {
    id: Math.max(...products.map(p => p.id), 0) + 1,
    name, price, category: category || 'Other', description, stock: stock || 0
  };
  products.push(newProduct);
  productOperations.labels('POST', 'success').inc();
  res.status(201).json(newProduct);
});

app.put('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (req.body.name) product.name = req.body.name;
  if (req.body.price) product.price = req.body.price;
  if (req.body.category) product.category = req.body.category;
  if (req.body.description) product.description = req.body.description;
  if (req.body.stock !== undefined) product.stock = req.body.stock;
  productOperations.labels('PUT', 'success').inc();
  res.json(product);
});

app.delete('/api/products/:id', (req, res) => {
  const index = products.findIndex(p => p.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Product not found' });
  const deleted = products.splice(index, 1)[0];
  productOperations.labels('DELETE', 'success').inc();
  res.json(deleted);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`E-Commerce API listening on port ${PORT} [${NODE_ENV}]`);
  });
}

module.exports = app;
