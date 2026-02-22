import { ActionResult } from '../ai/responseGenerator';
import { getOpenTasks } from '../integrations/reminders';
import logger from '../utils/logger';

export async function handleQueryTasks(): Promise<ActionResult> {
  try {
    const tasks = await getOpenTasks();
    return { success: true, data: tasks };
  } catch (err) {
    logger.error(`handleQueryTasks error: ${(err as Error).message}`);
    return { success: false, errorMsg: 'Failed to fetch tasks \u{1F648}' };
  }
}
