'use strict';
const db = require('../config/jsonDb');

const SYNC_COLLECTIONS = {
  users: { platforms: ['core', 'saltedhash', 'sme-invoice', 'sme-sync', 'nextdoor'], syncFields: ['email', 'name', 'phone'] },
  products: { platforms: ['pos', 'ecommerce', 'erp', 'sme-sync'], syncFields: ['sku', 'name', 'price', 'stock'] },
  customers: { platforms: ['pos', 'crm', 'sme-invoice', 'ecommerce'], syncFields: ['name', 'phone', 'email', 'gstin'] },
  invoices: { platforms: ['pos', 'sme-invoice', 'agency'], syncFields: ['invoiceNumber', 'total', 'status', 'customerId'] },
  payments: { platforms: ['pos', 'sme-invoice', 'accounting'], syncFields: ['amount', 'method', 'reference', 'status'] },
};

class DataSync {
  constructor() {
    this.syncLog = [];
  }

  async syncAll() {
    const results = {};
    for (const [collection, config] of Object.entries(SYNC_COLLECTIONS)) {
      results[collection] = await this.syncCollection(collection, config);
    }
    return results;
  }

  async syncCollection(collection, config) {
    const records = {};
    for (const platform of config.platforms) {
      try {
        const platformKey = this.getPlatformCollectionKey(platform, collection);
        const items = db.find(platformKey, {});
        items.forEach(item => {
          const key = this.getItemKey(item, config.syncFields);
          if (!records[key]) records[key] = { sources: [], data: { ...item } };
          records[key].sources.push(platform);
          records[key].data = { ...records[key].data, ...this.extractSyncData(item, config.syncFields) };
        });
      } catch (e) { /* collection may not exist */ }
    }
    this.syncLog.push({ timestamp: new Date().toISOString(), collection, totalRecords: Object.keys(records).length, platforms: config.platforms });
    return { collection, totalRecords: Object.keys(records).length, records: Object.values(records) };
  }

  getPlatformCollectionKey(platform, collection) {
    const map = {
      'pos': `pos_${collection}`,
      'ecommerce': `ec_${collection}`,
      'erp': `erp_${collection}`,
      'crm': `crm_${collection}`,
      'agency': `agency_${collection}`,
      'sme-invoice': `sme_${collection}`,
      'sme-sync': `sync_${collection}`,
      'saltedhash': `saltedhash_${collection}`,
      'nextdoor': `nd_${collection}`,
      'core': collection,
    };
    return map[platform] || `${platform}_${collection}`;
  }

  getItemKey(item, fields) {
    return fields.map(f => item[f] || '').join('::').toLowerCase();
  }

  extractSyncData(item, fields) {
    const data = {};
    fields.forEach(f => { if (item[f] !== undefined) data[f] = item[f]; });
    return data;
  }

  getSyncLog() { return this.syncLog; }

  getSyncStatus() {
    const collections = Object.keys(SYNC_COLLECTIONS);
    const summary = collections.map(c => {
      const config = SYNC_COLLECTIONS[c];
      return { collection: c, platforms: config.platforms, lastSync: this.syncLog.filter(l => l.collection === c).slice(-1)[0] || null };
    });
    return { collections: summary, totalMatches: this.syncLog.reduce((s, l) => s + l.totalRecords, 0) };
  }
}

const sync = new DataSync();

module.exports = { DataSync, sync, SYNC_COLLECTIONS };