import { connectDB } from './db.js';
import { createApp } from './app.js';
import { PORT } from './config/index.js';

(async () => {
  await connectDB();
  const app = createApp();
  const server = app.listen(PORT, () => console.log(`API listening on port ${server.address().port}`));
})();
