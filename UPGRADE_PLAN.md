# Dobby Upgrade Plan - Product Management Review

## Executive Summary

Dobby is a WhatsApp-based family assistant bot (prototype). This document is a product management review covering the current state, critical issues, and a prioritized developer task list for upgrading Dobby from a single-family prototype into a scalable, Hebrew-first, multi-tenant product.

The upgrades cover 5 areas:
1. **Non-AI command mode** (menu-based fallback)
2. **Multi-tenant architecture** (backend upgrade for multiple families)
3. **Code quality & production readiness** (bugs, security, reliability)
4. **Hebrew localization** (all UI text in Hebrew, RTL-aware)
5. **Dobby personality** (profile picture, branding)

---

## Current State - Critical Issues Found

### P0 - Blockers (must fix)

| # | Issue | File(s) | Detail |
|---|-------|---------|--------|
| 1 | **Apple Reminders = macOS only** | `src/integrations/reminders.ts` | Uses `osascript` (AppleScript). Will NOT run on any server/cloud/Linux. This blocks *every* deployment scenario except running on the developer's Mac. |
| 2 | **Hardcoded 2-user limit** | `config.ts`, `dispatcher.ts`, `calendarHandler.ts`, `messageHandler.ts`, `intentParser.ts` | USER1/USER2 baked into env vars, config interface, dispatcher logic, and calendar merging. Cannot support 1 user, 3 users, or multiple families. |
| 3 | **Single WhatsApp group** | `whatsappClient.ts`, `config.ts` | `WHATSAPP_GROUP_ID` is a single value. Bot ignores all other chats. Multi-family = multi-instance. |
| 4 | **No graceful shutdown** | `index.ts`, `whatsappClient.ts` | No SIGTERM/SIGINT handler. WhatsApp client is never cleanly destroyed. Puppeteer zombie processes will accumulate. |
| 5 | **SQLite not suitable for multi-tenant** | `db/database.ts` | Single file DB, no tenant isolation, no migration system, no connection pooling. |
| 6 | **Bot loop prevention is fragile** | `whatsappClient.ts:10-15` | `botReplyInProgress` boolean with 2s timeout is a race condition. If a reply takes >2s, or two messages arrive simultaneously, the bot can loop or skip messages. |

### P1 - High Priority

| # | Issue | File(s) | Detail |
|---|-------|---------|--------|
| 7 | **No AI fallback** | `intentParser.ts`, `messageHandler.ts` | If Groq API is down or rate-limited, every message gets a CHITCHAT fallback. No menu-based or keyword-based fallback mode. |
| 8 | **No input validation on LLM output** | `intentParser.ts` | `JSON.parse(cleaned) as ParsedIntent` is a type assertion, not validation. LLM can return malformed intents (missing fields, wrong types) that will cause runtime crashes downstream. |
| 9 | **AppleScript injection risk** | `reminders.ts` | `item.replace(/"/g, '\\"')` is insufficient escaping. Backslashes, newlines, and special chars can break out of the AppleScript string. |
| 10 | **No health check / monitoring** | Entire project | No HTTP endpoint for health checks, no metrics, no alerting. Cannot tell if bot is alive. |
| 11 | **Context stored in memory only** | `ai/context.ts` | In-memory Map. Lost on every restart. No persistence. |
| 12 | **Cron timezone handling** | `cron.ts` | `datetime('now')` in SQLite is UTC. Reminder times from the LLM are ISO 8601 (with timezone). Comparison may be wrong depending on how the LLM formats the datetime. |
| 13 | **`fromMe` assumes USER1** | `whatsappClient.ts:47` | `msg.fromMe` maps to `USER1_PHONE`. If the bot is logged in from USER2's phone, all "own" messages are attributed to the wrong person. |
| 14 | **No test suite** | `package.json` | `"test": "echo \"Error: no test specified\""`. Zero tests. |
| 15 | **All strings in English** | All files | Target audience is Israel. All UI text, help messages, briefings, error messages are in English. |

