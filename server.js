import express from "express";
import loader from "./data/loader.js";
import dotenv from "dotenv";
import logger from "morgan";
import methodOverride from "method-override";
import session from "express-session";
import flash from "express-flash";
import apiRoutes from "./routes/apiRoutes.js";
import mainRoutes from "./routes/mainRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import Database from "better-sqlite3";
import SqliteStoreFactory from "better-sqlite3-session-store";

const SqliteStore = SqliteStoreFactory(session);
const db = new Database("sessions.db");

dotenv.config({
  path: "./config/.env",
});

const app = express();
const port = process.env.PORT || 3000;

//Using EJS for views
app.set("view engine", "ejs");

//Static Folder
app.use(express.static("public"));

//Body Parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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
//Flash the error messages
app.use(flash());

// Initialize data
await loader.loadAll();

// Use routes
app.use("/api", apiRoutes);
app.use("/", mainRoutes);
app.use("/", authRoutes);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
