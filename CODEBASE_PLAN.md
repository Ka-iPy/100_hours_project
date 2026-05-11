# Comprehensive Codebase Plan

## 1. Project Overview

**Project Name:** 100 Hours Project  
**Purpose:** D&D 5e Character Creator with Traceable Attribute System  
**Tech Stack:** Node.js, Express.js, EJS, JSON file-based storage  
**Module System:** ES Modules (type: "module" in package.json)

---

## 2. Directory Structure

```
100_hours_project/
├── server.js              # Express app entry point
├── package.json           # Dependencies & scripts
├── config/
│   └── .env              # Environment variables
├── routes/
│   ├── mainRoutes.js     # Page routes
│   ├── apiRoutes.js      # REST API routes
│   └── authRoutes.js     # Authentication routes
├── controllers/
│   ├── mainController.js # Homepage, login, signup pages
│   ├── characterController.js  # Character CRUD & tracing
│   ├── authController.js # User authentication logic
│   └── apiController.js  # Data API endpoints
├── models/
│   ├── Character.js       # Full traced character model
│   ├── CharacterBuilder.js # Builder pattern for characters
│   ├── TracedModifier.js # Source reference & modifier tracking
│   └── User.js          # User model (file-based)
├── views/
│   ├── index.ejs        # Landing page
│   ├── login.ejs        # Login page
│   ├── signup.ejs       # Signup page
│   ├── hall.ejs         # User lobby after login
│   ├── characterCreator.ejs # Character creation form
│   └── partials/
│       ├── header.ejs   # HTML head & nav
│       └── footer.ejs   # Scripts & closing tags
├── public/
│   ├── js/main.js       # Client-side JavaScript (empty)
│   └── styles/styles.css # Stylesheet (empty)
└── data/                # 5etools D&D 5e data (see §4)
```

---

## 3. Backend Architecture

### 3.1 Server (server.js)

- **Framework:** Express 5.x
- **Template Engine:** EJS
- **Session:** express-session (in-memory)
- **Auth:** bcrypt for password hashing
- **Middleware:** morgan (logging), flash (messages), method-override, multer
- **Port:** 3000 (configurable via .env)

### 3.2 Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | Landing page |
| `/login` | GET | Login page |
| `/signup` | GET | Signup page |
| `/hall` | GET | User lobby |
| `/createCharacter` | GET | Character creator form |
| `/createCharacter` | POST | Create character |
| `/character/:id` | GET | Get character JSON |
| `/character/:id` | PUT | Update character |
| `/logout` | POST | Logout user |
| `/api/:collection` | GET | Query data collections |
| `/api/relationships/feat-origin/:name` | GET | Get feat origin |
| `/api/relationships/subclass-feature-parent` | GET | Get subclass feature parent |
| `/api/relationships/subrace-parent` | GET | Get subrace parent |
| `/api/character/:id/sources/:attribute` | GET | Get character attribute sources |

### 3.3 Controllers

**mainController.js** - Simple page rendering
- `index()` - Landing page
- `loginPage()` - Login form
- `signupPage()` - Signup form
- `hall()` - User lobby with username

**authController.js** - User management
- `signup(req, res)` - Create user with bcrypt hashed password
- `login(req, res)` - Verify credentials, set session
- `logout(req, res)` - Destroy session

**characterController.js** - Character operations
- `getCharacterCreator()` - Load all data options for form
- `createCharacter()` - Build traced character via CharacterBuilder
- `getCharacter(id)` - Load character from file
- `updateCharacter(id)` - Update and save character
- `getCharacterSources(id, attribute)` - Trace why character has X

**apiController.js** - Data API
- `getCollection(collection, q)` - Search data collections
- `getFeatOrigin(name)` - Find which race/background grants a feat
- `getSubclassFeatureParent()` - Trace subclass feature
- `getSubraceParent()` - Trace subrace to parent race

### 3.4 Models

**User.js** - File-based user storage
- `findByUsername(username)` - Static method
- `save(user)` - Append to users.json
- Storage: `data/users.json`

**Character.js** - Full traced character model (717 lines)

Classes:
- `Character` - Main character object
- `AbilityScoreSet` - Tracked ability scores
- `ClassLevel` - Single class entry with level
- `TracedFeature` - Feature with source tracking
- `ProficiencySet` - All proficiencies tracked
- `SpellSlots` - Spell slot tracking
- `Spellbook` - Known/prepared spells
- `Equipment` - Item with source tracking

Key features:
- Every attribute has source tracking
- Full JSON serialization/deserialization
- File-based persistence
- Long rest / short rest methods

**TracedModifier.js** - Core tracing primitives (359 lines)

