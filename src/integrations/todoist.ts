import { TodoistApi } from '@doist/todoist-api-typescript';
import config from '../utils/config';
import logger from '../utils/logger';

const api = new TodoistApi(config.TODOIST_API_KEY);

export async function addShoppingItems(items: string[]): Promise<void> {
  for (const item of items) {
    await api.addTask({
      content: item,
      projectId: config.TODOIST_SHOPPING_PROJECT_ID,
    });
  }
  logger.info(`Added ${items.length} item(s) to shopping list`);
}

export async function completeShoppingItems(items: string[]): Promise<number> {
  const response = await api.getTasks({ projectId: config.TODOIST_SHOPPING_PROJECT_ID });
  const tasks = response.results;
  let completed = 0;

  for (const itemName of items) {
    const match = tasks.find(
      (t) => t.content.toLowerCase() === itemName.toLowerCase()
    );
    if (match) {
      await api.closeTask(match.id);
      completed++;
    }
  }

  logger.info(`Completed ${completed}/${items.length} shopping item(s)`);
  return completed;
}

export async function getShoppingItems(): Promise<string[]> {
  const response = await api.getTasks({ projectId: config.TODOIST_SHOPPING_PROJECT_ID });
  return response.results.map((t) => t.content);
}

export interface OpenTask {
  content: string;
  due: string | null;
}

export async function getOpenTasks(): Promise<OpenTask[]> {
  const response = await api.getTasks({ projectId: config.TODOIST_TASKS_PROJECT_ID });
  return response.results.map((t) => ({
    content: t.content,
    due: t.due?.date || null,
  }));
}
