import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Parser from "../utils/parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keys whose values are structured metadata rather than entry text; the
// entry walker (used by dereferencing and link inspection) skips these.
const NON_ENTRY_KEYS = new Set([
	"name", "source", "page", "images", "image", "alt", "id", "caption", "title",
	"file", "href", "style", "rollable", "toRoll", "displayText", "nameDisplay",
	"type", "subType", "entriesTemplate", "rows", "rowLabel", "colLabel",
	"data", "dataLabels", "dataRows", "shortName", "className", "classSource",
	"subclassName", "subclassShortName", "subclassSource", "level", "hd",
	"speed", "size", "weight", "value", "ac", "hp", "proficiency",
	"spellcastingAbility", "casterProgression", "chance", "amount", "count",
	"min", "max", "traitTags", "reprintedAs", "reprintOf", "srd", "basicRules",
	"excludeFromSearch", "isReprinted", "header", "otherSources", "altArt",
	"pageNumber", "parent", "group", "requires", "suggests", "sourcePage",
]);

// 5etools `{@tag name|source|extra}` link tag regex (cf. js/render.js)
const TAG_REGEX = /\{@([a-zA-Z0-9_:]+)\s+([^}]+)\}/g;

class DataLoader {
  constructor(dataDir = __dirname) {
    this.dataDir = dataDir;
    this.races = [];
    this.subraces = [];
    this.backgrounds = [];
    this.feats = [];
    this.classes = [];
    this.subclasses = [];
    this.subclassFeatures = [];
    this.classFeatures = [];
    this.optionalFeatures = [];
    this.spells = [];
    this.filteredSpells = [];
    this.items = [];
    this.skills = [];
    this.languages = [];
    this.spellSourceLookup = null;

    this.featOrigins = new Map(); // featName -> { type: 'race'|'background', name: string, source: string }
    this.subclassFeatureParents = new Map(); // featureName|className|subclassShortName -> { className: string, subclassShortName: string, source: string }
    this.subraceParents = new Map(); // subraceName|raceName|raceSource -> { raceName: string, raceSource: string }
    this.classFeatureParents = new Map(); // featureName|className|classSource -> { className: string, classSource: string }
    this.isLoaded = false;

    // 5etools DataLoader pattern (cf. js/utils-dataloader): page/source/hash cache
    this._CACHE = new Map(); // "page|source|hash" -> entity (or _ENTITY_NULL sentinel)
    this._ENTITY_NULL = Symbol("entity-null");
    this._MAX_DEREFERENCE_LOOPS = 25; // conservatively avoid infinite looping
    this._derefStats = { replaced: 0, failed: 0, itemEntrySpliced: 0 };

    this.Parser = Parser; // expose the ported 5etools parser to consumers
    this.charoptions = null;
  }

  // Page -> loader collection property (5etools "props" equivalent)
  _PAGE_TO_COLLECTION = {
    race: "races",
    subrace: "subraces",
    background: "backgrounds",
    feat: "feats",
    optionalfeature: "optionalFeatures",
    spell: "spells",
    item: "items",
    skill: "skills",
    language: "languages",
    class: "classes",
    subclass: "subclasses",
    classFeature: "classFeatures",
    subclassFeature: "subclassFeatures",
    charoption: "charoptions",
  };

  // Page -> entity hash builder (cf. 5etools UrlUtil.URL_TO_HASH_BUILDER)
  _PAGE_TO_HASH_BUILDER = {
    race: (e) => `${e.name}|${e.source}`.toLowerCase(),
    subrace: (e) =>
      `${e.name || e.raceName || "Standard"}|${e.source || e.raceSource || ""}`.toLowerCase(),
    background: (e) => `${e.name}|${e.source}`.toLowerCase(),
    feat: (e) => `${e.name}|${e.source}`.toLowerCase(),
    optionalfeature: (e) => `${e.name}|${e.source}`.toLowerCase(),
    spell: (e) => `${e.name}|${e.source}`.toLowerCase(),
    item: (e) => `${e.name}|${e.source}`.toLowerCase(),
    skill: (e) => `${e.name}|${e.source}`.toLowerCase(),
    language: (e) => `${e.name}|${e.source}`.toLowerCase(),
    class: (e) => `${e.name}|${e.source}`.toLowerCase(),
    subclass: (e) =>
      `${e.name || e.subclassShortName || ""}|${e.className || ""}|${e.source || ""}`.toLowerCase(),
    classFeature: (e) =>
      `${e.name}|${e.className}|${e.classSource}|${e.level}`.toLowerCase(),
    subclassFeature: (e) =>
      `${e.name}|${e.className}||${e.subclassShortName || e.subclassName || ""}|${e.source || e.subclassSource || ""}|${e.level}`.toLowerCase(),
    charoption: (e) => `${e.name}|${e.source}`.toLowerCase(),
  };