### P2 - Medium Priority

| # | Issue | File(s) | Detail |
|---|-------|---------|--------|
| 16 | **No message queue** | `whatsappClient.ts` | Messages processed inline. If processing takes long, WhatsApp may timeout or duplicate. |
| 17 | **Calendar dedup is naive** | `googleCalendar.ts:124-128` | Dedup by `title|startTime`. Two different events with the same name and time will be merged incorrectly. Should use Google Calendar event ID. |
| 18 | **No retry on Google API calls** | `googleCalendar.ts` | OAuth token refresh, event creation, and event listing have zero retry logic. Transient failures cause hard errors. |
| 19 | **Unused dependencies** | `package.json` | `@anthropic-ai/sdk` and `@google/generative-ai` are listed but never imported. Wasted bundle size. |
| 20 | **No rate limiting** | `messageHandler.ts` | A user (or spam) can flood the bot with messages, each triggering an LLM call. No throttle. |
| 21 | **`data` directory not auto-created** | `db/database.ts` | `DB_PATH = path.join('data', 'dobby.db')` assumes `data/` exists. Will crash if it doesn't. |
| 22 | **No structured logging** | `logger.ts` | Winston is configured with string formatting, not JSON. Hard to parse in log aggregation tools. |

---

## Developer Task List

Copy-paste the tasks below into your next prompt. They are ordered by priority and dependency.

---

### Phase 1: Foundation & Critical Fixes

```
TASK 1: Replace Apple Reminders with a portable solution
- Remove the entire `src/integrations/reminders.ts` (AppleScript-based)
- Create a new `src/integrations/taskStore.ts` that uses SQLite tables for both shopping lists and tasks
- Create tables: `shopping_items` (id, family_id, name, completed, created_at, completed_at) and `tasks` (id, family_id, content, due_date, completed, created_at, completed_at)
- Update `shoppingHandler.ts` and `taskHandler.ts` to use the new store
- Update `briefingHandler.ts` to use the new store
- This unblocks Linux/cloud deployment
```

```
TASK 2: Multi-tenant database schema with PostgreSQL
- Replace `better-sqlite3` with `pg` (node-postgres) + connection pooling
- Design multi-tenant schema:
  - `families` table: id, name, whatsapp_group_id, timezone, briefing_hour, briefing_minute, created_at
  - `family_members` table: id, family_id, name, phone, google_refresh_token, google_calendar_id, role (admin/member)
  - `reminders` table: add family_id column, add foreign keys
  - `shopping_items` table: family_id, name, completed, created_at, completed_at
  - `tasks` table: family_id, content, due_date, completed, created_at, completed_at
- Add a migration system (use `node-pg-migrate` or raw SQL migration files in `src/db/migrations/`)
- Create `src/db/repositories/` with: familyRepo.ts, memberRepo.ts, reminderRepo.ts, shoppingRepo.ts, taskRepo.ts
- Update `src/db/database.ts` to initialize pool and run migrations on startup
- Add DATABASE_URL to env config
```

```
TASK 3: Dynamic config - remove hardcoded USER1/USER2 pattern
- Remove USER1_NAME, USER1_PHONE, USER2_NAME, USER2_PHONE, GOOGLE_REFRESH_TOKEN_USER1/USER2, GOOGLE_CALENDAR_ID_USER1/USER2 from config.ts and .env.example
- Remove WHATSAPP_GROUP_ID from config.ts (now per-family in DB)
- Keep only global config in .env: DATABASE_URL, GROQ_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, LOG_LEVEL, NODE_ENV
- Create `src/services/familyService.ts` that loads family config from DB by whatsapp_group_id
- Update `config.ts` to only validate global env vars
- Update .env.example with the new minimal set
```

