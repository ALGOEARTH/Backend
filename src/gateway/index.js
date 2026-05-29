'use strict';
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const registry = {
  platforms: {},
  tenants: {},
};

const GATEWAY_CONFIG = {
  version: '2.0.0',
  name: 'Jarvis Unified Backend Gateway',
  platforms: {
    'saltedhash': { active: true, basePath: '/api/v1/platform/saltedhash', tenantSupport: true },
    'nextdoor': { active: true, basePath: '/api/v1/platform/nextdoor', tenantSupport: true },
    'sme-invoice': { active: true, basePath: '/api/v1/platform/sme-invoice', tenantSupport: true },
    'sme-sync': { active: true, basePath: '/api/v1/platform/sme-sync', tenantSupport: true },
    'pos': { active: true, basePath: '/api/v1/pos', tenantSupport: true },
    'exam': { active: true, basePath: '/api/v1/exam', tenantSupport: false },
    'agency': { active: true, basePath: '/api/v1/agency', tenantSupport: false },
    'university': { active: true, basePath: '/api/v1/university', tenantSupport: false },
    'ecommerce': { active: true, basePath: '/api/v1/ecommerce', tenantSupport: false },
    'erp': { active: true, basePath: '/api/v1/erp', tenantSupport: false },
    'crm': { active: true, basePath: '/api/v1/crm', tenantSupport: false },
    'hr': { active: true, basePath: '/api/v1/hr', tenantSupport: false },
    'marketing': { active: true, basePath: '/api/v1/marketing', tenantSupport: false },
    'trading': { active: true, basePath: '/api/v1/trading', tenantSupport: false },
    'portfolio': { active: true, basePath: '/api/v1/portfolio', tenantSupport: false },
  },
};
const GATEWAY_PATH = path.join(__dirname, '../../', 'gateway-config.json');
const TENANTS_DIR = path.join(__dirname, '../../', 'data/tenants');

const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

const initGateway = () => {
  ensureDir(TENANTS_DIR);
  if (!fs.existsSync(GATEWAY_PATH)) {
    fs.writeFileSync(GATEWAY_PATH, JSON.stringify(GATEWAY_CONFIG, null, 2));
  }
};

initGateway();

const getPlatformByDomain = (host) => {
  if (!host) return null;
  for (const [name, cfg] of Object.entries(GATEWAY_CONFIG.platforms)) {
    if (cfg.active && cfg.domains && cfg.domains.includes(host)) return name;
  }
  return null;
};

const getTenantByDomain = (host) => {
  if (!host) return null;
  return Object.values(registry.tenants).find(t => t.domains?.includes(host)) || null;
};

router.get('/manifest', (req, res) => {
  res.json({
    success: true,
    data: {
      gateway: GATEWAY_CONFIG,
      activePlatforms: Object.entries(GATEWAY_CONFIG.platforms).filter(([_, p]) => p.active).map(([k, v]) => ({ name: k, ...v })),
      tenants: Object.keys(registry.tenants).length,
    },
  });
});

router.get('/health', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    gateway: GATEWAY_CONFIG.name,
    version: GATEWAY_CONFIG.version,
    platformCount: Object.keys(GATEWAY_CONFIG.platforms).length,
    tenantCount: Object.keys(registry.tenants).length,
    uptime: process.uptime(),
  });
});

router.post('/provision', (req, res) => {
  const { tenantId, platform, slug } = req.body;
  if (!tenantId) return res.status(400).json({ success: false, message: 'tenantId required' });

  const tenantDir = path.join(TENANTS_DIR, `ten_${tenantId}`);
  ensureDir(tenantDir);
  ensureDir(path.join(tenantDir, 'data'));

  const tenant = {
    tenantId,
    slug: slug || tenantId,
    platform: platform || 'multi',
    createdAt: new Date().toISOString(),
    domains: [],
    config: req.body.config || {},
  };

  registry.tenants[tenantId] = tenant;

  const configPath = path.join(tenantDir, 'tenant.json');
  fs.writeFileSync(configPath, JSON.stringify(tenant, null, 2));

  if (req.body.seed !== false) {
    const collections = ['profile.json', 'settings.json', 'analytics_logs.json'];
    collections.forEach(c => {
      const cp = path.join(tenantDir, 'data', c);
      if (!fs.existsSync(cp)) fs.writeFileSync(cp, JSON.stringify({}));
    });
  }

  res.status(201).json({ success: true, data: tenant });
});

router.get('/resolve', (req, res) => {
  const { slug, domain } = req.query;
  if (domain) {
    const platform = getPlatformByDomain(domain);
    if (platform) return res.json({ success: true, data: { type: 'platform', name: platform } });
  }
  const tenant = slug ? Object.values(registry.tenants).find(t => t.slug === slug) : null;
  res.json({ success: true, data: tenant || { type: 'unknown' } });
});

router.post('/webhook', (req, res) => {
  const { source, event } = req.body;
  res.json({ success: true, message: `${source} webhook ${event} received`, id: Date.now().toString(36) });
});

router.get('/tenants', (req, res) => {
  res.json({ success: true, data: Object.values(registry.tenants) });
});

router.post('/sync', async (req, res) => {
  const { source, target, collection, data } = req.body;
  if (!source || !target || !collection) {
    return res.status(400).json({ success: false, message: 'source, target, collection required' });
  }
  const targetPath = path.join(TENANTS_DIR, `ten_${target}`, 'data', `${collection}.json`);
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, JSON.stringify(data || [], null, 2));
  res.json({ success: true, message: `${collection} synced from ${source} to ${target}` });
});

router.use('/route', (req, res) => {
  const { platform, path: routePath } = req.query;
  const cfg = GATEWAY_CONFIG.platforms[platform];
  if (!cfg || !cfg.active) return res.status(404).json({ success: false, message: `Platform '${platform}' not found` });
  res.json({ success: true, data: { platform, route: routePath, basePath: cfg.basePath, message: `Routed to ${platform}` } });
});

module.exports = { gatewayRouter: router, GATEWAY_CONFIG, registry, getPlatformByDomain, getTenantByDomain };