const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const DB = {
  users:  path.join(__dirname, 'data', 'users.json'),
  menu:   path.join(__dirname, 'data', 'menu.json'),
  orders: path.join(__dirname, 'data', 'orders.json'),
};

const read  = (f) => JSON.parse(fs.readFileSync(f, 'utf-8'));
const write = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

// ── AUTH ────────────────────────────────────────────────────────────────────

// POST /login  { username }
app.post('/login', (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ message: 'username is required' });

  const users = read(DB.users);
  const user  = users.find(u => u.username === username.toLowerCase().trim());

  if (!user) return res.status(401).json({ message: 'User not found' });

  res.json({ message: 'Login successful', role: user.role, username: user.username });
});

// ── MENU ────────────────────────────────────────────────────────────────────

// GET /menu
app.get('/menu', (_req, res) => res.json(read(DB.menu)));

// POST /menu  { vendor, name, price }
app.post('/menu', (req, res) => {
  const { vendor, name, price } = req.body || {};
  if (!vendor || !name || price === undefined)
    return res.status(400).json({ message: 'vendor, name and price are required' });

  const menu  = read(DB.menu);
  const entry = menu.find(m => m.vendor === vendor);
  const item  = { name, price: Number(price), soldOut: false };

  if (entry) {
    const idx = entry.items.findIndex(i => i.name === name);
    idx !== -1 ? (entry.items[idx] = { ...entry.items[idx], ...item }) : entry.items.push(item);
  } else {
    menu.push({ vendor, items: [item] });
  }

  write(DB.menu, menu);
  res.status(201).json({ message: 'Menu item saved' });
});

// PUT /menu/:vendor/:itemName  { soldOut?, price? }
app.put('/menu/:vendor/:itemName', (req, res) => {
  const menu  = read(DB.menu);
  const entry = menu.find(m => m.vendor === req.params.vendor);
  if (!entry) return res.status(404).json({ message: 'Vendor not found' });

  const item = entry.items.find(i => i.name === req.params.itemName);
  if (!item)  return res.status(404).json({ message: 'Item not found' });

  Object.assign(item, req.body);
  write(DB.menu, menu);
  res.json({ message: 'Item updated', item });
});

// DELETE /menu/:vendor/:itemName
app.delete('/menu/:vendor/:itemName', (req, res) => {
  const menu  = read(DB.menu);
  const entry = menu.find(m => m.vendor === req.params.vendor);
  if (!entry) return res.status(404).json({ message: 'Vendor not found' });

  const before = entry.items.length;
  entry.items  = entry.items.filter(i => i.name !== req.params.itemName);
  if (entry.items.length === before)
    return res.status(404).json({ message: 'Item not found' });

  write(DB.menu, menu);
  res.json({ message: 'Item deleted' });
});

// ── ORDERS ──────────────────────────────────────────────────────────────────

// GET /orders
app.get('/orders', (_req, res) => res.json(read(DB.orders)));

// GET /orders/:vendor
app.get('/orders/:vendor', (req, res) => {
  const orders = read(DB.orders).filter(o => o.vendor === req.params.vendor);
  res.json(orders);
});

// POST /orders  { student, vendor, items: [{ name, price }] }
app.post('/orders', (req, res) => {
  const { student, vendor, items } = req.body || {};
  if (!student || !vendor || !Array.isArray(items) || !items.length)
    return res.status(400).json({ message: 'student, vendor and items[] are required' });

  const orders = read(DB.orders);
  const order  = {
    id:        Date.now(),
    student,
    vendor,
    items,
    total:     items.reduce((s, i) => s + Number(i.price), 0),
    status:    'pending',
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  write(DB.orders, orders);
  res.status(201).json({ message: 'Order placed successfully', order });
});

// PUT /orders/:id  { status }
app.put('/orders/:id', (req, res) => {
  const orders = read(DB.orders);
  const order  = orders.find(o => String(o.id) === String(req.params.id));
  if (!order) return res.status(404).json({ message: 'Order not found' });

  order.status = req.body.status || order.status;
  write(DB.orders, orders);
  res.json({ message: 'Order updated', order });
});

// ── VENDORS (admin) ─────────────────────────────────────────────────────────

// GET /vendors
app.get('/vendors', (_req, res) => {
  res.json(read(DB.users).filter(u => u.role === 'vendor'));
});

// POST /vendors  { username }
app.post('/vendors', (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ message: 'username is required' });

  const users = read(DB.users);
  if (users.find(u => u.username === username))
    return res.status(409).json({ message: 'User already exists' });

  const vendor = { username, role: 'vendor', status: 'pending' };
  users.push(vendor);
  write(DB.users, users);
  res.status(201).json({ message: 'Vendor created', vendor });
});

// PUT /vendors/:username  { status: 'approved'|'suspended' }
app.put('/vendors/:username', (req, res) => {
  const users = read(DB.users);
  const user  = users.find(u => u.username === req.params.username && u.role === 'vendor');
  if (!user) return res.status(404).json({ message: 'Vendor not found' });

  user.status = req.body.status || user.status;
  write(DB.users, users);
  res.json({ message: 'Vendor updated', vendor: user });
});

// DELETE /vendors/:username
app.delete('/vendors/:username', (req, res) => {
  let users = read(DB.users);
  const idx = users.findIndex(u => u.username === req.params.username && u.role === 'vendor');
  if (idx === -1) return res.status(404).json({ message: 'Vendor not found' });

  users.splice(idx, 1);
  write(DB.users, users);
  res.json({ message: 'Vendor removed' });
});

// ── START ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => console.log(`✅ Server running → http://localhost:${PORT}`));
