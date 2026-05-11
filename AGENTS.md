# AGENTS.md

## Project Overview
**100 Hours Project** - D&D 5e Character Creator with Traceable Attribute System
- **Stack:** Node.js, Express 5, EJS, JSON file-based storage
- **Module System:** ES Modules (import/export)
- **Entry Point:** `server.js` on port 3000

---

## Build, Run & Test Commands

```bash
# Install dependencies
npm install

# Run development server with auto-reload
npm run dev

# Run a single test file (using Node directly)
node test-loader.js
node test-feature-select.js

# Run the server in production
node server.js
```

### Key Environment Variables (in `config/.env`)
```
PORT=3000
```

---

## Code Style Guidelines

### ES Modules (Required)
- Use `import/export` syntax throughout
- Include `.js` extension in all relative imports
- Example: `import loader from "./data/loader.js";`

### Import Organization
1. External packages (express, bcrypt, etc.)
2. Internal modules (controllers, models, routes)
3. Relative utilities
4. Order with empty line between groups

```javascript
import express from "express";
import bcrypt from "bcrypt";
import loader from "./data/loader.js";
import { CharacterBuilder } from "./models/CharacterBuilder.js";
```

### File Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Routes | `nameRoutes.js` | `mainRoutes.js` |
| Controllers | `nameController.js` | `characterController.js` |
| Models | PascalCase | `Character.js`, `User.js` |
| Utilities | `snake_case.js` | `featureSelectability.js` |
| Data Loader | `loader.js` (singleton) | `data/loader.js` |

### Class Conventions
- Use `export class ClassName` pattern
- Static factory methods: `static fromJSON(json)`, `static race(...)`
- Instance methods follow verb-noun: `calculate()`, `getPrimarySource()`, `addSource()`
- Always implement `toJSON()` and `fromJSON()` for serialization

### Data Models
- Character attributes use traced values (see `TracedValue`, `TracedModifier`)
- Source tracking required: every attribute must know its origin
- JSON serialization for all persisted data

### Error Handling
- Controllers: try-catch with appropriate HTTP status codes
- Return `{ error: message }` or `{ error: message, stack: err.stack }` for JSON APIs
- Use `console.error()` for logging server errors
- Flash messages for user-facing errors: `req.flash("error", "message")`

### Routes Pattern
```javascript
export default {
  routeName: async (req, res) => { /* ... */ },
};
```
Export controller functions as an object; import with:
```javascript
import characterController from "../controllers/characterController.js";
characterController.routeName;
```

### Response Patterns
- Render EJS views: `res.render("viewName", { data })`
- JSON APIs: `res.status(code).json(data)`
- Redirects: `res.redirect("/path")`
- Flash then redirect: `req.flash("success", "msg"); res.redirect("/path");`

---

## Directory Structure

```
100_hours_project/
├── server.js              # Express app entry point
├── package.json           # Dependencies & scripts
├── config/.env            # Environment variables
├── routes/                # Route definitions
├── controllers/           # Request handlers
├── models/                # Data models & business logic
├── data/                  # 5etools JSON data + loader.js
│   └── generated/         # Generated character files
├── views/                 # EJS templates
│   └── partials/         # Header/footer includes
└── public/                # Static assets
```

---

## Key Patterns

### Source References (TracedModifier.js)
Every character attribute tracks its source using `SOURCE_CATEGORIES`:
- `RACE`, `SUBRACE`, `BACKGROUND`, `CLASS`, `SUBCLASS`
- `FEAT`, `ASI`, `MAGIC_ITEM`, `CHAR_CREATION_OPTION`, `VARIANT_RULE`

### Data Lookup Pattern
```javascript
loader.getRace(name, source);        // source defaults to 'PHB'
loader.getClass(name, source);
loader.getBackground(name, source);
loader.getFeat(name, source);
loader.getSubclass(className, subclassName, source);
loader.getCharCreationOption(name, source);
```

### Character Building
```javascript
const builder = new CharacterBuilder(loader);
const character = builder.build({
  name: "My Character",
  race: "Goliath",
  raceSource: "XPHB",
  classes: [{ name: "Fighter", source: "PHB", level: 1 }],
  backgrounds: [{ name: "Soldier", source: "PHB" }],
});
await character.save();
```

### Data Relationship Maps
- `loader.featOrigins` - Map<featName, {type, name, source}>
- `loader.subraceParents` - Subrace → parent race
- `loader.classFeatureParents` - Class feature → class
- `loader.subclassFeatureParents` - Subclass feature → subclass

---

## Testing Guidelines
- Test files are plain Node scripts: `node test-loader.js`
- Include `await loader.loadAll()` before accessing data
- No test framework currently configured

---

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Landing page |
| GET | `/login`, `/signup`, `/hall` | Auth pages |
| GET | `/createCharacter` | Character creator form |
| POST | `/createCharacter` | Create character |
| GET | `/character/:id` | Get character |
| PUT | `/character/:id` | Update character |
| GET | `/api/:collection?q=term` | Query data |
| GET | `/api/character/:id/sources/:attr` | Trace attribute sources |

---

## Important Notes

1. **Data files are read-only** - Located in `5etools-v2.25.2/` and loaded at startup
2. **Generated data** goes in `data/generated/` (characters, users)
3. **Session secret** is hardcoded in server.js (move to .env for production)
4. **No tests** - This is a current gap in the codebase
5. **CSS/JS files are empty** - `public/styles/styles.css` and `public/js/main.js`
