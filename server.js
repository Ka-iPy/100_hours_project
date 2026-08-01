import express from "express";
import loader from "./data/loader.js";
import dotenv from "dotenv";
import logger from "morgan";
import methodOverride from "method-override";
import session from "express-session";
import apiRoutes from "./routes/apiRoutes.js";
import mainRoutes from "./routes/mainRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import Database from "better-sqlite3";
import SqliteStoreFactory from "better-sqlite3-session-store";
import os from "os";
import { join } from "path";

const SqliteStore = SqliteStoreFactory(session);
// Keep the session DB off the external HDD (project dir) — synchronous sqlite
// writes (fsync) to a spinning disk added 150-600ms per saved session.
const db = new Database(join(os.homedir(), ".dndvault-sessions.db"));

dotenv.config({
  path: "./config/.env",
});

const app = express();
const port = process.env.PORT || 3000;

//Using EJS for views
app.set("view engine", "ejs");

//Static Folder
app.use(express.static("public"));
//Serves utils/parser.js (shared 5etools tag parsing) to the browser
app.use("/utils", express.static("utils"));

//Body Parsing
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));

//Logging
app.use(logger("dev"));

//Session
app.use(
  session({
    store: new SqliteStore({
      client: db,
    }),
    secret: "Nah imma stay",
    resave: false,
    saveUninitialized: false,
  }),
);

/**
 * Minimal flash middleware. Replaces `express-flash`, whose render proxy
 * called `req.flash()` on every render — deleting `req.session.flash` even
 * when no message existed, marking the session modified and forcing a
 * synchronous store write per page view.
 */
app.use((req, res, next) => {
  req.flash = (type, message) => {
    if (type == null) {
      const all = req.session.flash || {};
      if (Object.keys(all).length) delete req.session.flash;
      return all;
    }
    if (message == null) {
      const value = req.session.flash?.[type];
      if (value !== undefined) {
        delete req.session.flash[type];
        if (!Object.keys(req.session.flash).length) delete req.session.flash;
      }
      return value;
    }
    req.session.flash = req.session.flash || {};
    req.session.flash[type] = message;
    return message;
  };
  const pending = req.session?.flash;
  res.locals.messages = pending && Object.keys(pending).length ? pending : {};
  next();
});

// Initialize data
await loader.loadAll();

// Use routes
app.use("/api", apiRoutes);
app.use("/", mainRoutes);
app.use("/", authRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
