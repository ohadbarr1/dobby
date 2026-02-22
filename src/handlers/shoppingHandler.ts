import { ParsedIntent } from '../ai/intentParser';
import { ActionResult } from '../ai/responseGenerator';
import { FamilyContext } from '../types/family';
import * as shoppingRepo from '../db/repositories/shoppingRepo';
import logger from '../utils/logger';

type AddShoppingIntent = Extract<ParsedIntent, { intent: 'ADD_SHOPPING' }>;
type CompleteShoppingIntent = Extract<ParsedIntent, { intent: 'COMPLETE_SHOPPING' }>;

export async function handleAddShopping(intent: AddShoppingIntent, ctx: FamilyContext): Promise<ActionResult> {
  try {
    await shoppingRepo.addItems(ctx.family.id, intent.items);
    return { success: true, data: intent.items };
  } catch (err) {
    logger.error(`handleAddShopping error: ${(err as Error).message}`);
    return { success: false, errorMsg: 'Failed to add shopping items \u{1F648}' };
  }
}

export async function handleCompleteShopping(intent: CompleteShoppingIntent, ctx: FamilyContext): Promise<ActionResult> {
  try {
    const count = await shoppingRepo.completeItems(ctx.family.id, intent.items);
    return { success: true, data: count };
  } catch (err) {
    logger.error(`handleCompleteShopping error: ${(err as Error).message}`);
    return { success: false, errorMsg: 'Failed to complete shopping items \u{1F648}' };
  }
}

export async function handleQueryShopping(ctx: FamilyContext): Promise<ActionResult> {
  try {
    const items = await shoppingRepo.getActiveItems(ctx.family.id);
    return { success: true, data: items };
  } catch (err) {
    logger.error(`handleQueryShopping error: ${(err as Error).message}`);
    return { success: false, errorMsg: 'Failed to fetch shopping list \u{1F648}' };
  }
}
