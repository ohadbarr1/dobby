import { ActionResult } from '../ai/responseGenerator';
import { FamilyContext } from '../types/family';
import * as taskRepo from '../db/repositories/taskRepo';
import { getIncompleteReminders } from '../integrations/appleReminders';
import logger from '../utils/logger';

export async function handleQueryTasks(ctx: FamilyContext): Promise<ActionResult> {
  try {
    const [tasks, appleReminders] = await Promise.all([
      taskRepo.getOpenTasks(ctx.family.id),
      getIncompleteReminders().catch((err) => {
        logger.error(`Apple Reminders fetch error: ${(err as Error).message}`);
        return [];
      }),
    ]);
    return { success: true, data: { tasks, appleReminders } };
  } catch (err) {
    logger.error(`handleQueryTasks error: ${(err as Error).message}`);
    return { success: false, errorMsg: 'Failed to fetch tasks \u{1F648}' };
  }
}