```
TASK 4: Refactor WhatsApp client for multi-family
- Update `whatsappClient.ts` to accept messages from ANY group chat (remove single group ID filter)
- On each incoming message, look up the group_id in the `families` table
- If the group is not registered, ignore the message (or send a one-time "not registered" reply)
- Look up the sender's phone in `family_members` for that family
- Pass a `FamilyContext` object (family + member info) through the handler chain instead of just phone string
- Define `FamilyContext` interface: { familyId, familyName, timezone, member: { id, name, phone, role } }
- Fix the `fromMe` bug: look up phone from bot's own number, not assume USER1
- Fix the bot loop prevention: replace boolean flag with a Set<messageId> of recently-sent message IDs
```

```
TASK 5: Refactor Google Calendar for multi-user
- Update `googleCalendar.ts` to accept member credentials (refresh_token, calendar_id) as parameters instead of reading from config
- Remove all `user1`/`user2` hardcoding
- `getUpcomingEvents(member: FamilyMember)` instead of `getUpcomingEvents(user: 'user1' | 'user2')`
- `getMergedEvents(members: FamilyMember[], daysAhead)` fetches calendars for all family members
- Fix dedup: use Google Calendar event `iCalUID` field instead of title+time
- Add retry logic with exponential backoff for Google API calls (3 retries)
- Update calendarHandler.ts to get member list from FamilyContext
```

```
TASK 6: Fix graceful shutdown
- Add SIGTERM and SIGINT handlers in `index.ts`
- On shutdown: destroy WhatsApp client, close DB connection pool, stop cron jobs
- Add a 10-second timeout for graceful shutdown, then force exit
```

---

### Phase 2: Non-AI Command Mode (Menu System)

```
TASK 7: Build a keyword-based command parser
- Create `src/ai/commandParser.ts`
- Define keyword patterns for Hebrew commands (see Task 13 for the Hebrew strings):
  - "1" or "קניות" or "רשימת קניות" -> QUERY_SHOPPING
  - "2" or "משימות" -> QUERY_TASKS
  - "3" or "יומן" or "לוח שנה" -> QUERY_CALENDAR (default: 7 days)
  - "4" or "תזכורת" -> starts a reminder flow (multi-step)
  - "5" or "אירוע" or "הוסף אירוע" -> starts an event flow (multi-step)
  - "6" or "הוסף לקניות" + items -> ADD_SHOPPING
  - "7" or "עזרה" or "תפריט" -> HELP (show menu)
  - "קניתי" + items -> COMPLETE_SHOPPING
- Each pattern returns a ParsedIntent or null (null = not matched, fall through to AI)
- The parser should be tried BEFORE the AI parser
```

```
TASK 8: Build interactive menu flow
- Create `src/ai/menuFlow.ts` to manage multi-step command flows (e.g., adding a reminder requires: what? when? for whom?)
- Store active flows per-user in memory (Map<phone, ActiveFlow>)
- An ActiveFlow has: type, step, collectedData
- When a flow is active, incoming messages feed into the flow instead of going to intent parser
- Flows timeout after 5 minutes of inactivity
- Flow types:
  - ADD_REMINDER flow: step 1 = "מה להזכיר?" step 2 = "מתי?" step 3 = "למי? (1=לי, 2=לשנינו)"
  - ADD_EVENT flow: step 1 = "שם האירוע?" step 2 = "תאריך ושעת התחלה?" step 3 = "שעת סיום?"
```

```
TASK 9: Add AI/non-AI mode toggle
- Add a per-family setting in the `families` table: `ai_mode` BOOLEAN DEFAULT true
- When ai_mode=false, only use commandParser (keyword/menu-based)
- When ai_mode=true, try commandParser first, then fall through to AI if no match
- Add a command: "מצב חכם" / "מצב רגיל" to toggle between modes
- Update messageHandler.ts to route through: menuFlow -> commandParser -> (if ai_mode) intentParser -> fallback
```

---

### Phase 3: Hebrew Localization

