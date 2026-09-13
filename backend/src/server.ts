/**
 * Server entrypoint — binds the port and starts listening.
 *
 * Importing geminiClient here triggers the startup fast-fail check for
 * GEMINI_API_KEY before any requests can be accepted.
 */

import app from "./app.js";
import { logger } from "./lib/logger.js";

// Side-effect import: validates GEMINI_API_KEY at startup and exits if missing.
import "./services/geminiClient.js";

const PORT = Number(process.env["PORT"] ?? 3001);

app.listen(PORT, () => {
  logger.info(`ClauseWise backend listening on port ${PORT.toString()}`);
});
