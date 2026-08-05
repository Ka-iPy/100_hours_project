# 100 Hours Project — D&D 5e Character Creator

A full-featured **D&D 5e character creator** built on top of the [5etools](https://5e.tools/) dataset, with a **traceable attribute system**: every number on your character sheet knows exactly where it came from.

## Features

- **8-step character creation wizard**
  1. Name & identity
  2. Race (with subrace support)
  3. Class, subclass & starting level
  4. Background
  5. Ability scores & racial ASIs
  6. Starting equipment — pick between options (rapier *or* shortsword…) with weight/value breakdowns
  7. Spellcasting selection — cantrips + per-level spell pickers for known, prepared, and half-caster classes
  8. Review with **Cerberus** integrity inspection (auto-granted spells, missing prerequisites, etc.)

- **Traceable attributes** — every attribute is a `TracedValue`/`TracedModifier` carrying its origin (RACE, SUBRACE, BACKGROUND, CLASS, SUBCLASS, FEAT, ASI, MAGIC_ITEM, …). Query where any number came from via `GET /api/character/:id/sources/:attr`.

- **Full character sheet** — tabs for attributes & skills, inventory & equipment, features & biography, spells (with slot tracking), and custom notes. Every spell/feature name is a tooltip with full 5etools-formatted text (via a ported `Parser`/`Tags`).

- **Markdown export** — download a printable Markdown character sheet.

- **Auth** — signup / login with bcrypt password hashing and SQLite-backed sessions.

- **All D&D content** — races, subclasses, backgrounds, feats, spells, items, and character creation options straight from the 5etools JSON data, with source-tagged versions (PHB, XPHB, TCE, …).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express 5 (ES Modules) |
| Views | EJS templating |
| Storage | JSON files (`data/generated/`) for users & characters |
| Sessions | `express-session` + `better-sqlite3` (session DB lives in `~/.dndvault-sessions.db`) |
| Auth | `bcrypt` |
| Extras | `pdf-lib` (PDF generation), `morgan` (logging), `multer`, `validator` |

## Getting Started

### Prerequisites

- Node.js **≥ 20** (project developed on Node 26)
- npm

### Installation

```bash
npm install
```

### Configuration

Copy the environment file if it does not exist:

```bash
# config/.env
PORT=3000
```

The session secret is currently hardcoded in `server.js` — move it to the environment before deploying.

### Run

```bash
# Development (auto-reload via nodemon)
npm run dev

# Production
npm start          # node server.js
```

Then open http://localhost:3000. Create an account on `/signup`, then build a character from `/createCharacter`.

> **Note on first boot:** the data loader parses the full 5etools dataset at startup. Startup takes a few seconds.

## Project Structure

```
├── server.js              # Express entry point
├── config/.env            # Environment variables
├── routes/                # Express routers (main, auth, api)
├── controllers/           # Request handlers
├── models/                # Domain models & business logic
│   ├── Character.js       # Character + Spellbook models
│   ├── CharacterBuilder.js# Builds characters from wizard input
│   ├── Cerberus.js        # Integrity inspector (source tracking checks)
│   ├── SpellListResolver.js # Class spell lists, slots, prepared counts
│   ├── TracedModifier.js  # Traceable attribute/value system
│   └── User.js            # User auth model
├── utils/
│   ├── parser.js          # 5etools Parser + Tags (rendering helpers)
│   └── featureSelectability.js
├── data/                  # Read-only 5etools data (races, classes, spells…)
│   ├── loader.js          # Singleton data loader + relationship maps
│   └── generated/         # Generated characters & users (do not edit)
├── views/                 # EJS templates (+ partials)
├── public/                # Static assets (CSS/JS)
└── templates/             # PDF templates
```

## API

### Web routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Landing page |
| GET | `/login`, `/signup` | Auth pages |
| GET | `/hall` | Character gallery (auth required) |
| GET | `/createCharacter` | Character creator wizard |
| POST | `/createCharacter` | Create character (auth required) |
| GET | `/character/:id` | Character sheet |
| GET | `/character/:id/markdown` | Markdown export |
| PUT | `/character/:id` | Update character |
| DELETE | `/character/:id` | Delete character |
| POST | `/signup`, `/login`, `/logout` | Auth actions |

### JSON API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/spells/context/:className/:level` | Spell selection context (lists, slots, prepared counts) |
| GET | `/api/spellbook` | Spellbook rendering data (Parser-formatted) |
| GET | `/api/equipment/class/:className` | Starting equipment choices |
| GET | `/api/lookup?type=&name=&source=` | Entity lookup with source links |
| GET | `/api/character/:id/sources/:attr` | Trace which sources contributed to an attribute |
| GET | `/api/:collection?q=term` | Query any loaded data collection |

## Data Architecture

- **`data/loader.js`** is a singleton that loads the 5etools JSON files at startup and exposes typed lookups:

  ```js
  loader.getRace(name, source);
  loader.getClass(name, source);
  loader.getBackground(name, source);
  loader.getFeat(name, source);
  loader.getSubclass(className, subclassName, source);
  ```

- It also builds **relationship maps** used by the inspector: `featOrigins`, `subraceParents`, `classFeatureParents`, `subclassFeatureParents`.

- **Data files are read-only.** Everything written by the app (users, characters) goes to `data/generated/`.

- The base-item data lives in `data/items-base.json` (`baseitem` array) and is merged into the item catalog at load time — basic gear (rapier, leather armor, …) and magic items are addressable through the same lookups.

## Building Characters Programmatically

```js
import loader from "./data/loader.js";
import { CharacterBuilder } from "./models/CharacterBuilder.js";

await loader.loadAll();

const builder = new CharacterBuilder(loader);
const character = builder.build({
  name: "My Character",
  race: "Goliath",
  raceSource: "XPHB",
  classes: [{ name: "Fighter", source: "PHB", level: 1 }],
  backgrounds: [{ name: "Soldier", source: "PHB" }],
  selectedCantrips: [{ name: "Guidance", source: "PHB" }],
  selectedSpells: [{ name: "Aid", source: "PHB", level: 2 }],
  equipmentChoices: [{ groupIndex: 0, choiceKey: "b" }],
});
await character.save();
```

## Tests

No test framework is configured yet; test scripts are plain Node programs:

```bash
node test-loader.js
node test-feature-select.js
```

`test-loader.js` verifies the whole dataset loads with zero unresolved references.

## Credits & License

- Game data and the `Parser`/`Tags` rendering code are ported from [5etools](https://5e.tools/) (content © Wizards of the Coast; 5etools data licensed under CC-BY; see 5etools licenses).
- This project is a learning project — not affiliated with Wizards of the Coast.