  async loadAll() {
    if (this.isLoaded) return;

    try {
      // Load races and subraces
      const racesPath = path.join(this.dataDir, "races.json");
      if (fs.existsSync(racesPath)) {
        const racesData = JSON.parse(fs.readFileSync(racesPath, "utf8"));
        this.races = racesData.race || [];
        this.subraces = racesData.subrace || [];
      }

      // Load backgrounds
      const backgroundsPath = path.join(this.dataDir, "backgrounds.json");
      if (fs.existsSync(backgroundsPath)) {
        const backgroundsData = JSON.parse(
          fs.readFileSync(backgroundsPath, "utf8"),
        );
        this.backgrounds = backgroundsData.background || [];
      }

      // Load feats
      const featsPath = path.join(this.dataDir, "feats.json");
      if (fs.existsSync(featsPath)) {
        const featsData = JSON.parse(fs.readFileSync(featsPath, "utf8"));
        const rawFeats = featsData.feat || [];
        this.feats = [];
        rawFeats.forEach((f) => {
          this.feats.push(f);
          if (f._versions) {
            f._versions.forEach((v) => {
              const merged = { ...f, ...v };
              delete merged._versions;
              this.feats.push(merged);
            });
          }
        });
      }

      // Load optional features
      const optPath = path.join(this.dataDir, "optionalfeatures.json");
      if (fs.existsSync(optPath)) {
        const optData = JSON.parse(fs.readFileSync(optPath, "utf8"));
        this.optionalFeatures = optData.optionalfeature || [];
      }

      // Load spells
      const spellsDir = path.join(this.dataDir, "spells");
      if (fs.existsSync(spellsDir)) {
        const spellFiles = fs
          .readdirSync(spellsDir)
          .filter((f) => f.startsWith("spells-") && f.endsWith(".json"));
        for (const file of spellFiles) {
          const data = JSON.parse(
            fs.readFileSync(path.join(spellsDir, file), "utf8"),
          );
          if (data.spell) this.spells.push(...data.spell);
        }
      }

      // Load filtered spells index (class->spell membership)
      const filteredSpellsPath = path.join(
        this.dataDir,
        "spells",
        "Filtered_spells.json",
      );
      if (fs.existsSync(filteredSpellsPath)) {
        this.filteredSpells = JSON.parse(
          fs.readFileSync(filteredSpellsPath, "utf8"),
        );
      }

      // Load items
      const itemsPath = path.join(this.dataDir, "items.json");
      if (fs.existsSync(itemsPath)) {
        const itemsData = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
        this.items = itemsData.item || [];
        this.itemGroups = itemsData.itemGroup || []; // `{#itemEntry X}` ref targets

        const itemsBasePath = path.join(this.dataDir, "items-base.json");
        if (fs.existsSync(itemsBasePath)) {
          const itemsBaseData = JSON.parse(
            fs.readFileSync(itemsBasePath, "utf8"),
          );
          this.itemEntries = itemsBaseData.itemEntry || [];
        }
      }

      // Load skills
      const skillsPath = path.join(this.dataDir, "skills.json");
      if (fs.existsSync(skillsPath)) {
        const skillsData = JSON.parse(fs.readFileSync(skillsPath, "utf8"));
        this.skills = skillsData.skill || [];
      }

      // Load languages
      const langPath = path.join(this.dataDir, "languages.json");
      if (fs.existsSync(langPath)) {
        const langData = JSON.parse(fs.readFileSync(langPath, "utf8"));
        this.languages = langData.language || [];
      }

      // Load character creation options (cached for the lookup cache)
      const ccPath = path.join(this.dataDir, "charcreationoptions.json");
      if (fs.existsSync(ccPath)) {
        const ccData = JSON.parse(fs.readFileSync(ccPath, "utf8"));
        this.charoptions = ccData.charoption || [];
      }

      // Load classes, subclasses, and features
      const classDir = path.join(this.dataDir, "class");
      if (fs.existsSync(classDir)) {
        const classFiles = fs
          .readdirSync(classDir)
          .filter((f) => f.startsWith("class-") && f.endsWith(".json"));

        for (const file of classFiles) {
          const data = JSON.parse(
            fs.readFileSync(path.join(classDir, file), "utf8"),
          );
          if (data.class) this.classes.push(...data.class);
          if (data.subclass) this.subclasses.push(...data.subclass);
          if (data.subclassFeature)
            this.subclassFeatures.push(...data.subclassFeature);
          if (data.classFeature) this.classFeatures.push(...data.classFeature);
        }
      }

      // Load spell source lookup (class -> spell mappings)
      const spellLookupPath = path.join(
        this.dataDir,
        "generated",
        "gendata-spell-source-lookup.json",
      );
      if (fs.existsSync(spellLookupPath)) {
        this.spellSourceLookup = JSON.parse(
          fs.readFileSync(spellLookupPath, "utf8"),
        );
      }

      this.mapRelationships();
      this._pPopulateCache();
      this._dereferenceAll();
      this._inspectLinks();
      this.isLoaded = true;
      console.log(
        `Data loaded and relationships mapped. Dereferenced refs: ${this._derefStats.replaced}, unresolved: ${this._derefStats.failed}, itemEntry splices: ${this._derefStats.itemEntrySpliced}.`,
      );
    } catch (error) {
      console.error("Error loading data:", error);
      throw error;
    }
  }

