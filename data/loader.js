import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  }

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
        this.feats = featsData.feat || [];
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
          .filter((f) => f.endsWith(".json"));
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
      this.isLoaded = true;
      console.log("Data loaded and relationships mapped.");
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
        const key = `${sr.name}|${raceName}|${raceSource}`.toLowerCase();
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
    if (this.subrace) {
      return this.subraces.find(
        (sr) =>
          `${sr.name}|${sr.source}`.toLowerCase() ===
          `${name}|${source}`.toLowerCase() || sr.name.toLowerCase() === key,
      );
    }
    return null;
  }

  getBackground(name, source = "PHB") {
    const key = `${name}|${source}`.toLowerCase();
    return (
      this.backgrounds.find(
        (b) =>
          `${b.name}|${b.source}`.toLowerCase() === key ||
          b.name.toLowerCase() === name.toLowerCase(),
      ) || null
    );
  }

  getClass(name, source = "PHB") {
    const key = `${name}|${source}`.toLowerCase();
    return (
      this.classes.find(
        (c) =>
          `${c.name}|${c.source}`.toLowerCase() === key ||
          c.name.toLowerCase() === name.toLowerCase(),
      ) || null
    );
  }

  getSubclass(className, subclassName, source = "PHB") {
    return (
      this.subclasses.find(
        (sc) =>
          sc.className?.toLowerCase() === className.toLowerCase() &&
          (sc.name?.toLowerCase() === subclassName.toLowerCase() ||
            sc.subclassShortName?.toLowerCase() ===
            subclassName.toLowerCase()) &&
          sc.source?.toLowerCase() === source.toLowerCase(),
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
    const ccPath = path.join(this.dataDir, "charcreationoptions.json");
    if (fs.existsSync(ccPath)) {
      const data = JSON.parse(fs.readFileSync(ccPath, "utf8"));
      return data.charoption || [];
    }
    return [];
  }

  getClassFeaturesUpToLevel(className, classSource, maxLevel) {
    const features = this.classFeatures.filter(
      (f) =>
        f.className?.toLowerCase() === className.toLowerCase() &&
        f.classSource?.toLowerCase() === classSource.toLowerCase() &&
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
        f.source?.toLowerCase() === subclassSource.toLowerCase() &&
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
