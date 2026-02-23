import { Router } from 'express';
import * as familyRepo from '../../db/repositories/familyRepo';

export const familiesRouter = Router();

// POST /api/families — register a new family
familiesRouter.post('/', async (req, res) => {
  try {
    const { name, whatsappGroupId, timezone } = req.body;
    if (!name || !whatsappGroupId) {
      return res.status(400).json({ error: 'name and whatsappGroupId are required' });
    }
    const family = await familyRepo.createFamily({ name, whatsappGroupId, timezone });
    res.status(201).json(family);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/families/:id — get family details
familiesRouter.get('/:id', async (req, res) => {
  try {
    const family = await familyRepo.getFamilyById(Number(req.params.id));
    if (!family) return res.status(404).json({ error: 'Family not found' });
    res.json(family);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /api/families/:id — update family settings
familiesRouter.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const family = await familyRepo.getFamilyById(id);
    if (!family) return res.status(404).json({ error: 'Family not found' });

    const { name, timezone, briefingHour, briefingMinute, aiMode } = req.body;
    await familyRepo.updateFamily(id, { name, timezone, briefingHour, briefingMinute, aiMode });
    const updated = await familyRepo.getFamilyById(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /api/families/:id — delete a family
familiesRouter.delete('/:id', async (req, res) => {
  try {
    const deleted = await familyRepo.deleteFamily(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Family not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