```
TASK 10: Create a localization system
- Create `src/i18n/` directory
- Create `src/i18n/he.ts` with all Hebrew strings as a typed object:
  - All response templates (shopping list header, calendar header, task list header, etc.)
  - All error messages
  - Help text / menu
  - Briefing templates
  - Flow prompts (multi-step menu)
  - Date formatting config
- Create `src/i18n/index.ts` that exports a `t(key, params?)` function
- For now, Hebrew is the only language (hardcode locale), but structure it so adding languages later is trivial
```

```
TASK 11: Update all user-facing text to Hebrew
- Update `responseGenerator.ts`:
  - HELP_TEXT -> Hebrew menu:
    "שלום! אני דובי, העוזר המשפחתי שלכם 🧦\n\nהנה מה שאני יודע לעשות:\n\n• *תזכורת* — \"תזכיר לי להתקשר לאמא מחר ב-15:00\"\n• *אירוע* — \"הוסף פגישה עם דן ביום ראשון 10:00-11:00\"\n• *קניות* — \"תוסיף חלב וביצים\" / \"מה ברשימת הקניות?\" / \"קניתי חלב\"\n• *יומן* — \"מה ביומן השבוע?\"\n• *משימות* — \"הראה משימות\"\n\nאפשר גם לשלוח מספר מהתפריט:\n1️⃣ רשימת קניות\n2️⃣ משימות פתוחות\n3️⃣ יומן השבוע\n4️⃣ הוסף תזכורת\n5️⃣ הוסף אירוע\n6️⃣ הוסף לקניות\n7️⃣ עזרה\n\nפשוט תכתבו ואני אבין! 🤖"
  - All response format strings to Hebrew
  - Date formatting: use `he-IL` locale instead of `en-GB`
- Update `briefingHandler.ts`:
  - "☀️ בוקר טוב! הנה היום שלכם:\n"
  - "📅 *אירועים להיום:*" / "📅 אין אירועים להיום"
  - "📝 *משימות פתוחות:*" / "📝 אין משימות פתוחות - יום חופשי!"
- Update `intentParser.ts` system prompt:
  - Tell the LLM that users write in Hebrew
  - CHITCHAT replies should be in Hebrew
  - Dobby's personality: friendly, refers to himself in third person ("דובי"), speaks Hebrew
- Update all error messages: "משהו השתבש 🙈" instead of "Something went wrong 🙈"
- Update reminder notification in `cron.ts`: "⏰ תזכורת עבור *{name}*: {message}"
```

```
TASK 12: Update date/time formatting for Hebrew
- All `toLocaleString('en-GB', ...)` calls -> `toLocaleString('he-IL', ...)`
- All `toLocaleDateString('en-GB', ...)` calls -> `toLocaleDateString('he-IL', ...)`
- Test that Hebrew date strings render correctly in WhatsApp (RTL)
```

---

### Phase 4: Onboarding & Backend API

```
TASK 13: Create an HTTP API for family onboarding
- Add `express` as a dependency
- Create `src/api/` directory with:
  - `src/api/server.ts` - Express app setup (JSON body parser, error handler, CORS)
  - `src/api/routes/families.ts`:
    - POST /api/families - register a new family (name, whatsapp_group_id, timezone)
    - GET /api/families/:id - get family details
    - PUT /api/families/:id - update family settings (briefing time, ai_mode, timezone)
    - DELETE /api/families/:id - deactivate a family
  - `src/api/routes/members.ts`:
    - POST /api/families/:familyId/members - add a member (name, phone)
    - PUT /api/families/:familyId/members/:id - update member (name, google credentials)
    - DELETE /api/families/:familyId/members/:id - remove member
  - `src/api/routes/auth.ts`:
    - GET /api/auth/google/url?memberId=X - generate OAuth URL for a member
    - GET /api/auth/google/callback - handle OAuth callback, save refresh token to member record
- Start Express server alongside WhatsApp client in index.ts
- Add API_PORT to .env (default 3000)
- Add basic API key authentication: X-API-Key header checked against API_KEY env var
```