  mapRelationships() {
    // Map Feat Origins
    this.races.forEach((race) => {
      if (race.feats) {
        race.feats.forEach((f) => {
          const featKey = Object.keys(f)[0];
          const featName = featKey.split("|")[0].toLowerCase();
          if (!this.featOrigins.has(featName)) {
            this.featOrigins.set(featName, {
              type: "race",
              name: race.name,
              source: race.source,
            });
          }
        });
      }
    });

    this.backgrounds.forEach((bg) => {
      if (bg.feats) {
        bg.feats.forEach((f) => {
          const featKey = Object.keys(f)[0];
          const featName = featKey.split("|")[0].toLowerCase();
          if (!this.featOrigins.has(featName)) {
            this.featOrigins.set(featName, {
              type: "background",
              name: bg.name,
              source: bg.source,
            });
          }
        });
      }
    });

    // Map Subrace Parents
    this.subraces.forEach((sr) => {
      const raceName = sr.raceName || (sr._copy && sr._copy.raceName);
      const raceSource = sr.raceSource || (sr._copy && sr._copy.raceSource);

      if (raceName && raceSource) {
        const srName = sr.name || raceName || "Standard";
        const key = `${srName}|${raceName}|${raceSource}`.toLowerCase();
        if (!this.subraceParents.has(key)) {
          this.subraceParents.set(key, {
            raceName: raceName,
            raceSource: raceSource,
          });
        }
      }
    });

    // Map Class Feature Parents
    this.classFeatures.forEach((cf) => {
      const key = `${cf.name}|${cf.className}|${cf.classSource}`.toLowerCase();
      if (!this.classFeatureParents.has(key)) {
        this.classFeatureParents.set(key, {
          className: cf.className,
          classSource: cf.classSource,
          level: cf.level,
        });
      }
    });

    // Map Subclass Feature Parents
    this.subclassFeatures.forEach((sf) => {
      const key =
        `${sf.name}|${sf.className}|${sf.subclassShortName}`.toLowerCase();
      if (!this.subclassFeatureParents.has(key)) {
        this.subclassFeatureParents.set(key, {
          className: sf.className,
          subclassShortName: sf.subclassShortName,
          source: sf.source,
          level: sf.level,
        });
      }
    });
  }

  /* ------------------------------------------------------------------
   * 5etools DataLoader pattern (cf. js/utils-dataloader): cache layer
   * ------------------------------------------------------------------ */

  _getCacheKey(page, source, hash) {
    return `${page}|${source || ""}|${hash || ""}`.toLowerCase();
  }

  _copyFast(obj) {
    return obj !== null && typeof obj === "object"
      ? JSON.parse(JSON.stringify(obj))
      : obj;
  }

  /**
   * Index every loaded collection into the page/source/hash cache.
   */
  _pPopulateCache() {
    for (const [page, collectionName] of Object.entries(this._PAGE_TO_COLLECTION)) {
      const collection = this[collectionName];
      if (!Array.isArray(collection)) continue;
      const builder = this._PAGE_TO_HASH_BUILDER[page];
      for (const ent of collection) {
        const hash = builder(ent);
        this._CACHE.set(this._getCacheKey(page, ent.source, hash), ent);
      }
    }
  }

