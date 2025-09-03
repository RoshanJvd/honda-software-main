import express from "express";
import cors from "cors";
import morgan from "morgan";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/error.js";
import { CORS_ORIGIN } from "./config/index.js";

export function createApp() {
  const app = express();
  const allowedOrigins = Array.isArray(CORS_ORIGIN)
    ? CORS_ORIGIN
    : [CORS_ORIGIN];

  app.use(
    cors({
      origin: allowedOrigins,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "x-role", "x-user-id"],
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));
  app.use("/api", routes);
  app.use(errorHandler);
  return app;
}