```
TASK 14: WhatsApp self-onboarding flow
- When a message comes from an unregistered group, instead of ignoring it:
  - If the message is "הוסף את דובי" or similar registration phrase:
    - Create a new family in the DB with the group ID
    - Add the sender as the first member (admin role)
    - Reply with a welcome message in Hebrew: "שלום! אני דובי 🧦 העוזר המשפחתי שלכם! נרשמתם בהצלחה.\n\nכדי להוסיף בני משפחה, בקשו מהם לשלוח: \"אני פה\" בקבוצה.\n\nלתפריט מלא שלחו: 7 או \"עזרה\""
  - If the message is "אני פה" from an unregistered member in a registered group:
    - Add the sender as a new member
    - Reply: "ברוכים הבאים! הוספתי את {name} למשפחה 🎉"
- This enables zero-backend onboarding for basic usage (no calendar until Google OAuth is set up)
```

```
TASK 15: Google Calendar OAuth per-member
- Move the OAuth flow from `scripts/getGoogleToken.ts` into the API
- When a member wants to connect their calendar:
  - They send "חבר יומן" to the group
  - Bot replies with a short URL to the OAuth flow (the API endpoint)
  - After OAuth completes, the refresh token is saved to the member's DB record
  - Bot confirms in the group: "היומן של {name} חובר בהצלחה! 📅"
```

---

### Phase 5: Production Hardening

```
TASK 16: Add input validation for LLM output
- Create `src/ai/intentValidator.ts`
- Use Zod schemas to validate each intent shape:
  - ADD_REMINDER: z.object({ intent: z.literal('ADD_REMINDER'), message: z.string().min(1), datetime: z.string().datetime(), forWhom: z.enum(['both', 'user1', 'user2']) })
  - (similar for all other intents)
- In `intentParser.ts`, after JSON.parse, validate with Zod
- If validation fails, return CHITCHAT fallback with "לא הבנתי, אפשר לנסות שוב? 🤔"
```

```
TASK 17: Add health check endpoint
- Add GET /api/health that returns:
  - DB connection status
  - WhatsApp client connection status
  - Last message processed timestamp
  - Uptime
- Add GET /api/health/ready (for k8s readiness probe)
```

```
TASK 18: Add rate limiting
- Create `src/middleware/rateLimiter.ts`
- Limit to 10 messages per user per minute
- Limit to 30 messages per group per minute
- If rate limited, reply once: "לאט לאט! 🐢 נסו שוב עוד רגע"
- Then silently ignore until the window expires
```

```
TASK 19: Add retry logic and circuit breaker for external APIs
- Create `src/utils/retry.ts` with a generic retry wrapper (exponential backoff, max 3 retries)
- Apply to: Google Calendar API calls, Groq API calls
- Add circuit breaker: if an API fails 5 times in 2 minutes, stop trying for 1 minute and use fallback
- Groq fallback = command parser (non-AI mode)
- Google Calendar fallback = "לא הצלחתי לגשת ליומן, נסו שוב בעוד דקה"
```

