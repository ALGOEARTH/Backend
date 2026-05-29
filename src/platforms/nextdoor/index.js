'use strict';
const express = require('express');
const router = express.Router();
const db = require('../../config/jsonDb');

const LOCALITIES = {
  Mumbai: ['Bandra West', 'Andheri East', 'Colaba', 'Powai'],
  Delhi: ['Saket', 'Dwarka', 'Hauz Khas', 'Connaught Place'],
  Bengaluru: ['Koramangala', 'Indiranagar', 'Whitefield', 'Jayanagar'],
  Hyderabad: ['Hitech City', 'Banjara Hills', 'Gachibowli', 'Madhapur'],
  Chennai: ['Adyar', 'Velachery', 'T. Nagar', 'OMR'],
};

router.get('/health', (req, res) => {
  res.json({ success: true, platform: 'Nextdoor/SNMA', version: '1.0.0', cities: Object.keys(LOCALITIES) });
});

router.get('/localities', (req, res) => {
  res.json({ success: true, data: LOCALITIES });
});

router.get('/localities/:city', (req, res) => {
  res.json({ success: true, data: LOCALITIES[req.params.city] || [] });
});

router.get('/feed', (req, res) => {
  try {
    const { locality } = req.query;
    let posts = db.find('nd_posts', {});
    if (locality) posts = posts.filter(p => p.locality === locality);
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, data: posts });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/posts', (req, res) => {
  try {
    const post = { _id: db.generateId(), upvotes: 0, comments: [], ...req.body, createdAt: new Date().toISOString() };
    db.insert('nd_posts', post);
    res.status(201).json({ success: true, data: post });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/posts/:id/upvote', (req, res) => {
  try {
    const post = db.findById('nd_posts', req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    const upvotes = (post.upvotes || 0) + 1;
    db.update('nd_posts', { _id: req.params.id }, { $set: { upvotes } });
    res.json({ success: true, data: { upvotes } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/posts/:id/comments', (req, res) => {
  try {
    const comments = db.find('nd_comments', { postId: req.params.id });
    res.json({ success: true, data: comments });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/posts/:id/comments', (req, res) => {
  try {
    const comment = { _id: db.generateId(), postId: req.params.id, ...req.body, createdAt: new Date().toISOString() };
    db.insert('nd_comments', comment);
    res.status(201).json({ success: true, data: comment });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/businesses', (req, res) => {
  try {
    const { category, locality } = req.query;
    let businesses = db.find('nd_businesses', {});
    if (category) businesses = businesses.filter(b => b.category === category);
    if (locality) businesses = businesses.filter(b => b.locality === locality);
    res.json({ success: true, data: businesses });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/businesses', (req, res) => {
  try {
    const business = { _id: db.generateId(), rating: 0, reviews: 0, ...req.body, createdAt: new Date().toISOString() };
    db.insert('nd_businesses', business);
    res.status(201).json({ success: true, data: business });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/societies', (req, res) => {
  try {
    const societies = db.find('nd_societies', {});
    res.json({ success: true, data: societies });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/societies', (req, res) => {
  try {
    const society = { _id: db.generateId(), members: 0, channels: [], ...req.body, createdAt: new Date().toISOString() };
    db.insert('nd_societies', society);
    res.status(201).json({ success: true, data: society });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/societies/:id/join', (req, res) => {
  try {
    const society = db.findById('nd_societies', req.params.id);
    if (!society) return res.status(404).json({ success: false, message: 'Society not found' });
    const members = (society.members || 0) + 1;
    db.update('nd_societies', { _id: req.params.id }, { $set: { members } });
    res.json({ success: true, data: { members } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/channels/:societyId', (req, res) => {
  try {
    const channels = db.find('nd_channels', { societyId: req.params.societyId });
    res.json({ success: true, data: channels });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/messages/:channelId', (req, res) => {
  try {
    const messages = db.find('nd_messages', { channelId: req.params.channelId });
    res.json({ success: true, data: messages });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/messages', (req, res) => {
  try {
    const msg = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString() };
    db.insert('nd_messages', msg);
    res.status(201).json({ success: true, data: msg });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;