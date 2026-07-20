import "dotenv/config"; // MUST be first: load env before anything reads it
import { createApp } from "./app";
import { env } from "./config/env";

/** Entry point — the only file that binds a port (Ch 6). */
const app = createApp();

app.listen(env.PORT, () => {
  console.log(`🚀 API running at http://localhost:${env.PORT}`);
  console.log(`   health:     http://localhost:${env.PORT}/health`);
  console.log(`   api base:   http://localhost:${env.PORT}/api/v1`);
});