- `SOURCE_CATEGORIES` - Enum of source types (race, subrace, background, class, subclass, feat, magicItem, asi, charCreationOption, variantRule, special)
- `STACKING_MODES` - How modifiers combine (replace, stack, max, min)
- `SourceReference` - "Where did this come from?"
- `TracedModifier` - Value + sources + conditions
- `TracedValue` - Base value + modifiers = calculated value
- `TracedResource` - Named resource with recharge

**CharacterBuilder.js** - Builder pattern (528 lines)

- `build(options)` - Main entry point
- `applyRace()` / `applySubrace()` - Race data and racial bonuses
- `applyBackgrounds()` - Background proficiencies and features
- `applyClasses()` - Class features up to level
- `applyFeats()` - Feat bonuses and effects
- `applyCharCreationOptions()` - Special origins (e.g., Dark Gifts)
- `applyStartingEquipment()` - Equipment from class/bg
- `calculateDerivedStats()` - HP, initiative, proficiency bonus

---

## 4. Data Layer

### 4.1 Data Files (5etools v2.25.2 format)

| File | Lines | Contents |
|------|-------|----------|
| `races.json` | 21,437 | All playable races + subraces |
| `backgrounds.json` | 31,183 | Backgrounds with skills/tools/feats |
| `feats.json` | - | Feats with ability score increases |
| `optionalfeatures.json` | - | Class features, fighting styles, invocations, metamagic |
| `skills.json` | - | 18 D&D skills with ability mappings |
| `languages.json` | - | Standard and exotic languages |
| `items.json` | 78,511 | Magic items, weapons, armor |
| `items-base.json` | 8,266 | Base items and tools |
| `charcreationoptions.json` | 1,887 | Special origins (IDRotF, VRGR, MOT) |
| `conditionsdiseases.json` | - | Status conditions |
| `spells/` | 30 files | Spell definitions by source book |
| `class/` | 15+ files | Class definitions, subclasses, features |

### 4.2 DataLoader Methods

**Load Methods:**
- `loadAll()` - Loads all JSON files at server startup

**Lookup Methods:**
- `getRace(name, source)`
- `getSubrace(name, source)`
- `getBackground(name, source)`
- `getClass(name, source)`
- `getSubclass(className, subclassName, source)`
- `getFeat(name, source)`
- `getCharCreationOption(name, source)`
- `getClassFeaturesUpToLevel(className, classSource, maxLevel)`
- `getSubclassFeaturesUpToLevel(...)`
- `getItem(name, source)`
- `getSpell(name, source)`
- `getSkill(name)`
- `getCharCreationOptions()`

**Relationship Maps:**
- `featOrigins` - Map<featName, {type, name, source}> - Which race/background grants a feat
- `subraceParents` - Map<subrace|raceName|raceSource, {raceName, raceSource}> - Subrace → parent race mapping
- `classFeatureParents` - Map<featureName|className|classSource, {className, classSource, level}> - Class feature → class mapping
- `subclassFeatureParents` - Map<featureName|className|subclassShortName, {className, subclassShortName, source, level}> - Subclass feature → subclass mapping

### 4.3 Class Files

Located in `data/class/`:
- `class-artificer.json`
- `class-barbarian.json`
- `class-bard.json`
- `class-cleric.json`
- `class-druid.json`
- `class-fighter.json`
- `class-monk.json`
- `class-paladin.json`
- `class-ranger.json`
- `class-rogue.json`
- `class-sorcerer.json`
- `class-warlock.json`
- `class-wizard.json`
- `class-sidekick.json` (homebrew)
- `class-mystic.json` (homebrew)

Each file contains:
- `class[]` - Class definition
- `subclass[]` - Subclass definitions
- `classFeature[]` - Class feature definitions
- `subclassFeature[]` - Subclass feature definitions

---

## 5. Frontend

### 5.1 Views

**index.ejs** - Landing page with login/signup links

**login.ejs** - Login form

**signup.ejs** - Registration form

**hall.ejs** - User lobby with "Create a Character" link

**characterCreator.ejs** - Full character creation form with:
- Name input
- Race dropdown + conditional subrace (shows only relevant subraces)
- Class dropdown + level input + conditional subclass (shows only relevant subclasses)
- Background dropdown
- All 6 ability scores (number inputs, default 10)
- Alignment dropdown (9 alignments)
- Multi-select feats (Ctrl/Cmd to pick multiple)
- JavaScript for dynamic subclass/subrace filtering
- JSON preview after creation
- Auto-redirect to character page after creation

### 5.2 Static Assets

**public/js/main.js** - Empty (awaiting implementation)

**public/styles/styles.css** - Empty (awaiting implementation)

---

## 6. Dependencies

```json
{
  "express": "^5.2.1",
  "ejs": "^5.0.1",
  "bcrypt": "^6.0.0",
  "express-session": "^1.19.0",
  "express-flash": "^0.0.2",
  "dotenv": "^17.3.1",
  "morgan": "^1.10.1",
  "method-override": "^3.0.0",
  "multer": "^2.1.1",
  "node-fetch": "^3.3.2",
  "validator": "^13.15.26"
}
```