  /**
   * Resolve a `ref*` uid against the loaded collections. Uid fields may be
   * missing (e.g. `"Archery"`, `"Student of War|Fighter||Battle Master||3"`),
   * in which case matching tolerates the absent parts.
   */
  _derefLookup(prop, uid) {
    if (!uid) return null;
    const parts = String(uid).split("|").map((p) => p.trim());
    const name = (parts[0] || "").toLowerCase();
    if (!name) return null;

    const matchesName = (e) => (e.name || "").toLowerCase() === name;

    switch (prop) {
      case "classFeature": {
        const [, className = "", classSource = "", level = ""] = parts;
        return (
          this.classFeatures.find(
            (cf) =>
              matchesName(cf) &&
              (!className ||
                (cf.className || "").toLowerCase() === className.toLowerCase()) &&
              (!classSource ||
                (cf.classSource || "").toLowerCase() === classSource.toLowerCase()) &&
              (!level || String(cf.level) === String(level)),
          ) || null
        );
      }
      case "subclassFeature": {
        const [, className = "", , subclassShortName = "", source = "", level = ""] = parts;
        return (
          this.subclassFeatures.find(
            (sf) =>
              matchesName(sf) &&
              (!className ||
                (sf.className || "").toLowerCase() === className.toLowerCase()) &&
              (!subclassShortName ||
                (sf.subclassShortName || sf.subclassName || "")
                  .toLowerCase() === subclassShortName.toLowerCase()) &&
              (!source ||
                (sf.source || sf.subclassSource || "")
                  .toLowerCase() === source.toLowerCase()) &&
              (!level || String(sf.level) === String(level)),
          ) || null
        );
      }
      case "optionalfeature": {
        const [, source = ""] = parts;
        return (
          this.optionalFeatures.find(
            (of) =>
              matchesName(of) &&
              (!source ||
                (of.source || "").toLowerCase() === source.toLowerCase()),
          ) || null
        );
      }
      case "feat": {
        const [, source = ""] = parts;
        return (
          this.feats.find(
            (f) =>
              matchesName(f) &&
              (!source ||
                (f.source || "").toLowerCase() === source.toLowerCase()),
          ) || null
        );
      }
      case "itemEntry": {
        const [, source = ""] = parts;
        const inItems = this.items.find(
          (i) =>
            matchesName(i) &&
            (!source || (i.source || "").toLowerCase() === source.toLowerCase()),
        );
        if (inItems) return inItems;
        const inGroups =
          this.itemGroups?.find(
            (g) =>
              matchesName(g) &&
              (!source || (g.source || "").toLowerCase() === source.toLowerCase()),
          ) || null;
        if (inGroups) return inGroups;
        return (
          this.itemEntries?.find(
            (e) =>
              matchesName(e) &&
              (!source || (e.source || "").toLowerCase() === source.toLowerCase()),
          ) || null
        );
      }
      default:
        return null;
    }
  }

  /**
   * @param page e.g. "race", "spell", "classFeature", ...
   * @param source e.g. "PHB"
   * @param hash normalized entity hash (see _PAGE_TO_HASH_BUILDER)
   */
  getFromCache(page, source, hash, { isCopy = false, isRequired = false } = {}) {
    const ent = this._CACHE.get(this._getCacheKey(page, source, hash));
    if (ent === this._ENTITY_NULL || ent == null) {
      if (isRequired) {
        throw new Error(
          `Could not find entity for page "${page}" with source "${source}" and hash "${hash}"`,
        );
      }
      return null;
    }
    return isCopy ? this._copyFast(ent) : ent;
  }

  /**
   * 5etools `pCacheAndGet` equivalent. Implemented synchronously: all data is
   * preloaded at boot, so there is no async fetch step.
   */
  pCacheAndGet(page, source, hash, { isCopy = false, isRequired = false } = {}) {
    const key = this._getCacheKey(page, source, hash);
    const cached = this._CACHE.get(key);
    if (cached === this._ENTITY_NULL) {
      if (isRequired) {
        throw new Error(
          `Could not find entity for page "${page}" with source "${source}" and hash "${hash}"`,
        );
      }
      return null;
    }
    if (cached != null) return isCopy ? this._copyFast(cached) : cached;

    // Cache miss: resolve against the loaded collections, then insert
    let ent = null;
    const builder = this._PAGE_TO_HASH_BUILDER[page];
    const collection = this[this._PAGE_TO_COLLECTION[page]];
    if (builder && Array.isArray(collection)) {
      ent =
        collection.find(
          (e) =>
            builder(e) === hash.toLowerCase() &&
            (!source || (e.source || "").toLowerCase() === source.toLowerCase()),
        ) || null;
    }
    this._CACHE.set(key, ent === null ? this._ENTITY_NULL : ent);

    if (ent == null && isRequired) {
      throw new Error(
        `Could not find entity for page "${page}" with source "${source}" and hash "${hash}"`,
      );
    }
    return ent == null ? null : isCopy ? this._copyFast(ent) : ent;
  }

