'use strict';
const express = require('express');
const router = express.Router();
const db = require('../../config/jsonDb');

router.get('/health', (req, res) => {
  res.json({ success: true, platform: 'SME Sync Platform', version: '1.0.0', collections: ['products', 'feedback', 'inventoryMovements', 'notifications', 'businesses', 'users'] });
});

router.get('/products', (req, res) => {
  try {
    res.json({ success: true, data: db.find('sync_products', {}) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/products', (req, res) => {
  try {
    const product = { _id: db.generateId(), currentStock: 0, ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    db.insert('sync_products', product);
    res.status(201).json({ success: true, data: product });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/inventory/movements', (req, res) => {
  try {
    const { productId } = req.query;
    let movements = db.find('sync_inventory_movements', {});
    if (productId) movements = movements.filter(m => m.productId === productId);
    movements.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    res.json({ success: true, data: movements });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/inventory/movements', (req, res) => {
  try {
    const { productId, type, quantity } = req.body;
    const movement = { _id: db.generateId(), ...req.body, date: new Date().toISOString(), createdAt: new Date().toISOString() };
    db.insert('sync_inventory_movements', movement);
    const product = db.findById('sync_products', productId);
    if (product) {
      const newStock = type === 'in' ? (product.currentStock || 0) + quantity : (product.currentStock || 0) - quantity;
      db.update('sync_products', { _id: productId }, { $set: { currentStock: Math.max(0, newStock), updatedAt: new Date().toISOString() } });
      if (newStock <= (product.reorderLevel || 0)) {
        db.insert('sync_notifications', { _id: db.generateId(), type: 'low_stock', message: `Low stock: ${product.name} (${newStock} remaining)`, seen: false, createdAt: new Date().toISOString() });
      }
    }
    res.status(201).json({ success: true, data: movement });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/inventory/restock', (req, res) => {
  try {
    const products = db.find('sync_products', {});
    const movements = db.find('sync_inventory_movements', {});
    const suggestions = products.filter(p => p.currentStock <= (p.reorderLevel || 0)).map(p => {
      const productMovements = movements.filter(m => m.productId === p._id && m.type === 'out');
      const avg = productMovements.length ? productMovements.slice(-30).reduce((s, m) => s + (m.quantity || 0), 0) / Math.min(productMovements.length, 30) : 0;
      return { product: p, currentStock: p.currentStock, reorderLevel: p.reorderLevel || 0, avgDailyUsage: Math.round(avg), suggestedOrder: Math.max(0, Math.ceil(avg * 30 - p.currentStock)) };
    });
    res.json({ success: true, data: suggestions });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/feedback', (req, res) => {
  try {
    const feedback = db.find('sync_feedback', {});
    const { page = 1, limit = 20 } = req.query;
    const start = (page - 1) * limit;
    feedback.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, data: feedback.slice(start, start + parseInt(limit)), total: feedback.length, page: parseInt(page) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/feedback', (req, res) => {
  try {
    const feedback = { _id: db.generateId(), ...req.body, sentiment: req.body.rating && req.body.rating < 3 ? 'negative' : 'positive', createdAt: new Date().toISOString() };
    db.insert('sync_feedback', feedback);
    if (feedback.rating && feedback.rating < 3) {
      db.insert('sync_notifications', { _id: db.generateId(), type: 'negative_feedback', message: `Negative feedback received${feedback.customerPhone ? ' from ' + feedback.customerPhone : ''}`, seen: false, createdAt: new Date().toISOString() });
    }
    res.status(201).json({ success: true, data: feedback });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/notifications', (req, res) => {
  try {
    const notifications = db.find('sync_notifications', {});
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, data: notifications, unread: notifications.filter(n => !n.seen).length });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.patch('/notifications/:id/seen', (req, res) => {
  try {
    db.update('sync_notifications', { _id: req.params.id }, { $set: { seen: true } });
    res.json({ success: true, message: 'Marked as seen' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/export', (req, res) => {
  try {
    const collections = ['sync_products', 'sync_inventory_movements', 'sync_feedback', 'sync_notifications'];
    const data = {};
    collections.forEach(c => { data[c] = db.find(c, {}); });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;