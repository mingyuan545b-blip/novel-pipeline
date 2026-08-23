const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { ERROR_CODES } = require('../shared/errorCodes');

const { NOT_FOUND } = ERROR_CODES;

const router = require('express').Router();

router.get('/', async (req, res) => {
    const { chapterId, type } = req.query;
    let reviews = await store.listItems('reviews');
    if (chapterId) reviews = reviews.filter(r => r.chapterId === chapterId);
    if (type) reviews = reviews.filter(r => r.type === type);
    reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(reviews);
});

router.get('/:id', async (req, res) => {
    const review = await store.getItem('reviews', req.params.id);
    if (!review) {
        return res.apiError(NOT_FOUND.statusCode, 'Review not found', NOT_FOUND.code);
    }
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
    res.apiOk(review, null, 201);
});

router.put('/:id', async (req, res) => {
    const review = await store.getItem('reviews', req.params.id);
    if (!review) {
        return res.apiError(NOT_FOUND.statusCode, 'Review not found', NOT_FOUND.code);
    }
    const updated = { ...review, ...req.body, id: review.id };
    await store.setItem('reviews', review.id, updated);
    res.json(updated);
});

router.delete('/:id', async (req, res) => {
    const deleted = await store.deleteItem('reviews', req.params.id);
    if (!deleted) {
        return res.apiError(NOT_FOUND.statusCode, 'Review not found', NOT_FOUND.code);
    }
    res.json({ success: true });
});

module.exports = router;
