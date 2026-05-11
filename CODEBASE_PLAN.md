# Codebase Plan — Senior Dev's Guide for Interns

> **Project:** 100 Hours Project — D&D 5e Character Creator with Traceable Attribute System  
> **Stack:** Node.js (Express 5), EJS, JSON file storage  
> **Modules:** ES Modules (`import`/`export` with `.js` extensions)

---

## Table of Contents

1. [What This Project Does](#1-what-this-project-does)
2. [Directory Structure (Every File Explained)](#2-directory-structure-every-file-explained)
3. [Server Entry Point — `server.js`](#3-server-entry-point--serverjs)
4. [Routes — How Requests Flow](#4-routes--how-requests-flow)
5. [Controllers — The Request Handlers](#5-controllers--the-request-handlers)
6. [The Data Loader — `data/loader.js`](#6-the-data-loader--dataloaderjs)
7. [Models — The Core Data Classes](#7-models--the-core-data-classes)
   - [TracedModifier.js — The Tracing System](#71-tracedmodifierjs--the-tracing-system)
   - [Character.js — The Main Character Model](#72-characterjs--the-main-character-model)
   - [CharacterBuilder.js — The Builder Pattern](#73-characterbuilderjs--the-builder-pattern)
   - [SpellListResolver.js — Spell Context](#74-spelllistresolverjs--spell-context)
   - [User.js — Simple File-Based Auth](#75-userjs--simple-file-based-auth)
8. [Utilities](#8-utilities)
   - [featureCategory.js — What Kind of Feature Is This?](#81-featurecategoryjs)
   - [featureSelectability.js — Does This Feature Need a Choice?](#82-featureselectabilityjs)
9. [Views — The EJS Templates](#9-views--the-ejs-templates)
10. [Public Assets](#10-public-assets)
11. [Test Files](#11-test-files)
12. [Full API Reference](#12-full-api-reference)
13. [Data Flow Walkthroughs](#13-data-flow-walkthroughs)
14. [Current State & Known Gaps](#14-current-state--known-gaps)
15. [Common Pitfalls for New Developers](#15-common-pitfalls-for-new-developers)

---

## 1. What This Project Does

This is a **web-based D&D 5th Edition character creator**. Users sign up, log in, create characters by picking race, class, background, feats, ability scores, equipment, and spells — then view/edit them on a digital character sheet.

**The killer feature:** Every single number on the character sheet knows *where it came from*. Your AC is 18? The system can tell you "16 from Chain Mail (Fighter starting equipment) + 2 from your Dexterity modifier (Goliath race) + 1 from the Defense fighting style (Fighter class feature)." This is called **source tracing**, and it's the whole reason this project exists.

---

## 2. Directory Structure (Every File Explained)

```
100_hours_project/
│
├── server.js                  ★ THE ENTRY POINT
│   Configures Express, loads all middleware (sessions, flash, body parsers,
│   logger), mounts routes, then calls loader.loadAll() to load ALL D&D data
│   from 5etools JSON files into memory, then starts listening on port 3000.
│
├── package.json               Dependencies & scripts. "type": "module" means
│                               all .js files use ES Modules by default.
│   Scripts: npm run dev = nodemon for auto-reload, node test-loader.js etc.
│
├── AGENTS.md                  Instructions for AI coding assistants.
│   Documents conventions, patterns, directory structure, build commands.
│
├── CODEBASE_PLAN.md           ← YOU ARE HERE
│
├── .gitignore                 Currently just ignores data/generated/characters/
│
├── sessions.db                Auto-created SQLite database for session storage.
│   (Not in git — generated at runtime by better-sqlite3-session-store)
│
├── migrate-data.js            One-time migration script that adds UUIDs to
│                               existing users in users.json and migrates the
│                               character "player" field from username→userID.
│                               Safe to delete once all users are migrated.
│
├── test-loader.js             Manual test for DataLoader: feat origins,
│                               subclass feature parents, subrace parents,
│                               spell search, and data stats counters.
│
├── test-feature-select.js     Manual test for feature selectability detection
│                               (8 test cases) and a full Goliath Fighter build
│                               integration test via CharacterBuilder.
│
├── config/
│   └── .env                   Environment variables. Currently EMPTY.
│                               PORT=3000 can go here. dotenv is configured
│                               in server.js but .env has nothing yet.
│
├── routes/                    ★ ROUTE FILES — map URLs to controllers
│   ├── mainRoutes.js          Page routes: /, /login, /signup, /hall,
│   │                           /createCharacter (GET+POST),
│   │                           /character/:id (GET+PUT+DELETE+GET pdf)
│   ├── apiRoutes.js           REST API: data collections, relationships,
│   │                           spell context, starting equipment,
│   │                           character source tracing
│   └── authRoutes.js          Auth actions: POST /signup, /login, /logout
│
├── controllers/               ★ CONTROLLERS — business logic lives here
│   ├── mainController.js      Simple: renders index, login, signup, hall pages
│   ├── characterController.js THE BIG ONE (770 lines). Character CRUD + PDF
│   │                           generation + source tracing + view helpers.
│   │                           Handles 6 different routes.
│   ├── authController.js      Signup (bcrypt hash, save to users.json),
│   │                           login (verify password, set session),
│   │                           logout (destroy session)
│   └── apiController.js       Data API: search collections, feat origin,
│   │                           subclass/subrace relationships, spell context,
│   │                           starting equipment for a class
│
├── models/                    ★ MODELS — data structures & business logic
│   ├── TracedModifier.js      The foundation (365 lines). SourceReference,
│   │                           TracedModifier, TracedValue, TracedResource.
│   │                           Everything else builds on this.
│   ├── Character.js           The giant (947 lines). Character class plus 7
│   │                           sub-classes. Full D&D 5e character model with
│   │                           source tracking on every attribute.
│   ├── CharacterBuilder.js    Builder pattern (760 lines). Takes form data,
│   │                           applies race/class/background/feat rules in
│   │                           order, returns a fully-traced Character.
│   ├── SpellListResolver.js   Given class+level, figures out which cantrips
│   │                           and spells a character can know/prepare.
│   │                           Handles known-caster, prepared-caster,
│   │                           subclass spell lists, domain/oath spells.
│   └── User.js                Tiny (44 lines). File-based CRUD for users.
│   │                           bcrypt passwords, UUIDs, stored in users.json.
│
├── utils/                     ★ UTILITY FUNCTIONS
│   ├── featureCategory.js     Categorizes features: is this a real feature,
│   │                           an ASI, a language, a fighting style, etc.?
│   ├── featureSelectability.js Detects if a feature description implies the
│                               user must make a choice ("choose one skill").
│
├── data/                      ★ D&D DATA (5etools v2.25.2 JSON format)
│   ├── loader.js              Singleton DataLoader class. Loads ALL JSON
│   │                           files into memory at startup. Provides
│   │                           getRace(), getClass(), getFeat(), etc.
│   │                           Also builds relationship maps (feat origins,
│   │                           subrace parents, feature parents).
│   ├── users.json             Created at runtime. Array of {id,username,password}.
│   ├── generated/
│   │   └── characters/        Created at runtime. One JSON file per character.
│   │
│   ├── races.json             All races + subraces from all sourcebooks
│   ├── backgrounds.json       Backgrounds with skill/tool/language proficiencies
│   ├── feats.json             Feats with ability increases and prereqs
│   ├── optionalfeatures.json  Fighting styles, eldritch invocations,
│   │                           metamagic, maneuver options, etc.
│   ├── items.json             Magic items, weapons, armor, adventuring gear
│   ├── items-base.json        Base items (generic equipment)
│   ├── skills.json            18 skills mapped to abilities
│   ├── languages.json         Standard + exotic languages
│   ├── charcreationoptions.json Dark gifts, supernatural gifts, etc.
│   ├── conditionsdiseases.json Status conditions for reference
│   ├── spells/                30+ JSON files, one per sourcebook
│   ├── class/                 15+ JSON files (one per class + sidekick + mystic)
│   └── generated/
│       └── gendata-spell-source-lookup.json
│                               Generated map: spellName → source book
│
├── views/                     ★ EJS TEMPLATES
│   ├── index.ejs              Landing page. "To the next adventure" heading,
│   │                           links to login/signup.
│   ├── login.ejs              Login form with flash message support.
│   │                           Posts to POST /login.
│   ├── signup.ejs             Registration form with flash message support.
│   │                           Posts to POST /signup.
│   ├── hall.ejs               User lobby. Shows username, logout link,
│   │                           "Create a Character" link, and character list
│   │                           (fetched via Character.loadAllForPlayer()).
│   ├── characterCreator.ejs   ★ 553 lines. The full character creation form:
│   │                           - Name, race dropdown, subrace (filtered by JS on race change)
│   │                           - Class dropdown, level input, subclass (filtered on class change)
│   │                           - Background, alignment, feats multi-select
│   │                           - 6 ability score inputs (default 10)
│   │                           - Dynamic equipment choices (fetched from API on class change)
│   │                           - Dynamic spell selection (fetched from API on class+level change)
│   │                           - Submits JSON via fetch(), redirects on success
│   ├── character.ejs          ★ 1066 lines. The digital character sheet, 2-page spread:
│   │                           PAGE 1: ability scores, saves, skills, AC, initiative,
│   │                           speed, HP, hit dice, death saves, attacks, equipment,
│   │                           features, personality traits
│   │                           PAGE 2 (conditional): spellcasting ability, save DC,
│   │                           attack bonus, cantrips, spell slots, spells by level
│   │                           Key feature: inline editing via JS toggle,
│   │                           AJAX PUT to save, bubble clicks for toggles
│   ├── error.ejs              Simple error page with heading + message
│   └── partials/
│       ├── header.ejs         DOCTYPE, html, head with charset/viewport/css link,
│       │                       opens body tag. Used by every view.
│       └── footer.ejs         Closes body/html, includes /js/main.js defer
│
└── public/                    ★ STATIC ASSETS
    ├── styles/styles.css      EMPTY. No CSS has been written yet.
    │                           The character sheet renders with basic browser
    │                           defaults. This is the biggest visual gap.
    └── js/main.js             EMPTY. No client-side JS has been written yet
    │                           beyond what's inline in the EJS templates.
```

---

## 3. Server Entry Point — `server.js`

The server does 4 things in order:

### Step 1: Import everything

```javascript
import express from "express";
import dotenv from "dotenv";
import logger from "morgan";
import methodOverride from "method-override";
import session from "express-session";
import flash from "express-flash";
import SQLiteStoreFactory from "better-sqlite3-session-store";
import loader from "./data/loader.js";
import apiRoutes from "./routes/apiRoutes.js";
import mainRoutes from "./routes/mainRoutes.js";
import authRoutes from "./routes/authRoutes.js";
```

**Note:** The `loader` import is a **singleton** — the DataLoader is instantiated once at module level in `data/loader.js` and imported everywhere. There's only one loader instance for the entire application.

### Step 2: Configure middleware (order matters!)

```javascript
app.use(express.static("public"));        // Serve /public/* as static files
app.use(express.urlencoded({ extended: true })); // Parse form POST bodies
app.use(express.json());                  // Parse JSON POST bodies
app.use(logger("dev"));                   // Morgan HTTP logging
```

Then sessions (using SQLite-backed store):

```javascript
const SQLiteStore = SQLiteStoreFactory(session);
app.use(session({
  store: new SQLiteStore({ db: "sessions.db", dir: "." }),
  secret: "Nah imma stay",                // TODO: move to .env
  resave: false,
  saveUninitialized: false,
}));
app.use(flash());
```

The session stores `{ id, username }` on login. Every handler checks `req.session.id` to know who's logged in.

### Step 3: Load all D&D data (async)

```javascript
await loader.loadAll();
```

This reads every single JSON file in `data/` (races, classes, spells, items, feats, backgrounds, etc.) into memory. It takes about 100-200ms. It's idempotent — calling it again does nothing if already loaded.

### Step 4: Mount routes and start listening

```javascript
app.use("/api", apiRoutes);
app.use("/", mainRoutes);
app.use("/", authRoutes);
app.listen(port); // default 3000
```

Route order: API first, then page routes, then auth. Since they handle different paths, order doesn't matter much here.

---

## 4. Routes — How Requests Flow

### `mainRoutes.js` — Page Routes

| Method | Path | Controller | What It Does |
|--------|------|-----------|-------------|
| GET | `/` | `mainController.index` | Render landing page |
| GET | `/login` | `mainController.loginPage` | Render login form |
| GET | `/signup` | `mainController.signupPage` | Render signup form |
| GET | `/hall` | `mainController.hall` | Show user's character list |
| GET | `/createCharacter` | `characterController.getCharacterCreator` | Show character creation form |
| POST | `/createCharacter` | `characterController.createCharacter` | Create character, return JSON (201) |
| GET | `/character/:id` | `characterController.getCharacter` | Show character sheet page |
| GET | `/character/:id/pdf` | `characterController.printPDF` | Generate + download PDF via Puppeteer |
| PUT | `/character/:id` | `characterController.updateCharacter` | Update character fields, return JSON |
| DELETE | `/character/:id` | `characterController.deleteCharacter` | Delete character, redirect to /hall |

### `apiRoutes.js` — API Routes

| Method | Path | Controller | What It Does |
|--------|------|-----------|-------------|
| GET | `/api/:collection` | `apiController.getCollection` | Search a data collection (races, classes, feats, etc.) by query param `?q=` |
| GET | `/api/relationships/feat-origin/:name` | `apiController.getFeatOrigin` | Find which race/background grants a given feat |
| GET | `/api/relationships/subclass-feature-parent` | `apiController.getSubclassFeatureParent` | Query param `?feature=` — find parent subclass |
| GET | `/api/relationships/subrace-parent` | `apiController.getSubraceParent` | Query param `?subrace=&race=` — find parent race |
| GET | `/api/spells/context/:className/:level` | `apiController.getSpellContext` | Get spell selection context for a class at a level |
| GET | `/api/equipment/class/:className` | `apiController.getStartingEquipment` | Get starting equipment options for a class |
| GET | `/api/character/:id/sources/:attribute` | `characterController.getCharacterSources` | Trace where a character attribute comes from |

### `authRoutes.js` — Auth Routes

| Method | Path | Controller | What It Does |
|--------|------|-----------|-------------|
| POST | `/signup` | `authController.signup` | Create user with bcrypt-hashed password |
| POST | `/login` | `authController.login` | Verify credentials, set session |
| POST | `/logout` | `authController.logout` | Destroy session, redirect to / |

---

## 5. Controllers — The Request Handlers

### `mainController.js` (21 lines)

The simplest controller. Just renders static-ish pages:

- **`index(req, res)`** — Renders `index.ejs`. No special data needed.
- **`loginPage(req, res)`** — Renders `login.ejs`. Flash messages handled automatically by `express-flash`.
- **`signupPage(req, res)`** — Renders `signup.ejs`. Same flash pattern.
- **`hall(req, res)`** — The user lobby. Gets the user's ID from `req.session.id`, calls `Character.loadAllForPlayer(userId)` to find all their characters, and renders `hall.ejs` with the character list.

### `characterController.js` (770 lines)

This is the **largest and most complex controller**. It handles:

**`getCharacterCreator(req, res)`**
1. Calls `loader.loadAll()` (idempotent)
2. Fetches ALL races, subraces, classes, subclasses, backgrounds, feats, char creation options from DataLoader
3. Filters races — excludes NPC races and lineages (e.g., "Reborn", "Hexblood") by checking `raceData._isLineage`
4. JSON-stringifies every entry (for safe EJS embedding into `<script>` tags)
5. Renders `characterCreator.ejs` with all the data arrays

**`createCharacter(req, res)`**
1. Instantiates `new CharacterBuilder(loader)`
2. Calls `builder.build(req.body)` which runs the full build pipeline:
   - applyRace → applySubrace → applyBackgrounds → applyClasses → applyFeats
   - applyCharCreationOptions → applyAbilityScores → applyStartingEquipment
   - applyEquipmentChoices → applySpellSelections → calculateDerivedStats
3. Calls `character.save()` to write to `data/generated/characters/{id}.json`
4. Returns HTTP 201 with the character JSON

**`getCharacter(req, res)`**
1. `Character.load(id)` — reads and deserializes the character JSON file
2. Calls `buildCharacterViewHelpers(character)` — this is a big helper function (about 150 lines) that computes all the display data:
   - **Ability scores** with their modifiers (e.g., 18 STR = +4 modifier)
   - **Saving throws** — checks each save against proficiencies, adds proficiency bonus
   - **Skills** — for each of 18 skills, computes: base ability mod + proficiency (+ PB) + expertise (+ 2×PB), with source tracking
   - **Combat stats** — AC, initiative, speed, HP (max/current/temp), hit dice, death saves
   - **Attacks** — from equipment, computes attack bonus and damage
   - **Spell data** — for each class spellbook, computes cantrips, spells known, spell slots, save DC, attack bonus. Resolves full spell data from the loader.
   - **Features** — filters to REAL_FEATURE and CUSTOM categories
3. Renders `character.ejs` with character + all helper data

**`updateCharacter(req, res)`**
1. `Character.load(id)` — loads current state
2. Iterates over `req.body` fields and updates matching character properties
3. Handles special fields: `name`, `alignment`, `currentHitPoints`, `tempHitPoints`, `inspiration`, `exhaustion`, death saves, currency, `abilityScores`, traits
4. Saves and returns JSON `{ success: true }`

**`deleteCharacter(req, res)`**
1. Calls `Character.delete(id)` — deletes the JSON file
2. Redirects to `/hall`

**`printPDF(req, res)`**
1. Launches a headless Chromium instance via `puppeteer-core`
2. Opens the character page URL
3. Waits for the page to render, generates a PDF
4. Sends the PDF as a download response

**`getCharacterSources(req, res)`**
1. `Character.load(id)` — loads character
2. Parses the attribute path (e.g., `abilityScores.strength`)
3. Walks the character object to find the `TracedValue`
4. Calls `getModifierBreakdown()` to get the full provenance
5. Returns JSON with total value + breakdown of every modifier + its source
6. Handles special cases: `skill`, `savingThrow`, `feature` lookups

### `authController.js` (49 lines)

- **`signup(req, res)`** — Checks if username exists, hashes password with bcrypt (10 rounds), creates `User` object, saves to `users.json`, sets session, redirects to `/hall`.
- **`login(req, res)`** — Finds user by username, compares bcrypt hash, sets session `{ id, username }` on success, redirects to `/hall`. On failure, flashes error and redirects to `/login`.
- **`logout(req, res)`** — `req.session.destroy()`, redirects to `/`.

### `apiController.js` (166 lines)

- **`getCollection(req, res)`** — Looks up `req.params.collection` on the loader (e.g., `loader.getRaces()` for `/api/races`). Supports `?q=` for name/entries search. Returns filtered array.
- **`getFeatOrigin(req, res)`** — Looks up `loader.featOrigins.get(name)` to find which race or background grants the named feat. Returns `{ type, name, source }`.
- **`getSubclassFeatureParent(req, res)`** — Takes `?feature=` query param, looks up `loader.subclassFeatureParents.get(featureName)`. Returns `{ className, subclassShortName, source, level }`.
- **`getSubraceParent(req, res)`** — Takes `?subrace=&race=&source=` query params, looks up `loader.subraceParents`. Returns parent `{ raceName, raceSource }`.
- **`getSpellContext(req, res)`** — Calls `SpellListResolver.getSpellSelectionContext(className, level)` to determine which cantrips and spells the character can select from, including subclass-specific lists (domain spells, oath spells, etc.).
- **`getStartingEquipment(req, res)`** — Loads the class data, parses `class.startingEquipment.defaultData` which has the format `[["itemId", quantity], ...]`, resolves item names via `loader.getItemByName()`, and returns the equipment options.

---

## 6. The Data Loader — `data/loader.js`

### What It Is

A **singleton** `DataLoader` class. One instance is created at the bottom of the file:

```javascript
const loader = new DataLoader();
export default loader;
export { loader };
```

Every file that needs D&D data imports this same instance. Only one copy of all D&D data exists in memory.

### How `loadAll()` Works (async)

```
1. Load races.json        → this.races, this.subraces  (split by hasSubrace flag)
2. Load backgrounds.json  → this.backgrounds
3. Load feats.json        → this.feats
4. Load optionalfeatures.json → this.optionalFeatures
5. Load spells/*.json     → this.spells (reads ALL files in spells/ directory)
6. Load items.json        → this.items
7. Load items-base.json   → this.itemsBase
8. Load skills.json       → this.skills
9. Load languages.json    → this.languages
10. Load class/*.json     → 
    - this.classes        (class definitions)
    - this.subclasses     (subclass definitions)
    - this.classFeatures  (class feature definitions, keyed by className)
    - this.subclassFeatures (subclass feature definitions)
11. Load charcreationoptions.json → this.charCreationOptions
12. Load conditionsdiseases.json  → this.conditionsDiseases
13. Load generated/gendata-spell-source-lookup.json → this.spellSourceLookup
14. mapRelationships()    → builds lookup maps (see below)
15. this.isLoaded = true  → idempotent guard
```

### Relationship Maps (built in `mapRelationships()`)

These 4 maps power the **"where did this come from?"** queries:

| Map | Key | Value | Purpose |
|-----|-----|-------|---------|
| `featOrigins` | feat name (string) | `{ type: 'race'|'background', name, source }` | Find which race/background grants a feat |
| `subraceParents` | `"subraceName\|raceName\|raceSource"` | `{ raceName, raceSource }` | Map subrace → parent race |
| `classFeatureParents` | `"featureName\|className\|classSource"` | `{ className, classSource, level }` | Map feature → class owner |
| `subclassFeatureParents` | `"featureName\|className\|subclassShortName"` | `{ className, subclassShortName, source, level }` | Map feature → subclass owner |

### Key Data Access Methods

```javascript
getRace(name, source = "PHB")              // Exact match by name+source
getSubrace(name, source)                    // Falls back to name-only match
getBackground(name, source)
getClass(name, source)
getSubclass(className, subclassName, source)
getFeat(name, source)
getCharCreationOption(name, source)
getItem(name, source)                       // Also getItemByName(name)
getSpell(name, source)
getSkill(name)
getClassFeaturesUpToLevel(className, source, maxLevel)  // Returns features sorted by level
getSubclassFeaturesUpToLevel(className, source, subclassName, subclassSource, maxLevel)
getOptionalFeatures(type)                   // Filter by type (FS, EI, MN, AS, AF, SM, etc.)
search(collection, query)                   // Case-insensitive name match on any collection
```

### Searching Data

Various `.search()` helper methods: `searchRaces(q)`, `searchClasses(q)`, `searchFeats(q)`, `searchSpells(q)`, etc. They check if the query string is a substring of the item's name, or appears in its entries/flavor text.

---

## 7. Models — The Core Data Classes

### 7.1 TracedModifier.js — The Tracing System

This is the **foundation of the entire project**. Every value on a character sheet traces back to its source through this system.

#### `SOURCE_CATEGORIES` (enum)

```javascript
{
  RACE, SUBRACE, BACKGROUND, CLASS, SUBCLASS, FEAT,
  MAGIC_ITEM, ASI, CHAR_CREATION_OPTION, VARIANT_RULE, SPECIAL
}
```

Every modifier on a character must declare which category it belongs to.

#### `STACKING_MODES` (enum)

```javascript
{
  REPLACE: "replace",   // Override the base value entirely
  STACK: "stack",       // Add to the running total
  MAX: "max",           // Cap the total at this value
  MIN: "min"            // Floor the total at this value
}
```

#### `SourceReference` — "Where did this come from?"

```javascript
{
  category: "race",           // One of SOURCE_CATEGORIES
  sourceName: "Goliath",      // Human-readable name
  sourceId: "Goliath|XPHB",   // Unique machine-readable ID
  level: 1,                   // Character level when acquired
  description: null            // Optional description
}
```

**Factory methods** make these clean to create:

```javascript
SourceReference.race("Goliath", "XPHB")
// → { category: "race", sourceName: "Goliath", sourceId: "Goliath|XPHB", level: null, description: null }

SourceReference.classFeature("Fighting Style", "Fighter", "PHB", 1)
SourceReference.feat("Alert", "PHB")
```

#### `TracedModifier` — A single modifier value

```javascript
{
  value: 2,                               // Numeric modifier
  stacking: "stack",                      // How it stacks with others
  conditions: [],                         // E.g., ["while not wearing heavy armor"]
  sources: [SourceReference]              // One or more origins
}
```

**Methods:**
- `addSource(ref)` — Add another source
- `addCondition(cond)` — Add a conditional qualifier
- `getPrimarySource()` — Returns the first source (primary origin)
- `combine(otherModifier)` — Combines two modifiers respecting stacking rules

#### `TracedValue` — A computed value with full audit trail

```javascript
{
  baseValue: 10,              // Starting value
  modifiers: [TracedModifier] // All modifiers ever applied
}
```

**`calculate()` method** — The core algorithm:

```
1. Sum all REPLACE modifiers → replaceTotal
2. Sum all STACK modifiers → stackTotal
3. Find largest MAX modifier (if any)
4. Find smallest MIN modifier (if any)
5. total = baseValue + replaceTotal + stackTotal
6. If MAX exists, total = Math.min(total, maxValue)
7. If MIN exists, total = Math.max(total, minValue)
8. Return total
```

**`getModifierBreakdown()`** — Returns a human-readable array:

```javascript
[
  { source: "Base", value: 10, type: "base" },
  { source: "Goliath (XPHB)", value: 2, type: "racial", modifiers: [...] },
  { source: "Fighting Style (Fighter PHB)", value: 1, type: "class", modifiers: [...] }
]
```

This is what powers the source-tracing API endpoint.

#### `TracedResource` — A rechargeable resource

```javascript
{
  name: "Rage",
  maxUses: TracedValue,       // Max uses (can be modified by features)
  currentUses: number,        // Remaining uses
  rechargeType: "longRest",   // "longRest" | "shortRest" | "dawn"
  sources: [SourceReference]
}
```

Used for Barbarian Rage, Channel Divinity, Bardic Inspiration, etc.

---

### 7.2 Character.js — The Main Character Model

947 lines, 8 classes. This is the **central data structure** of the entire project.

#### `Character` (main class)

```javascript
{
  id: "uuid-v4",                    // Auto-generated
  player: "user-id",                // Owner's user ID
  name: "Brogdar Stonehand",
  alignment: "Lawful Neutral",
  experience: 0,
  
  // Origin
  race: SourceReference | null,
  subrace: SourceReference | null,
  backgrounds: [SourceReference],
  charCreationOptions: [SourceReference],
  
  // Progression
  classes: [ClassLevel],            // Supports multiclassing
  feats: [TracedFeature],
  
  // Core stats
  abilityScores: AbilityScoreSet,   // Traced values for STR/DEX/CON/INT/WIS/CHA
  proficiencies: ProficiencySet,    // Saves, skills, armor, weapons, tools, languages
  equipment: [Equipment],
  currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  
  // Combat
  maxHitPoints: number,
  currentHitPoints: number,
  tempHitPoints: number,
  hitDice: { "d12": 1, ... },      // One entry per die type
  usedHitDice: { "d12": 0, ... },
  armorClass: TracedValue,          // Default 10 + modifiers
  initiative: TracedValue,          // Default DEX mod + modifiers
  speed: TracedValue,               // Default 30 + modifiers
  proficiencyBonus: TracedValue,    // Default 2, scales with level
  
  // Senses
  passivePerception: number,        // Default 10 + Perception skill modifier
  
  // Features
  features: [TracedFeature],
  
  // Spellcasting
  spellbooks: { className: Spellbook },
  resources: { resourceName: TracedResource },
  
  // Roleplay
  inspiration: false,
  traits: { personalityTrait, ideal, bond, flaw },
  conditions: [],
  exhaustion: 0,
  
  // In-progress selections
  pendingFeatureSelections: [],
  
  // Death saves
  deathSaveSuccess1: false, ...deathSaveFail3: false,
  
  // Free-form
  otherProficiencies: []
}
```

**Key methods:**

| Method | What It Does |
|--------|-------------|
| `getTotalLevel()` | Sums all class levels |
| `getClassLevel(className)` | Gets level for a specific class |
| `getPrimaryClass()` | Returns the ClassLevel with highest level |
| `addClass(ClassLevel)` | Adds a new class or increments level |
| `addFeature(TracedFeature)` | Adds a feature and triggers stats recalculation |
| `addPendingSelection(TracedFeature)` | Adds to pending selections queue |
| `completeFeatureSelection(name, option)` | Resolves a pending selection |
| `getPendingSelections()` | Returns array of features awaiting choice |
| `hasPendingSelections()` | Boolean check |
| `getAllFeatures()` | Returns all features (class + race + background + feats) |
| `calculateArmorClass()` | Recalculates AC from base + DEX + modifiers |
| `calculateInitiative()` | Recalculates initiative from DEX + modifiers |
| `calculateSpeed()` | Recalculates speed from base + modifiers |
| `calculateProficiencyBonus()` | Calculates PB from total level (2 at 1-4, 3 at 5-8, etc.) |
| `recalculateDerivedStats()` | Runs ALL stat recalculations |
| `longRest()` | Restores HP, spell slots, long-rest resources, hit dice recovery |
| `shortRest()` | Restores short-rest resources, allows hit dice spending |
| `save()` | Writes `this.toJSON()` to `data/generated/characters/{id}.json` |
| `load(id)` | Static. Reads + deserializes a character file |
| `loadAllForPlayer(playerId)` | Static. Returns all characters for a user |
| `delete(id)` | Static. Deletes the character file |
| `toJSON()` / `fromJSON(json)` | Full serialization/deserialization |

#### `ClassLevel`

```javascript
{
  className: "Fighter",
  classSource: "PHB",
  level: 3,
  subclassName: "Battle Master",
  subclassSource: "PHB",
  features: [TracedFeature],
  source: SourceReference.class("Fighter", "PHB")
}
```

#### `TracedFeature`

```javascript
{
  name: "Second Wind",
  description: "You have a limited well of stamina...",
  source: SourceReference.classFeature("Second Wind", "Fighter", "PHB", 1),
  active: true,
  selectable: false,           // Does this feature require a choice?
  availableOptions: null,      // If selectable, what are the choices?
  selectedOption: null,        // What did the user pick?
  effects: [],                 // Mechanical effects
  prerequisites: [],           // Prerequisites
  category: "REAL_FEATURE"    // One of FEATURE_CATEGORIES
}
```

#### `AbilityScoreSet`

```javascript
{
  scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
  tracedScores: {
    strength: TracedValue(10),
    dexterity: TracedValue(10),
    ...
  }
}
```

Key method: `getModifier(abilityName)` — Returns the ability modifier (-5 to +10). Formula: `Math.floor((score - 10) / 2)`.

#### `ProficiencySet`

Tracks 5 categories of proficiencies, each with source tracking:

```javascript
{
  savingThrows: { strength: false, dexterity: false, ... },
  skills: { "athletics": { proficient: false, expertise: false }, ... },
  armor: [{ name: "Chain Mail", source: SourceReference }, ...],
  weapons: [...],
  tools: [...],
  languages: [...],
  // Source tracking arrays:
  skillSources: { "athletics": [SourceReference], ... },
  armorSources: [...],
  weaponSources: [...],
  toolSources: [...],
  languageSources: [...]
}
```

Key methods: `addSkillProficiency(skill, source, expertise?)`, `getSkillModifier(skill)` (combines ability mod + prof bonus + expertise), `getSkillSources(skill)` (returns all sources for a proficiency).

#### `SpellSlots`

```javascript
{
  slots: { 1: { max: 2, used: 0 }, 2: { max: 0, used: 0 }, ... 9: { max: 0, used: 0 } },
  sources: { 1: [SourceReference], ... }
}
```

Methods: `setMax(level, max, source)`, `getAvailable(level)`, `use(level)`, `longRest()`.

#### `Spellbook`

Per-class spell tracking:

```javascript
{
  known: ["fireball", "shield"],
  prepared: ["shield"],
  slots: SpellSlots,
  cantripsKnown: ["fire bolt", "mage hand"],
  spellcastingAbility: "intelligence",    // Or "charisma", "wisdom"
  spellSaveDC: 13,
  spellAttackBonus: 5
}
```

#### `Equipment`

```javascript
{
  item: { name: "Chain Mail", type: "HA", ac: 16, ... },
  quantity: 1,
  source: SourceReference,
  attuned: false,
  equipped: true,   // Is it on their body?
  wielded: false     // Is it in their hands? (for weapons)
}
```

---

### 7.3 CharacterBuilder.js — The Builder Pattern

760 lines. This is the **character construction engine**. It takes raw form data and applies D&D 5e rules step by step to produce a fully-traced `Character`.

#### `build(options)` — Main Entry Point

```javascript
const builder = new CharacterBuilder(loader);
const character = builder.build({
  name: "Brogdar",
  player: "user-uuid",
  race: "Goliath",
  raceSource: "XPHB",
  subrace: null,
  backgrounds: [{ name: "Soldier", source: "PHB" }],
  classes: [{ name: "Fighter", source: "PHB", level: 3, subclass: "Battle Master" }],
  feats: [{ name: "Alert", source: "PHB" }],
  charCreationOptions: [],
  abilityScores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 8 },
  alignment: "Lawful Neutral",
  startingEquipment: ["chain mail", "shield"],
  equipmentChoices: [/* user's equipment picks */],
  selectedCantrips: [],
  selectedSpells: [],
  asiSelections: []
});
```

#### Build Pipeline (executed in this exact order)

| Step | Method | What Happens |
|------|--------|-------------|
| 1 | (constructor) | Creates empty `Character`, sets `this.character = new Character()` |
| 2 | `applyRace()` | Sets race `SourceReference`. Extracts: speed base (default 30, but races like dwarf have 25), ability bonuses (applied as TracedModifiers with source=RACE), size, traits, features. Darkvision, Keen Senses, etc. become TracedFeatures. If race has entries (features), they're parsed and categorized. |
| 3 | `applySubrace()` | Same as race but for subrace. Ability bonuses stack on top of race. Subrace features add to the feature list. |
| 4 | `applyBackgrounds()` | For each background: adds skill proficiencies (2 from background list, plus any choices), tool proficiencies, languages, features from entries, and starting gold if specified. |
| 5 | `applyClasses()` | **THE MOST COMPLEX STEP.** For each class: (a) fetches all class features up to given level via `loader.getClassFeaturesUpToLevel()`, (b) creates HP: level 1 = max hit die + CON mod, subsequent levels = average (die/2 + 1) + CON mod, (c) adds saving throw proficiencies, (d) processes each feature — categorizes it, checks selectability, adds to feature list or pending selections, (e) handles ASI selections (replaces ASI feature with user's ability score choices), (f) adds subclass features via `getSubclassFeaturesUpToLevel()`. |
| 6 | `applyFeats()` | For each feat: adds ability score bonuses as TracedModifiers with source=FEAT, features from feat data. |
| 7 | `applyCharCreationOptions()` | Similar to feats but for special origins (Dark Gifts from Van Richten's, Supernatural Gifts from Theros, etc.) |
| 8 | `applyAbilityScores()` | Sets the base ability scores from the form inputs. Each score becomes a TracedValue with the base set. |
| 9 | `applyStartingEquipment()` | From the class's `startingEquipment.defaultData` and `startingEquipment.additionalData`, plus background's gold. Resolves item IDs to names via `loader.getItemByName()`. |
| 10 | `applyEquipmentChoices()` | Applies user's custom equipment choices on top of defaults. |
| 11 | `applySpellSelections()` | For each class with spellcasting: creates a Spellbook, adds cantrips and spells, configures spell slots based on multiclass caster level (using hardcoded slot progression tables: FULL, HALF, THIRD, ART). |
| 12 | `calculateDerivedStats()` | Final pass: recalculates proficiency bonus, initiative, passive perception, spell save DC (8 + PB + ability mod), spell attack bonus (PB + ability mod). |

### Spell Slot Tables

The builder has **hardcoded D&D 5e multiclass slot progression** matching the official rules:

```
FULL: cleric, druid, sorcerer, wizard
HALF: paladin, ranger (level/2, rounded up in 5e2024)
THIRD: eldritch knight, arcane trickster (level/3)
ART: artificer (level/2, rounded up)
```

The `getMulticlassCasterLevel()` method aggregates levels across all caster classes using these categories, then looks up the slot table:

```javascript
const MULTICLASS_SPELL_SLOTS = {
  1:  { 1: 2 },
  2:  { 1: 3 },
  3:  { 1: 4, 2: 2 },
  ...up to level 20
};
```

---

### 7.4 SpellListResolver.js — Spell Context

539 lines. Determines **which spells a character can select** during creation.

#### `getSpellSelectionContext(className, classSource, level, subclassName?)`

Returns:

```javascript
{
  cantrips: {
    maxKnown: 2,                        // How many can they know at this level?
    allowed: ["fire bolt", "ray of frost", ...],  // From class spell list
    count: 2                            // How many to show
  },
  spells: {
    maxKnown: 3,                        // For known casters (bard, sorcerer, warlock)
    maxPrepared: 4,                     // For prepared casters (cleric, druid, wizard)
    allowed: ["bless", "cure wounds", ...],
    subclassSpells: {                   // Auto-known subclass spells
      alwaysPrepared: ["bless", "shield of faith"],
      count: 2
    },
    maxSpellLevel: 1                    // Highest level they can cast
  },
  isKnownCaster: false,                 // True for bard, sorcerer, warlock, ranger
  isPreparedCaster: true                // True for cleric, druid, paladin, wizard
}
```

**How it determines spell lists:**
1. Loads the class data from the loader
2. Parses the class's `spellList` reference
3. Resolves subclass-specific spells (domain spells for clerics, oath spells for paladins, etc.)
4. Calculates max spell level from caster level
5. For known casters: calculates `SpellsKnown` from progression table
6. For prepared casters: calculates `maxPrepared` (class level + casting ability mod)

**Key internal methods:**
- `getCantripCount(className, classSource, level)` — Looks up cantrip progression
- `getSpellsKnown(className, classSource, level)` — For known casters
- `getMaxPrepared(className, classSource, level, abilityMod)` — For prepared casters
- `getMaxSpellLevel(casterLevel)` — Highest spell level available
- `getSubclassSpells(className, classSource, subclassName)` — Extra subclass spells
- `parseClassSpellList(classData)` — Resolves the spell list reference to actual spell names

---

### 7.5 User.js — Simple File-Based Auth

44 lines. The simplest model in the project.

```javascript
{
  id: "uuid-v4",
  username: "player1",
  password: "$2b$10$..."  // bcrypt hash
}
```

**Static methods:**
- `findByUsername(username)` — Reads `users.json`, finds by username match
- `findById(id)` — Reads `users.json`, finds by id
- `save(user)` — Reads `users.json`, appends user, writes back
- `getUsers()` — Reads and parses `users.json`

---

## 8. Utilities

### 8.1 featureCategory.js

189 lines. Categorizes a feature based on its name and description. This is important because different feature types are displayed differently (e.g., ASIs happen at class level 4/8/12/16/19, fighting styles are separate UI, languages show up in the languages section, etc.).

**`FEATURE_CATEGORIES`** enum values:

| Category | Meaning | Example |
|----------|---------|---------|
| `REAL_FEATURE` | An actual game feature | "Second Wind", "Cunning Action" |
| `LANGUAGE` | A language proficiency | "Languages: Common, Giant" |
| `ASI` | Ability Score Improvement | "Ability Score Improvement (Level 4)" |
| `SPELLCASTING` | Spellcasting feature | "Spellcasting", "Pact Magic" |
| `FIGHTING_STYLE` | Fighting Style choice | "Fighting Style (Fighter)" |
| `INSTRUCTION` | A "you should do X" note | "Your GM can give you..." |
| `SUGGESTED` | Personality suggestions | "Suggested characteristics" |
| `PROFICIENCY` | Armor/weapon/tool proficiency | "Armor Training" |

**`categorizeFeature(name, description, source, featureData)`** algorithm:
1. Check `name` against LANGUAGE patterns (regex list)
2. Check against ASI patterns
3. Check against SPELLCASTING patterns (Spellcasting/Pact Magic in name)
4. Check against FIGHTING_STYLE patterns
5. Check against SUGGESTED patterns (personality traits, ideals, etc.)
6. Check against PROFICIENCY patterns (Armor Training, etc.)
7. Check against DESCRIPTIVE patterns (age, size, speed, alignment)
8. Check feature type keywords (from `featureData.type`: `EI` = Eldritch Invocation, `AI` = Artificer Infusion, `SM` = Metamagic, etc.)
9. Check INSTRUCTION patterns (future improvement suggestions)
10. **Fallback**: return `REAL_FEATURE`

**Helper exports:** `isRealFeature(category)` returns true for REAL_FEATURE and PROFICIENCY; `getCategoryLabel(category)` returns a human-readable label.

---

### 8.2 featureSelectability.js

141 lines. Determines whether a feature's description implies the user must **make a choice**.

**`isFeatureSelectable(name, description)`** — Returns `true` if the description contains:

1. **Explicit choice phrases** (12 regex patterns):
   - "you must choose"
   - "choose one of the following"
   - "select one"
   - "pick one"
   - "you may choose"
   - "choose one feat" / "choose one skill"
   - "gain proficiency in one skill of your choice"
   - "choose, choose, or choose" (list pattern)
   - "choose two" / "select two"
   - "you gain one" + "of your choice"
   - "one skill of your choice"
   - "choose a type" / "choose a kind"

2. **Sub-option patterns**: `{@filter ...}` directives, "choose one of the following" + list

3. **Combined heuristics**: choice indicators + option list markers in the same description

**`extractAvailableOptions(description, featureName)`** — Parses the description to find what the choices are:
- `{@filter feature type=FS}` → finds fighting styles
- `{@filter feature type=EI}` → finds eldritch invocations
- `{@item ...}` → finds equipment choices
- Bullet lists after "type: list" → parses into string array

**`needsSubOptionSelection(description)`** — Returns true if there's a bullet list + choice phrase, or a filter reference (like `{@filter}`).

---

## 9. Views — The EJS Templates

### `partials/header.ejs`

Standard HTML5 boilerplate. Links to `/styles/styles.css`. Used by every page.

### `partials/footer.ejs`

Closes body and html. Loads `/js/main.js` with `defer`.

### `index.ejs` (9 lines)

Landing page. `<h1>To the next adventure</h1>` with links to `/login` and `/signup`.

### `login.ejs` (19 lines)

Form POSTing to `/login`. Uses flash messages (`req.flash("error")` shows in red, `req.flash("success")` in green via inline styles). Link to signup at bottom.

### `signup.ejs` (16 lines)

Same pattern as login but POSTs to `/signup`. Flash error support.

### `hall.ejs` (24 lines)

After login. Shows greeting + logout link. "Create a Character" link. Iterates over `characters` array showing name, level, class with links to `/character/:id`. "No characters yet" message if empty.

### `characterCreator.ejs` (553 lines)

**The big creation form.** Has 3 sections:

**Static HTML form fields:**
- Character name (text input)
- Race dropdown (populated from `races` data passed from controller)
- Subrace dropdown (hidden initially, shown via JS when race with subrace is selected)
- Class dropdown
- Level (number input, 1-20)
- Subclass dropdown (hidden, shown on class selection)
- 6 ability score inputs (default 10)
- Background dropdown
- Alignment dropdown (LG, NG, CG, LN, N, CN, LE, NE, CE)
- Feats multi-select (Ctrl/Cmd+click)

**Dynamic sections (loaded via inline JS `fetch()`):**
- **Starting equipment:** When class changes, fetches `/api/equipment/class/{className}`, displays equipment options as checkboxes
- **Spell selection:** When class and/or level changes, fetches `/api/spells/context/{className}/{level}`. Shows:
  - Cantrip checkboxes (limited to `maxKnown`)
  - Spell level filter buttons
  - Spell checkboxes per level
  - Shows subclass spells as pre-checked/readonly

**Submit behavior:**
- Collects all form data into a JSON object
- `fetch("POST /createCharacter", { body: JSON.stringify(data) })`
- On success: shows a preview then `window.location.href = /character/{id}`
- On error: shows alert with error message

**Important JS variables embedded in the template:**
```javascript
const races = <%- racesJson %>;        // All race data
const subraces = <%- subracesJson %>;  // All subrace data
const classes = <%- classesJson %>;    // All class data
const subclasses = <%- subclassesJson %>;  // All subclass data
const backgrounds = <%- backgroundsJson %>;  // All background data
const feats = <%- featsJson %>;        // All feat data
```

These are JSON-stringified and passed via `JSON.parse()` safe embedding. The controller uses `JSON.stringify().replace(/</g, '\\u003c')` to prevent XSS.

### `character.ejs` (1066 lines)

**The digital character sheet.** Two-page visual spread.

**PAGE 1 — Core Stats Layout:**

- **Header row:** Character name, class/level, background, player name, race, alignment, XP
- **Left column (stats):** 
  - Ability scores (6 boxes showing score + modifier, clickable for source tracing)
  - Inspiration toggle (clickable bubble, AJAX toggle)
  - Proficiency bonus
  - Saving throws (clickable to toggle proficiency)
  - Skills (18 skills with ability mod + proficiency + expertise, clickable to toggle)
  - Passive perception
  - Other proficiencies (armor, weapons, tools, languages)
- **Center column (combat):**
  - Armor Class (with breakdown on click)
  - Initiative
  - Speed
  - Hit Points (max, current, temp — all editable inline)
  - Hit Dice (shows total and used, clickable to spend)
  - Death saves (3 success/3 fail bubbles, clickable)
  - Attacks & Spellcasting (from equipment: weapon name, attack bonus, damage)
  - Equipment list (with currency)
  - Features & Traits (list of real features)
- **Right column (roleplay):**
  - Personality Traits (editable)
  - Ideals (editable)
  - Bonds (editable)
  - Flaws (editable)
  - Features & Traits (continued list)

**PAGE 2 — Spellcasting (only renders if `spellData` exists):**

- Spellcasting ability, spell save DC, spell attack bonus
- Cantrips (known list)
- For each spell level 1-9:
  - Slot tracking (max slots / used slots, clickable to increment)
  - Spell list for that level

**Inline editing system:**
- "Edit" button toggles all editable fields between view mode and edit mode
- In edit mode: fields become inputs, "Save" and "Cancel" buttons appear
- Save: `fetch("PUT /character/:id", { body: JSON.stringify(data) })` — only sends changed fields
- Cancel: reloads the page to reset
- Individual clicks: inspiration, saving throws, skills, death saves toggle via AJAX PUT

---

## 10. Public Assets

### `public/styles/styles.css` — EMPTY

No CSS. The character sheet renders with whatever the browser defaults provide. This is the #1 visual issue.

### `public/js/main.js` — EMPTY

All client-side JavaScript is inline in the EJS templates (`characterCreator.ejs` and `character.ejs` both have substantial inline `<script>` blocks). No shared JS utilities exist.

---

## 11. Test Files

### `test-loader.js` (59 lines)

Tests that the DataLoader can:
1. Find feat origins (Aberrant Dragonmark, Magic Initiate, Alert)
2. Find subclass feature parents (Combat Superiority → Battle Master, Improved Critical → Champion)
3. Map subraces to parent races
4. Search spells for "Fireball"
5. Print data statistics (number of races, classes, spells, etc.)

**Run:** `node test-loader.js`

### `test-feature-select.js` (130 lines)

Tests two things:

**Part 1: Feature Selectability (8 test cases)**
- "Giant Ancestry" → selectable (has choice options)
- "Stone's Endurance" → not selectable
- "Fighting Style" → selectable
- "Second Wind" → not selectable
- "Darkvision" → not selectable
- "Skill Versatility" → selectable
- "Expertise" → not selectable (note: the test expects `false` but the description has "Choose two" — this may be a known discrepancy)
- "Maneuvers" → selectable

**Part 2: Full Character Build Integration Test**
- Builds a Goliath Fighter (level 3, Battle Master)
- Inspects all features on the resulting character
- Prints pending selections and selectable features

**Run:** `node test-feature-select.js`

---

## 12. Full API Reference

### Page Routes

```
GET  /                              → Renders index.ejs
GET  /login                         → Renders login.ejs
GET  /signup                        → Renders signup.ejs
GET  /hall                          → Renders hall.ejs (requires session)
GET  /createCharacter               → Renders characterCreator.ejs
POST /createCharacter               → Creates character, returns 201 JSON
GET  /character/:id                 → Renders character.ejs
GET  /character/:id/pdf             → Downloads PDF (requires Puppeteer)
PUT  /character/:id                 → Updates character fields, returns JSON
DELETE /character/:id               → Deletes character, redirects to /hall
```

### Auth Routes

```
POST /signup       Body: { username, password }     → Redirects to /hall
POST /login        Body: { username, password }     → Redirects to /hall
POST /logout                                          → Redirects to /
```

### API Routes

```
GET /api/:collection?q=term
  → Returns filtered array from collection (races, classes, feats, etc.)

GET /api/relationships/feat-origin/:name
  → { type: "race"|"background", name: string, source: string }

GET /api/relationships/subclass-feature-parent?feature=Combat+Superiority
  → { className: "Fighter", subclassShortName: "Battle Master", source: "PHB", level: 3 }

GET /api/relationships/subrace-parent?subrace=Hill+Dwarf&race=Dwarf&source=PHB
  → { raceName: "Dwarf", raceSource: "PHB" }

GET /api/spells/context/:className/:level
  → { cantrips: { maxKnown, allowed, count }, spells: { maxKnown, maxPrepared, ... } }

GET /api/equipment/class/:className
  → [ { name, quantity, type, ... } ]  // Starting equipment options

GET /api/character/:id/sources/:attribute
  → { total: number, breakdown: [{ source, value, type, modifiers }] }
  Supported attributes:
    abilityScores, ac, initiative, speed, proficiency,
    features, skills, savingThrows
```

---

## 13. Data Flow Walkthroughs

### Walkthrough 1: User Creates a Character

```
Browser                          Server
   │                               │
   ├── GET /createCharacter ──────►│
   │                               ├── loader.loadAll() (idempotent)
   │                               ├── Fetch all races, classes, etc.
   │                               ├── JSON-stringify for EJS safety
   │                               └── Render characterCreator.ejs ◄──┐
   │◄──── HTML form ───────────────┘                                  │
   │                                                                  │
   ├── User fills form                                                │
   ├── JS fetches /api/equipment/class/Fighter ──────►│               │
   │◄──── Equipment options ──────────┘                               │
   ├── JS fetches /api/spells/context/Fighter/3 ──────►│             │
   │◄──── Spell context data ────────┘                               │
   │                                                                  │
   ├── POST /createCharacter ──────►│                                 │
   │   { name, race, class, ... }   │                                 │
   │                               ├── new CharacterBuilder(loader)   │
   │                               ├── builder.build(data)            │
   │                               │   ├── applyRace()                │
   │                               │   ├── applySubrace()             │
   │                               │   ├── applyBackgrounds()         │
   │                               │   ├── applyClasses()             │
   │                               │   ├── applyFeats()               │
   │                               │   ├── applyAbilityScores()       │
   │                               │   ├── applyStartingEquipment()   │
   │                               │   ├── applySpellSelections()     │
   │                               │   └── calculateDerivedStats()    │
   │                               ├── character.save()               │
   │                               │   └── Write to data/generated/   │
   │                               └── HTTP 201 { character JSON } ◄─┤
   │◄──── 201 Created ──────────────┘                                 │
   ├── JS: redirect to /character/:id                                 │
   │                                                                  │
   ├── GET /character/:id ─────────►│                                │
   │                               ├── Character.load(id)             │
   │                               ├── buildCharacterViewHelpers()    │
   │                               └── Render character.ejs ◄─────────┤
   │◄──── Character sheet HTML ────┘                                 │
```

### Walkthrough 2: Source Tracing

```
Browser                                  Server
   │                                       │
   ├── GET /api/character/abc123/sources/abilityScores.strength ──►│
   │                                       │
   │                                       ├── Character.load("abc123")
   │                                       ├── Walk to character.abilityScores
   │                                       ├── .tracedScores.strength
   │                                       ├── .getModifierBreakdown()
   │                                       │
   │                                       └── JSON response:
   │                                           {
   │                                             "total": 15,
   │                                             "breakdown": [
   │                                               { "source": "Base", "value": 15 },
   │                                               { "source": "Goliath (XPHB)", "value": 2,
   │                                                 "type": "racial",
   │                                                 "modifiers": [{ "value": 2, "category": "race" }]
   │                                               }
   │                                             ]
   │                                           }
   │◄──── Source breakdown JSON ──────────┘
```

### Walkthrough 3: Feature Selectability During Build

```
CharacterBuilder.build()
  │
  ├── applyClasses()
  │   ├── getClassFeaturesUpToLevel("Fighter", "PHB", 3)
  │   │   → [Second Wind, Fighting Style, Action Surge, ...]
  │   │
  │   ├── For each feature:
  │   │   │
  │   │   ├── "Second Wind"
  │   │   │   ├── categorizeFeature() → REAL_FEATURE
  │   │   │   ├── isFeatureSelectable() → false (no choice)
  │   │   │   └── character.addFeature(secondWind)
  │   │   │
  │   │   ├── "Fighting Style"
  │   │   │   ├── categorizeFeature() → FIGHTING_STYLE
  │   │   │   ├── isFeatureSelectable() → true (must choose)
  │   │   │   ├── extractAvailableOptions() → ["Defense", "Dueling", ...]
  │   │   │   └── character.addPendingSelection(fightingStyleFeature)
  │   │   │
  │   │   └── "Ability Score Improvement" (level 4)
  │   │       ├── categorizeFeature() → ASI
  │   │       ├── isFeatureSelectable() → true (must choose)
  │   │       └── character.addPendingSelection(asiFeature)
  │   │
  │   └── Features with pending selections are NOT added to features[] yet.
  │       They sit in pendingFeatureSelections[] awaiting user input.
```

---

## 14. Current State & Known Gaps

### What Works Well ✅

- **User authentication** — Signup/login/logout with bcrypt + SQLite sessions
- **Character creation** — Full form with race/class/background/feats/scores/equipment/spells
- **Character builder engine** — 12-step build pipeline applying D&D 5e rules
- **Source tracing** — Every attribute knows where it came from
- **Character sheet display** — Full 2-page digital sheet with inline editing
- **Data loading** — All 5etools data loaded and relationship-mapped
- **PDF export** — Via Puppeteer headless Chromium
- **Spell selection context** — Knows which spells are available per class/level
- **Feature categorization** — ASIs, fighting styles, languages, etc. handled correctly
- **Multiclass support** — Character model supports multiple classes; builder aggregates features from all classes
- **File persistence** — Characters and users saved to JSON files

### What's Missing or Needs Work ❌

| Area | Priority | Details |
|------|----------|---------|
| **CSS Styling** | HIGH | `styles.css` is empty. Character sheet renders with browser defaults. This is the most visible gap — the app works but looks terrible. |
| **Client-side JS** | HIGH | `main.js` is empty. All JS is inline in EJS. No shared utilities, no framework, no bundler. The inline JS in `character.ejs` is ~400 lines of unorganized code. |
| **Feature selection resolution** | MEDIUM | `pendingFeatureSelections` are tracked but there's no UI on the character sheet to resolve them. The builder detects selectable features but the user can't make those choices after character creation. |
| **Level up system** | MEDIUM | No way to level up a character. The builder creates at a fixed level. Leveling would need to add new class features, ASI choices, HP increases, etc. |
| **Rest system (UI)** | MEDIUM | Character model has `longRest()` and `shortRest()` but there's no button/UI on the sheet to trigger them. |
| **Dice roller** | LOW | No dice rolling at all. |
| **Input validation** | MEDIUM | No validation on character creation inputs (e.g., max level 20, valid ability scores, etc.) |
| **Error handling** | MEDIUM | Controllers have basic try-catch but error responses could be more informative. |
| **Tests** | LOW | Only 2 manual test scripts. No test framework. |
| **User settings** | LOW | No way to change password, delete account, etc. |
| **Character list** | MEDIUM | Hall page works but could show more info (level, race, last played). |
| **Equipment UI** | LOW | Equipment shows on sheet but no add/remove/manage interface. |
| **Spell preparation UI** | LOW | Prepared spells shown but no way to change prepared list after creation. |
| **Character deletion confirmation** | LOW | DELETE is immediate with no confirmation dialog. |
| **Session secret** | LOW | `"Nah imma stay"` is hardcoded in `server.js`. Should be in `.env`. |

---

## 15. Common Pitfalls for New Developers

### ES Module Imports

All files use ES Modules (`import`/`export`). **Always include the `.js` extension** in relative imports:

```javascript
// ✅ CORRECT
import loader from "./data/loader.js";
import { Character } from "../models/Character.js";

// ❌ WRONG — will fail
import loader from "./data/loader";
import { Character } from "../models/Character";
```

### The Loader Is a Singleton

```javascript
import loader from "./data/loader.js";
```

This is the SAME instance everywhere. You don't need to call `loadAll()` again — it was called at server startup. If you're writing a test or script, you must call `await loader.loadAll()` first.

### `toJSON()` and `fromJSON()` Are Required

Every model class has these. When you add a new field to a class, you MUST update both methods:

- `toJSON()` — Controls what gets saved to the JSON file
- `fromJSON(json)` — Controls how it's reconstructed from JSON
- `Character.load()` calls `Character.fromJSON()`, which recursively calls `fromJSON()` on all sub-objects

If you add a field to a class but forget `toJSON()`/`fromJSON()`, the field will disappear on save/load.

### SourceReference Factory Methods

Always use the factory methods to create `SourceReference` objects:

```javascript
// ✅ CORRECT
SourceReference.race("Goliath", "XPHB");
SourceReference.classFeature("Second Wind", "Fighter", "PHB", 1);

// ❌ WRONG — don't construct directly unless you have to
new SourceReference({ category: "race", sourceName: "Goliath", ... });
```

### Modify, Don't Replace — TracedValue Pattern

When modifying a `TracedValue`, add a `TracedModifier` instead of setting the value directly:

```javascript
// ✅ CORRECT — preserves source tracking
strength.add(new TracedModifier(2, STACKING_MODES.STACK)
  .addSource(SourceReference.race("Goliath", "XPHB")));

// ❌ WRONG — loses traceability
strength.baseValue = 17;
```

### The `.search()` Pattern on Loader

The `loader.search(collection, query)` method uses substring matching on names and entries. For exact lookups, use `loader.getRace(name)` etc. directly.

### Adding a New Source Book

1. Place the JSON file in the appropriate `data/` directory
2. If it's spells: add to `data/spells/`
3. If it's a class: add to `data/class/class-{name}.json`
4. The loader reads all files in these directories dynamically
5. No code changes needed unless the data format differs from 5etools convention

### Express 5 Quirks

- Express 5 route params are slightly different. `:id` matches everything up to the next `/`.
- Async route handlers need explicit error catching (Express 5 does NOT catch async errors automatically in all cases — wrap with try-catch).
- `method-override` is set up for `PUT` and `DELETE` via `?_method=` query param.

### The `characterCreator.ejs` Script Tag Data

The form embeds all D&D data as JSON in `<script>` tags using `JSON.stringify()` with `</script>` escaping. If you add a new data source to the form, remember to:

1. Pass the data from the controller
2. JSON-stringify with XSS protection: `JSON.stringify(data).replace(/</g, '\\u003c')`
3. Parse on the client: `const data = JSON.parse(document.getElementById('data').textContent)`

### PDF Generation Requires Chromium

The `/character/:id/pdf` route uses `puppeteer-core`, which requires a Chromium/Chrome binary on the system. It does NOT bundle its own Chromium. If PDF generation fails, it's likely because there's no browser installed at the path `puppeteer-core` expects.

---

*This document should be kept up to date as the codebase evolves. If you change a model, add a route, or refactor a controller, update the relevant section here so the next developer doesn't get lost.*
