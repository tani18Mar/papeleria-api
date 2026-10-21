import 'dotenv/config';
import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json({ limit: '1mb' }));

const fields = ['name', 'description', 'category', 'sku', 'price', 'stock'];
const asProduct = (row) => ({ ...row, price: Number(row.price), stock: Number(row.stock) });

function validateProduct(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'El cuerpo debe ser un objeto JSON.';
  const allowed = new Set(fields);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length) return `Campos no permitidos: ${unknown.join(', ')}.`;
  if (!partial && fields.some((field) => body[field] === undefined)) return `Se requieren los campos: ${fields.join(', ')}.`;
  for (const field of fields) {
    if (body[field] === undefined) continue;
    const value = body[field];
    if (['name', 'category', 'sku'].includes(field) && (typeof value !== 'string' || !value.trim())) return `${field} debe ser texto y no puede estar vacío.`;
    if (field === 'description' && typeof value !== 'string') return 'description debe ser texto.';
    if (field === 'price' && (!Number.isFinite(value) || value < 0)) return 'price debe ser un número mayor o igual a 0.';
    if (field === 'stock' && (!Number.isInteger(value) || value < 0)) return 'stock debe ser un entero mayor o igual a 0.';
  }
  return null;
}

function handleError(error, res) {
  if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un producto con ese SKU.' });
  if (error.code === '23514') return res.status(400).json({ error: 'El precio y el stock no pueden ser negativos.' });
  console.error(error);
  return res.status(500).json({ error: 'Error interno del servidor.' });
}

app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch { res.status(503).json({ status: 'error', database: 'disconnected' }); }
});

app.get('/api/products', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    if (req.query.category) { values.push(String(req.query.category)); conditions.push(`category ILIKE $${values.length}`); }
    if (req.query.search) { values.push(`%${String(req.query.search)}%`); conditions.push(`(name ILIKE $${values.length} OR description ILIKE $${values.length} OR sku ILIKE $${values.length})`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await pool.query(`SELECT COUNT(*) FROM products ${where}`, values);
    const result = await pool.query(`SELECT * FROM products ${where} ORDER BY id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, offset]);
    const total = Number(countResult.rows[0].count);
    res.json({ data: result.rows.map(asProduct), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { handleError(error, res); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ data: asProduct(result.rows[0]) });
  } catch (error) { handleError(error, res); }
});

app.post('/api/products', async (req, res) => {
  const error = validateProduct(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const values = fields.map((field) => req.body[field]);
    const result = await pool.query(`INSERT INTO products (${fields.join(', ')}) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, values);
    res.status(201).json({ data: asProduct(result.rows[0]) });
  } catch (error) { handleError(error, res); }
});

app.put('/api/products/:id', async (req, res) => {
  const error = validateProduct(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const values = fields.map((field) => req.body[field]);
    values.push(req.params.id);
    const result = await pool.query(`UPDATE products SET ${fields.map((field, i) => `${field} = $${i + 1}`).join(', ')}, updated_at = NOW() WHERE id = $7 RETURNING *`, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ data: asProduct(result.rows[0]) });
  } catch (error) { handleError(error, res); }
});

app.patch('/api/products/:id', async (req, res) => {
  const error = validateProduct(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  const changes = fields.filter((field) => req.body[field] !== undefined);
  if (!changes.length) return res.status(400).json({ error: 'Indica al menos un campo para actualizar.' });
  try {
    const values = changes.map((field) => req.body[field]);
    values.push(req.params.id);
    const result = await pool.query(`UPDATE products SET ${changes.map((field, i) => `${field} = $${i + 1}`).join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rowCount) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ data: asProduct(result.rows[0]) });
  } catch (error) { handleError(error, res); }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.status(204).end();
  } catch (error) { handleError(error, res); }
});

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'JSON inválido.' });
  return handleError(error, res);
});

const server = app.listen(port, () => console.log(`API de papelería disponible en http://localhost:${port}`));
async function shutdown() { server.close(async () => { await pool.end(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
