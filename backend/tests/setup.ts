import { vi } from "vitest";

// Ensure startup guard in geminiClient does not exit process in tests
process.env["GEMINI_API_KEY"] = "mock-api-key-for-automated-tests";

// Automatically mock geminiClient with fixed schema-valid responses
vi.mock("../src/services/geminiClient.js", async () => {
  return await import("../src/services/__mocks__/geminiClient.js");
});
