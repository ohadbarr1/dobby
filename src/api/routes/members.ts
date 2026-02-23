import { Router } from 'express';
import * as memberRepo from '../../db/repositories/memberRepo';
import * as familyRepo from '../../db/repositories/familyRepo';

export const membersRouter = Router();

// POST /api/families/:familyId/members — add a member
membersRouter.post('/:familyId/members', async (req, res) => {
  try {
    const familyId = Number(req.params.familyId);
    const family = await familyRepo.getFamilyById(familyId);
    if (!family) return res.status(404).json({ error: 'Family not found' });

    const { name, phone } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'name and phone are required' });
    }
    const member = await memberRepo.createMember({ familyId, name, phone });
    res.status(201).json(member);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /api/families/:familyId/members/:id — update member
membersRouter.put('/:familyId/members/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const member = await memberRepo.getMemberById(id);
    if (!member || member.familyId !== Number(req.params.familyId)) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const { name, phone } = req.body;
    await memberRepo.updateMember(id, { name, phone });

    // If google credentials are provided, update those too
    const { googleRefreshToken, googleCalendarId } = req.body;
    if (googleRefreshToken && googleCalendarId) {
      await memberRepo.updateMemberCalendar(id, googleRefreshToken, googleCalendarId);
    }

    const updated = await memberRepo.getMemberById(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /api/families/:familyId/members/:id — remove member
membersRouter.delete('/:familyId/members/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const member = await memberRepo.getMemberById(id);
    if (!member || member.familyId !== Number(req.params.familyId)) {
      return res.status(404).json({ error: 'Member not found' });
    }
    await memberRepo.deleteMember(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