  /** Return every entity loaded for a page (5etools `pCacheAndGetAll`). */
  pCacheAndGetAll(page) {
    const collection = this[this._PAGE_TO_COLLECTION[page]];
    if (!Array.isArray(collection)) return null;
    return collection;
  }

  /* ------------------------------------------------------------------
   * 5etools DataLoader dereferencer
   * (cf. js/utils-dataloader/utils-dataloader-dereferencing.js)
   * Replaces `ref*` objects and `{#...}` strings inside `entries` with deep
   * copies of the entities they link to, so consumers see fully-resolved
   * content (exactly as 5etools serves dereferenced data).
   * ------------------------------------------------------------------ */

  static _REF_TYPE_TO_PROP = {
    refClassFeature: "classFeature",
    refSubclassFeature: "subclassFeature",
    refOptionalfeature: "optionalfeature",
    refFeat: "feat",
    refItemEntry: "itemEntry",
  };

  /** Recursively walk entry-bearing structures, invoking handlers. */
  _walkEntries(node, handlers, seen = new Set()) {
    if (typeof node === "string") {
      if (handlers.string) handlers.string(node);
      return;
    }
    if (node === null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      if (handlers.array) handlers.array(node);
      for (const item of node) this._walkEntries(item, handlers, seen);
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (NON_ENTRY_KEYS.has(key)) continue;
      this._walkEntries(value, handlers, seen);
    }
  }

  _dereferenceAll() {
    const refPropByType = DataLoader._REF_TYPE_TO_PROP;

    for (let i = 0; i < this._MAX_DEREFERENCE_LOOPS; ++i) {
      let anyReplaced = false;

      for (const page of Object.keys(this._PAGE_TO_COLLECTION)) {
        const collection = this[this._PAGE_TO_COLLECTION[page]];
        if (!Array.isArray(collection)) continue;

        for (const ent of collection) {
          const toReplaceMetas = [];
          this._walkEntries(ent, {
            array: (arr) => {
              arr.forEach((it, ix) => {
                if (it && typeof it === "object" && refPropByType[it.type]) {
                  toReplaceMetas.push({ ...it, array: arr, ix });
                  return;
                }
                if (
                  typeof it === "string" &&
                  it.startsWith("{#") &&
                  it.endsWith("}")
                ) {
                  toReplaceMetas.push({ string: it, array: arr, ix });
                }
              });
            },
          });

          if (!toReplaceMetas.length) continue;
          anyReplaced = true;

          let cntReplaces = 0;
          for (let ixReplace = 0; ixReplace < toReplaceMetas.length; ++ixReplace) {
            const derefMeta = this._dereferenceOne(toReplaceMetas[ixReplace]);
            cntReplaces += derefMeta.cntReplaces;
            if (derefMeta.offsetIx) {
              toReplaceMetas
                .slice(ixReplace + 1)
                .forEach((it) => (it.ix += derefMeta.offsetIx));
            }
          }

          if (cntReplaces < toReplaceMetas.length) {
            this._derefStats.failed += toReplaceMetas.length - cntReplaces;
          }
        }
      }

      if (!anyReplaced) break;
    }
  }