```
TASK 20: Add test suite
- Add Jest + ts-jest as dev dependencies
- Create tests for:
  - `src/ai/commandParser.test.ts` - test keyword patterns match correctly
  - `src/ai/intentValidator.test.ts` - test Zod schemas validate/reject correctly
  - `src/db/repositories/*.test.ts` - test CRUD operations (use test DB)
  - `src/handlers/*.test.ts` - test handler logic with mocked integrations
- Add `"test": "jest"` to package.json scripts
- Target: at least the command parser and intent validator must have 100% coverage
```

```
TASK 21: Remove unused dependencies
- Remove `@anthropic-ai/sdk` from package.json (never imported)
- Remove `@google/generative-ai` from package.json (never imported)
- Run npm install to update lockfile
```

```
TASK 22: Ensure data directory and logs directory exist on startup
- In `index.ts`, before `initDb()`, ensure `data/` directory exists (use `fs.mkdirSync` with recursive:true)
- Similarly ensure `logs/` directory exists before Winston initializes
```

---

### Phase 6: Dobby Identity & Branding

```
TASK 23: Generate and set Dobby's WhatsApp profile picture
- Create a profile picture for Dobby: a cute house-elf character inspired by Dobby from Harry Potter, holding a sock, with warm colors and a friendly expression
- Save as `assets/dobby-profile.png` (512x512, PNG)
- In `whatsappClient.ts`, after client is ready, set the profile picture:
  ```
  client.on('ready', async () => {
    const media = MessageMedia.fromFilePath('assets/dobby-profile.png');
    await client.setProfilePicture(media);
  });
  ```
- Note: whatsapp-web.js supports setProfilePicture on the client
```

```
TASK 24: Set Dobby's WhatsApp status/about
- After client is ready, set the status to Hebrew:
  "דובי - העוזר המשפחתי 🧦 | שלחו 7 לתפריט"
```

---

## Dependency Order

```
Phase 1 (Foundation):
  TASK 1 (portable task store) -> can start immediately
  TASK 2 (PostgreSQL) -> can start immediately
  TASK 3 (dynamic config) -> depends on TASK 2
  TASK 4 (multi-family WhatsApp) -> depends on TASK 2, TASK 3
  TASK 5 (multi-user calendar) -> depends on TASK 3, TASK 4
  TASK 6 (graceful shutdown) -> can start immediately

Phase 2 (Menu system):
  TASK 7 (command parser) -> depends on TASK 10 (needs Hebrew strings)
  TASK 8 (menu flow) -> depends on TASK 7
  TASK 9 (AI toggle) -> depends on TASK 7, TASK 8

Phase 3 (Hebrew):
  TASK 10 (i18n system) -> can start immediately
  TASK 11 (Hebrew text) -> depends on TASK 10
  TASK 12 (Hebrew dates) -> can start immediately

Phase 4 (Backend):
  TASK 13 (HTTP API) -> depends on TASK 2, TASK 3
  TASK 14 (self-onboarding) -> depends on TASK 4, TASK 13
  TASK 15 (OAuth per-member) -> depends on TASK 13, TASK 5

Phase 5 (Hardening):
  TASK 16 (intent validation) -> can start after TASK 7
  TASK 17 (health check) -> depends on TASK 13
  TASK 18 (rate limiting) -> depends on TASK 4
  TASK 19 (retry/circuit breaker) -> can start immediately
  TASK 20 (tests) -> depends on TASK 7, TASK 16
  TASK 21 (cleanup deps) -> can start immediately
  TASK 22 (ensure directories) -> can start immediately

Phase 6 (Branding):
  TASK 23 (profile picture) -> can start immediately
  TASK 24 (WhatsApp status) -> can start immediately
```

## Recommended Execution Order (for a single developer)

1. TASK 6, TASK 21, TASK 22 (quick wins, 30 min)
2. TASK 10, TASK 12 (i18n foundation)
3. TASK 1 (portable task store - unblocks cloud deployment)
4. TASK 2 (PostgreSQL schema)
5. TASK 3 (dynamic config)
6. TASK 4 (multi-family WhatsApp)
7. TASK 5 (multi-user calendar)
8. TASK 7 (command parser)
9. TASK 8 (menu flow)
10. TASK 9 (AI toggle)
11. TASK 11 (all Hebrew text)
12. TASK 16 (intent validation)
13. TASK 13 (HTTP API)
14. TASK 14 (self-onboarding)
15. TASK 15 (OAuth per-member)
16. TASK 17, TASK 18, TASK 19 (production hardening)
17. TASK 20 (tests)
18. TASK 23, TASK 24 (branding)
