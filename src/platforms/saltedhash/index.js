'use strict';
const express = require('express');
const router = express.Router();
const db = require('../../config/jsonDb');

const SALTEDHASH_MODULES = {
  fundamentals: ['lessons', 'concepts', 'scenarios'],
  exam: ['quiz_attempts', 'progress'],
  career: ['guidance_rules', 'budgets'],
  community: ['issues', 'resources', 'members', 'threads', 'events', 'sponsors'],
  creator: ['profile', 'canvas_pages', 'content_feed', 'analytics_logs'],
};

Object.entries(SALTEDHASH_MODULES).forEach(([category, collections]) => {
  collections.forEach(col => {
    const colPath = `saltedhash_${col}`;
    if (!db.find(colPath, {}).length) {
      db.insert(colPath, { _id: db.generateId(), name: `${col}_default`, category, createdAt: new Date().toISOString() });
    }
  });
});

router.get('/health', (req, res) => {
  res.json({
    success: true,
    platform: 'SALTEDHASH',
    version: '2.0.0',
    modules: SALTEDHASH_MODULES,
  });
});

router.get('/manifest', (req, res) => {
  res.json({ success: true, data: { sku: req.query.sku || 'default', modules: SALTEDHASH_MODULES } });
});

const createCollectionRoutes = (base, collection) => {
  router.get(`/${base}`, (req, res) => {
    try {
      const data = db.find(`saltedhash_${collection}`, {});
      res.json({ success: true, data });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  router.get(`/${base}/:id`, (req, res) => {
    try {
      const item = db.findById(`saltedhash_${collection}`, req.params.id);
      res.json({ success: true, data: item || {} });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  router.post(`/${base}`, (req, res) => {
    try {
      const item = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString() };
      db.insert(`saltedhash_${collection}`, item);
      res.status(201).json({ success: true, data: item });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });
};

Object.entries(SALTEDHASH_MODULES).forEach(([_category, collections]) => {
  collections.forEach(col => createCollectionRoutes(col, col));
});

router.get('/creator/profile', (req, res) => {
  try {
    const profiles = db.find('saltedhash_profile', {});
    res.json({ success: true, data: profiles[0] || { $schema_version: '1.0.0', tenant_id: null, auth_profile: {}, branding_tokens: {} } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/creator/canvas', (req, res) => {
  try {
    const pages = db.find('saltedhash_canvas_pages', {});
    res.json({ success: true, data: pages[0]?.canvas_layouts || [] });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/creator/canvas/blocks', (req, res) => {
  try {
    const pages = db.find('saltedhash_canvas_pages', {})[0];
    if (!pages?.canvas_layouts) {
      db.insert('saltedhash_canvas_pages', { _id: db.generateId(), canvas_layouts: [{ page_id: 'page_1', blocks: [req.body] }], createdAt: new Date().toISOString() });
    }
    res.status(201).json({ success: true, data: req.body });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/creator/analytics', (req, res) => {
  try {
    const logs = db.find('saltedhash_analytics_logs', {});
    res.json({ success: true, data: logs });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/creator/metrics/event', (req, res) => {
  try {
    const event = { _id: db.generateId(), event_id: `evt_${Date.now()}`, timestamp: Math.floor(Date.now() / 1000), ...req.body };
    db.insert('saltedhash_analytics_logs', event);
    res.status(201).json({ success: true, data: event });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;