  /** Resolve a single ref object / `{#...}` string; returns {cntReplaces, offsetIx}. */
  _dereferenceOne(meta) {
    const refPropByType = DataLoader._REF_TYPE_TO_PROP;

    // `{#itemEntry Absorbing Tattoo|TCE}` -> {type: "refItemEntry", itemEntry: "..."}
    if (meta.string != null) {
      const m = /^\{#([a-zA-Z]+)\s+([^}]+)\}$/.exec(meta.string);
      if (!m) return { cntReplaces: 0 };
      const type = `ref${m[1][0].toUpperCase()}${m[1].slice(1)}`;
      if (!refPropByType[type]) return { cntReplaces: 0 };
      meta.type = type;
      meta[refPropByType[type]] = m[2];
    }

    const prop = refPropByType[meta.type];
    if (!prop) return { cntReplaces: 0 };

    const target = this._derefLookup(prop, meta[prop]);
    if (!target) return { cntReplaces: 0 };

    const cpy = this._copyFast(target);

    switch (meta.type) {
      case "refClassFeature":
      case "refSubclassFeature":
        delete cpy.header;
        break;
      case "refOptionalfeature":
        if (!meta.preserve?.prerequisite) delete cpy.prerequisite;
        delete cpy.featureType;
        break;
      case "refFeat":
        if (!meta.preserve?.prerequisite) delete cpy.prerequisite;
        break;
      case "refItemEntry": {
        const template = cpy.entriesTemplate || cpy.entries || [];
        // Skip self-referential template elements (e.g. an itemGroup whose own
        // entries begin with the `{#itemEntry X|S}` marker it is being spliced
        // from), which would otherwise recurse indefinitely across loops.
        const tagName = meta.type.slice(3);
        const selfRef = `{#${tagName[0].toLowerCase()}${tagName.slice(1)} ${meta.itemEntry}}`;
        const spliced = this._copyFast(
          template.filter(
            (it) => typeof it !== "string" || it !== selfRef,
          ),
        );
        meta.array.splice(meta.ix, 1, ...spliced);
        this._derefStats.itemEntrySpliced++;
        return { cntReplaces: 1, offsetIx: spliced.length - 1 };
      }
      default:
        return { cntReplaces: 0 };
    }

    if (meta.name) cpy.name = meta.name;
    cpy.type ||= "entries";
    meta.array[meta.ix] = cpy;
    this._derefStats.replaced++;
    return { cntReplaces: 1, offsetIx: 0 };
  }

  /* ------------------------------------------------------------------
   * Link inspection: parse `{@tag ...}` link tags (and structured link
   * fields) with the regex parser and attach resolved entity links.
   * ------------------------------------------------------------------ */

  _inspectLinks() {
    for (const page of Object.keys(this._PAGE_TO_COLLECTION)) {
      const collection = this[this._PAGE_TO_COLLECTION[page]];
      if (!Array.isArray(collection)) continue;

      for (const ent of collection) {
        if (!ent || typeof ent !== "object") continue;

        const links = {};
        const addLink = (tag, resolved) => {
          if (!resolved) return;
          (links[tag] = links[tag] || []);
          if (!links[tag].includes(resolved)) links[tag].push(resolved);
        };

        if (ent.entries) {
          this._walkEntries(ent, {
            string: (str) => {
              if (!str.includes("{@")) return;
              for (const m of str.matchAll(TAG_REGEX)) {
                const tag = m[1].toLowerCase();
                const parts = m[2].split("|").map((p) => p.trim());
                addLink(tag, this._resolveLink(tag, parts));
              }
            },
          });
        }

        this._collectStructuredLinks(ent, addLink);

        if (Object.keys(links).length) {
          // Non-enumerable: keeps JSON.stringify (safeStringify in controllers)
          // from recursing into the link graph.
          Object.defineProperty(ent, "_links", {
            value: links,
            enumerable: false,
            configurable: true,
            writable: true,
          });
        }
      }
    }
  }

  /** Structured link fields: `additionalSpells` uids, race/background `feats`, class/subclass feature lists. */
  _collectStructuredLinks(ent, addLink) {
    const addUid = (prop, uid, tag) => {
      const [name = "", source = ""] = String(uid).split("|");
      if (!name.trim()) return;
      addLink(tag, this.pCacheAndGet(prop, source, `${name.trim()}|${source}`.toLowerCase()));
    };

    // class.classFeatures / subclass.subclassFeatures: feature uid lists
    const featureListProp = Array.isArray(ent.classFeatures)
      ? ent.classFeatures
      : Array.isArray(ent.subclassFeatures)
        ? ent.subclassFeatures
        : null;
    if (featureListProp) {
      const prop = Array.isArray(ent.classFeatures) ? "classFeature" : "subclassFeature";
      const tag = Array.isArray(ent.classFeatures) ? "classFeature" : "subclassFeature";
      featureListProp.forEach((item) => {
        const uid = typeof item === "string" ? item : item?.classFeature || item?.subclassFeature;
        if (uid) addLink(tag, this._derefLookup(prop, uid));
      });
    }

    if (Array.isArray(ent.additionalSpells)) {
      ent.additionalSpells.forEach((block) => {
        ["known", "prepared"].forEach((prop) => {
          const lists = block?.[prop];
          if (!lists) return;
          Object.values(lists).forEach((list) => {
            (Array.isArray(list) ? list : [list]).forEach((item) => {
              if (typeof item === "string") addUid("spell", item, "spell");
              else if (item?.choose && typeof item.choose === "string")
                addUid("spell", item.choose, "spell");
            });
          });
        });
        const innate = block?.innate;
        if (innate) {
          Object.values(innate).forEach((daily) => {
            if (!daily || typeof daily !== "object") return;
            Object.values(daily).forEach((list) => {
              (Array.isArray(list) ? list : [list]).forEach((item) => {
                if (typeof item === "string") addUid("spell", item, "spell");
              });
            });
          });
        }
      });
    }

    if (Array.isArray(ent.feats)) {
      ent.feats.forEach((f) => {
        const key = Object.keys(f || {})[0];
        if (key) addUid("feat", key, "feat");
      });
    }
  }

  /** Resolve a `{@tag ...}` link to a loaded entity (5etools render-time resolution). */
  _resolveLink(tag, parts) {
    const name = parts[0] || "";
    const source = parts[1] || "";
    switch (tag) {
      case "spell":
        return this.getSpell(name, source);
      case "feat":
        return this.getFeat(name, source);
      case "item":
        return this.getItem(name, source);
      case "race":
        return this.getRace(name, source);
      case "background":
        return this.getBackground(name, source);
      case "class":
        return this.getClass(name, source);
      case "subclass":
        return this.getSubclass(parts[1] || "", name, parts[2] || "");
      case "optfeature":
      case "optionalfeature":
        return this.getOptionalFeatures().find(
          (of) =>
            of.name.toLowerCase() === name.toLowerCase() &&
            (!source || of.source.toLowerCase() === source.toLowerCase()),
        ) || null;
      case "skill":
        return this.getSkill(name);
      case "language":
        return (
          this.languages?.find(
            (l) =>
              l.name.toLowerCase() === name.toLowerCase() &&
              (!source || l.source.toLowerCase() === source.toLowerCase()),
          ) || null
        );
      default:
        return null;
    }
  }

  /** Linked-entity details for a loaded entity (resolved via the regex parser). */
  getEntityLinks(entity) {
    return entity && typeof entity === "object" ? entity._links || null : null;
  }

  /** Resolve an entity by page/name/source and return its linked details. */
  getLinkedEntities(page, name, source = "") {
    const builder = this._PAGE_TO_HASH_BUILDER[page];
    if (!builder) return null;
    const ent = this.pCacheAndGet(page, source, builder({ name, source }));
    return this.getEntityLinks(ent);
  }

  getFeatOrigin(featName) {
    return this.featOrigins.get(featName.toLowerCase());
  }

  getSubraceParent(subraceName, raceName, raceSource) {
    const key = `${subraceName}|${raceName}|${raceSource}`.toLowerCase();
    return this.subraceParents.get(key);
  }

  getClassFeatureParent(featureName, className, classSource) {
    const key = `${featureName}|${className}|${classSource}`.toLowerCase();
    return this.classFeatureParents.get(key);
  }

  getSubclassFeatureParent(featureName, className, subclassShortName) {
    const key =
      `${featureName}|${className}|${subclassShortName}`.toLowerCase();
    return this.subclassFeatureParents.get(key);
  }

  // General data access
  getRaces() {
    return this.races;
  }
  getSubraces() {
    return this.subraces;
  }
  getBackgrounds() {
    return this.backgrounds;
  }
  getFeats() {
    return this.feats;
  }
  getClasses() {
    return this.classes;
  }
  getSubclasses(className) {
    if (className)
      return this.subclasses.filter(
        (sc) => sc.className.toLowerCase() === className.toLowerCase(),
      );
    return this.subclasses;
  }
  getSpells() {
    return this.spells;
  }
  getItems() {
    return this.items;
  }
  getOptionalFeatures(type) {
    if (type)
      return this.optionalFeatures.filter(
        (of) => of.featureType && of.featureType.includes(type),
      );
    return this.optionalFeatures;
  }

  // Character building helpers
  getRace(name, source = "PHB") {
    const key = `${name}|${source}`.toLowerCase();
    const exactMatch = this.races.find(
      (r) => `${r.name}|${r.source}`.toLowerCase() === key,
    );
    if (exactMatch) return exactMatch;

    return (
      this.races.find((r) => r.name.toLowerCase() === name.toLowerCase()) ||
      null
    );
  }

  getSubrace(name, source = null) {
    const key = name.toLowerCase();
    if (this.subraces) {
      return this.subraces.find((sr) => {
        const srName = sr.name || sr.raceName || "Standard";
        return (
          `${srName}|${sr.source}`.toLowerCase() === `${name}|${source}`.toLowerCase() ||
          srName.toLowerCase() === key
        );
      });
    }
    return null;
  }

  getBackground(name, source = "PHB") {
    const key = `${name}|${source}`.toLowerCase();
    const exactMatch = this.backgrounds.find(
      (b) => `${b.name}|${b.source}`.toLowerCase() === key,
    );
    if (exactMatch) return exactMatch;

    return (
      this.backgrounds.find((b) => b.name.toLowerCase() === name.toLowerCase()) ||
      null
    );
  }

  getClass(name, source = "PHB") {
    const key = `${name}|${source}`.toLowerCase();
    const exactMatch = this.classes.find(
      (c) => `${c.name}|${c.source}`.toLowerCase() === key,
    );
    if (exactMatch) return exactMatch;

    return (
      this.classes.find((c) => c.name.toLowerCase() === name.toLowerCase()) ||
      null
    );
  }

  getSubclass(className, subclassName, source = "PHB") {
    const exact = this.subclasses.find(
      (sc) =>
        sc.className?.toLowerCase() === className.toLowerCase() &&
        (sc.name?.toLowerCase() === subclassName.toLowerCase() ||
          sc.subclassShortName?.toLowerCase() ===
          subclassName.toLowerCase()) &&
        sc.source?.toLowerCase() === source.toLowerCase(),
    );
    if (exact) return exact;

    // Fallback: match by className + subclassName only (ignore source)
    return (
      this.subclasses.find(
        (sc) =>
          sc.className?.toLowerCase() === className.toLowerCase() &&
          (sc.name?.toLowerCase() === subclassName.toLowerCase() ||
            sc.subclassShortName?.toLowerCase() ===
            subclassName.toLowerCase()),
      ) || null
    );
  }

  getFeat(name, source = null) {
    const lowerName = name.toLowerCase();
    if (source) {
      const key = `${name}|${source}`.toLowerCase();
      const exact = this.feats.find(
        (f) => `${f.name}|${f.source}`.toLowerCase() === key,
      );
      if (exact) return exact;
    }
    return this.feats.find((f) => f.name.toLowerCase() === lowerName) || null;
  }

  getCharCreationOption(name, source = null) {
    const options = this.getCharCreationOptions();
    if (source) {
      const key = `${name}|${source}`.toLowerCase();
      return options.find((o) => `${o.name}|${o.source}`.toLowerCase() === key);
    }
    const lowerName = name.toLowerCase();
    return options.find((o) => o.name.toLowerCase() === lowerName) || null;
  }

  getCharCreationOptions() {
    if (this.charoptions) return this.charoptions;
    const ccPath = path.join(this.dataDir, "charcreationoptions.json");
    if (fs.existsSync(ccPath)) {
      const data = JSON.parse(fs.readFileSync(ccPath, "utf8"));
      this.charoptions = data.charoption || [];
      return this.charoptions;
    }
    this.charoptions = [];
    return this.charoptions;
  }

  getClassFeaturesUpToLevel(className, classSource, maxLevel) {
    const features = this.classFeatures.filter(
      (f) =>
        f.className?.toLowerCase() === className.toLowerCase() &&
        f.classSource?.toLowerCase() === (classSource || "").toLowerCase() &&
        f.level <= maxLevel,
    );
    return features.sort((a, b) => a.level - b.level);
  }

  getSubclassFeaturesUpToLevel(
    className,
    classSource,
    subclassName,
    subclassSource,
    maxLevel,
  ) {
    const features = this.subclassFeatures.filter(
      (f) =>
        f.className?.toLowerCase() === className.toLowerCase() &&
        f.source?.toLowerCase() === (subclassSource || "").toLowerCase() &&
        (f.subclassShortName?.toLowerCase() === subclassName.toLowerCase() ||
          f.subclassName?.toLowerCase() === subclassName.toLowerCase()) &&
        f.level <= maxLevel,
    );
    return features.sort((a, b) => a.level - b.level);
  }

  getItem(name, source = null) {
    const lowerName = name.toLowerCase();
    if (source) {
      const key = `${name}|${source}`.toLowerCase();
      const exact = this.items.find(
        (i) => `${i.name}|${i.source}`.toLowerCase() === key,
      );
      if (exact) return exact;
    }
    return this.items.find((i) => i.name.toLowerCase() === lowerName) || null;
  }

  getItemByName(name) {
    const lowerName = name.toLowerCase();
    return this.items.find((i) => i.name.toLowerCase() === lowerName) || null;
  }

  getSpell(name, source = null) {
    const lowerName = name.toLowerCase();
    if (source) {
      const key = `${name}|${source}`.toLowerCase();
      const exact = this.spells.find(
        (s) => `${s.name}|${s.source}`.toLowerCase() === key,
      );
      if (exact) return exact;
    }
    return this.spells.find((s) => s.name.toLowerCase() === lowerName) || null;
  }

  getSkill(name) {
    const lowerName = name.toLowerCase();
    return this.skills?.find((s) => s.name.toLowerCase() === lowerName) || null;
  }

  // Search functionality
  search(collection, query) {
    const q = query.toLowerCase();
    return this[collection].filter(
      (item) =>
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.entries &&
          JSON.stringify(item.entries).toLowerCase().includes(q)),
    );
  }
}

export const loader = new DataLoader();
export default loader;

//I forgot how to explain dis shit