---

## 7. Current State & Gaps

### Working ✅

- User authentication (signup/login/logout)
- Character creation form with all D&D 5e source books
- Traceable character model with source tracking
- Character persistence (save/load to JSON files)
- API for querying character attribute sources
- Data loader with relationship mapping

### Missing/Incomplete ❌

| Area | Status | Notes |
|------|--------|-------|
| Character View Page | **Missing** | `/character/:id` returns JSON, needs HTML view |
| Character Sheet UI | **Missing** | Need full D&D character sheet display |
| Multiclass Support | **Partial** | Form only supports single class |
| Skill Selection UI | **Missing** | Backgrounds give skill choices, not selectable |
| Equipment Selection | **Missing** | Only auto-applies default starting equipment |
| Spell Management | **Missing** | No spell selection/preparation UI |
| Level Up | **Missing** | No progression system |
| Rest System | **Missing** | Long/short rest UI |
| Combat Tracker | **Missing** | HP tracking, conditions, exhaustion |
| Dice Roller | **Missing** | No dice rolling integration |
| Character List | **Missing** | View all characters in hall |
| CSS Styling | **Empty** | `styles.css` is blank |
| Client JS | **Empty** | `main.js` is blank |
| Tests | **Missing** | No test suite |
| Error Handling | **Basic** | Needs improvement |
| Input Validation | **Missing** | No validation on character creation |

---

## 8. Recommended Implementation Order

### Phase 1: Core Features

1. **Character Sheet View** - Display saved character as full sheet
2. **Skill Selection** - When backgrounds give choices
3. **Equipment Management** - Select starting equipment options
4. **Character List** - Show user's characters in hall

### Phase 2: Gameplay

5. **Multiclass UI** - Support multiple classes
6. **Level Up System** - Progress characters
7. **Spell Selection** - Add/remove spells
8. **Rest System** - Long rest / short rest UI
9. **HP & Conditions** - Track during gameplay

### Phase 3: Polish

10. **CSS Styling** - Make it look good
11. **Dice Roller** - Built-in rolling
12. **Source Tooltips** - "Why do I have this?" hover info
13. **Export/Import** - PDF export, backup

---

## 9. Key Technical Decisions

### Traced Attribute System

Every character attribute is computed with full provenance:

```
Example: AC 18
├── Chain Mail (+16)     ← Class Equipment (Fighter starting gear)
├── DEX mod (+2)         ← Racial (Human base)
└── Defense FS (+1)      ← Subclass Feature (Champion Fighter @ Level 3)
```

Query example:
```
GET /api/character/abc123/sources/abilityScores
→ { strength: { total: 18, breakdown: [...] } }
```

### Data Format

Uses 5etools v2.25.2 JSON format - industry standard for D&D 5e data. This allows:
- Easy import of new source books
- Compatibility with other 5e tools
- Well-documented structure

### Persistence

File-based JSON storage:
- Characters: `data/generated/characters/:id.json`
- Users: `data/users.json`

### Future Considerations

- Consider PostgreSQL for multi-user with character ownership
- Redis for session storage (currently in-memory)
- WebSocket for real-time game state sync
- Mobile-responsive design

---

## 10. API Reference

### Character CRUD

```
POST   /createCharacter       - Create new character
GET    /character/:id         - Get character data
PUT    /character/:id         - Update character
```

### Source Tracing

```
GET    /api/character/:id/sources/:attribute
       attributes: abilityScores, ac, initiative, speed, proficiency,
                   features, skills, savingThrows
```

### Data Queries

```
GET    /api/:collection       - Query data (races, backgrounds, classes, etc.)
       ?q=searchterm         - Filter by name
       ?className=Fighter    - For subclasses

GET    /api/relationships/feat-origin/:name
GET    /api/relationships/subclass-feature-parent
GET    /api/relationships/subrace-parent
```

---

## 11. File Inventory

| Path | Lines | Purpose |
|------|-------|---------|
| server.js | 53 | Express app entry point |
| package.json | 30 | Dependencies |
| routes/mainRoutes.js | 16 | Page routes |
| routes/apiRoutes.js | 13 | REST API routes |
| routes/authRoutes.js | 10 | Auth routes |
| controllers/mainController.js | 15 | Page controllers |
| controllers/characterController.js | 237 | Character logic |
| controllers/authController.js | 43 | Auth logic |
| controllers/apiController.js | 57 | Data API |
| models/Character.js | 717 | Character model |
| models/CharacterBuilder.js | 528 | Builder pattern |
| models/TracedModifier.js | 359 | Tracing primitives |
| models/User.js | 34 | User model |
| data/loader.js | 352 | Data loader |
| views/*.ejs | - | Templates |

---

*Last Updated: March 2026*
