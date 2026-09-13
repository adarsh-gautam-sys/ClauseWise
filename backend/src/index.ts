import express from "express";

const PORT = process.env["PORT"] ?? 3001;

const app = express();

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`ClauseWise backend listening on port ${String(PORT)}`);
});

export default app;
