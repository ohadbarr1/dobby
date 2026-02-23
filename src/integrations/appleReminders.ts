import { execFile } from 'child_process';
import logger from '../utils/logger';

export interface AppleReminder {
  name: string;
  dueDate: string | null;
  list: string;
}

function runOsascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`osascript error: ${err.message} — ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export async function getIncompleteReminders(): Promise<AppleReminder[]> {
  const script = `
    set output to ""
    tell application "Reminders"
      repeat with lst in lists
        set lstName to name of lst
        set incompleteItems to (every reminder of lst whose completed is false)
        repeat with r in incompleteItems
          set rName to name of r
          try
            set d to due date of r
            set dStr to (d as «class isot» as string)
          on error
            set dStr to "none"
          end try
          set output to output & rName & "|" & dStr & "|" & lstName & linefeed
        end repeat
      end repeat
    end tell
    return output
  `;

  try {
    const raw = await runOsascript(script);
    if (!raw) return [];

    const reminders: AppleReminder[] = [];
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 3) continue;

      const [name, dueDateStr, list] = parts;
      reminders.push({
        name: name.trim(),
        dueDate: dueDateStr.trim() === 'none' ? null : dueDateStr.trim(),
        list: list.trim(),
      });
    }

    return reminders;
  } catch (err) {
    logger.error(`Apple Reminders error: ${(err as Error).message}`);
    return [];
  }
}
