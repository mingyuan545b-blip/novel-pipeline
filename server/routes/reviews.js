const { v4: uuidv4 } = require('uuid');
const store = require('../store');

const router = require('express').Router();

router.get('/', (req, res) => {
    const { chapterId, type } = req.query;
    let reviews = store.listItems('reviews');
    if (chapterId) reviews = reviews.filter(r => r.chapterId === chapterId);
    if (type) reviews = reviews.filter(r => r.type === type);
    reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(reviews);
});

router.get('/:id', (req, res) => {
    const review = store.getItem('reviews', req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json(review);
});

router.post('/', async (req, res) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const review = {
        id,
        chapterId: req.body.chapterId,
        projectId: req.body.projectId,
        type: req.body.type,
        reviewer: req.body.reviewer || 'system',
        result: req.body.result || 'pending',
        content: req.body.content || '',
        issues: req.body.issues || [],
        suggestions: req.body.suggestions || [],
        round: req.body.round || 1,
        createdAt: now
    };
    await store.setItem('reviews', id, review);
    res.status(201).json(review);
});

router.put('/:id', async (req, res) => {
    const review = store.getItem('reviews', req.params.id);
    if (!review) return res.status(404).json({ error: 'Review not found' });
    const updated = { ...review, ...req.body, id: review.id };
    await store.setItem('reviews', review.id, updated);
    res.json(updated);
});

router.delete('/:id', (req, res) => {
    const deleted = store.deleteItem('reviews', req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Review not found' });
    res.json({ success: true });
});

module.exports = router;
