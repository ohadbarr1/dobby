import { execFile } from 'child_process';
import logger from '../utils/logger';

function runAppleScript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function ensureListScript(listName: string): string {
  return `
    tell application "Reminders"
      if not (exists list "${listName}") then
        make new list with properties {name:"${listName}"}
      end if
    end tell
  `;
}

export async function addShoppingItems(items: string[]): Promise<void> {
  await runAppleScript(ensureListScript('Shopping'));

  for (const item of items) {
    const escaped = item.replace(/"/g, '\\"');
    await runAppleScript(`
      tell application "Reminders"
        tell list "Shopping"
          make new reminder with properties {name:"${escaped}"}
        end tell
      end tell
    `);
  }
  logger.info(`Added ${items.length} item(s) to Shopping list in Reminders`);
}

export async function completeShoppingItems(items: string[]): Promise<number> {
  let completed = 0;

  for (const itemName of items) {
    const escaped = itemName.replace(/"/g, '\\"').toLowerCase();
    try {
      const result = await runAppleScript(`
        tell application "Reminders"
          tell list "Shopping"
            set matchedReminders to (every reminder whose completed is false and name is "${escaped}")
            if (count of matchedReminders) is 0 then
              -- try case-insensitive match
              set allReminders to every reminder whose completed is false
              repeat with r in allReminders
                if (name of r as text) is "${escaped}" then
                  set completed of r to true
                  return "done"
                end if
              end repeat
              return "not_found"
            else
              set completed of (item 1 of matchedReminders) to true
              return "done"
            end if
          end tell
        end tell
      `);
      if (result === 'done') completed++;
    } catch {
      // item not found, skip
    }
  }

  logger.info(`Completed ${completed}/${items.length} shopping item(s) in Reminders`);
  return completed;
}

export async function getShoppingItems(): Promise<string[]> {
  await runAppleScript(ensureListScript('Shopping'));

  const result = await runAppleScript(`
    tell application "Reminders"
      tell list "Shopping"
        set openReminders to every reminder whose completed is false
        set nameList to {}
        repeat with r in openReminders
          set end of nameList to name of r
        end repeat
        set AppleScript's text item delimiters to "||"
        return nameList as text
      end tell
    end tell
  `);

  if (!result) return [];
  return result.split('||').map((s) => s.trim()).filter(Boolean);
}

export interface OpenTask {
  content: string;
  due: string | null;
}

export async function getOpenTasks(): Promise<OpenTask[]> {
  await runAppleScript(ensureListScript('Tasks'));

  const result = await runAppleScript(`
    tell application "Reminders"
      tell list "Tasks"
        set openReminders to every reminder whose completed is false
        set output to {}
        repeat with r in openReminders
          set taskName to name of r
          try
            set d to due date of r
            set dateStr to (year of d as text) & "-" & text -2 thru -1 of ("0" & (month of d as number)) & "-" & text -2 thru -1 of ("0" & (day of d))
          on error
            set dateStr to "none"
          end try
          set end of output to taskName & "||" & dateStr
        end repeat
        set AppleScript's text item delimiters to "%%"
        return output as text
      end tell
    end tell
  `);

  if (!result) return [];
  return result.split('%%').map((entry) => {
    const [content, due] = entry.split('||');
    return {
      content: content.trim(),
      due: due?.trim() === 'none' ? null : due?.trim() || null,
    };
  }).filter((t) => t.content);
}
