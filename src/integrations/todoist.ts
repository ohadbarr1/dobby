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

export async function getShoppingItems(): Promise<string[]> {
  const response = await api.getTasks({ projectId: config.TODOIST_SHOPPING_PROJECT_ID });
  return response.results.map((t) => t.content);
}

export async function getTasks(filter: string): Promise<string[]> {
  const response = await api.getTasks({ projectId: config.TODOIST_TASKS_PROJECT_ID });
  const tasks = response.results;
  if (filter === 'all') return tasks.map((t) => t.content);
  return tasks
    .filter((t) => t.content.toLowerCase().includes(filter.toLowerCase()))
    .map((t) => t.content);
}
