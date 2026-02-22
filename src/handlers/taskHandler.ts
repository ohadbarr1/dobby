import { ActionResult } from '../ai/responseGenerator';
import { FamilyContext } from '../types/family';
import * as taskRepo from '../db/repositories/taskRepo';
import logger from '../utils/logger';

export async function handleQueryTasks(ctx: FamilyContext): Promise<ActionResult> {
  try {
    const tasks = await taskRepo.getOpenTasks(ctx.family.id);
    return { success: true, data: tasks };
  } catch (err) {
    logger.error(`handleQueryTasks error: ${(err as Error).message}`);
    return { success: false, errorMsg: 'Failed to fetch tasks \u{1F648}' };
  }
}
