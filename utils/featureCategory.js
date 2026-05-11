export const FEATURE_CATEGORIES = {
  REAL_FEATURE: 'REAL_FEATURE',
  LANGUAGE: 'LANGUAGE',
  ASI: 'ASI',
  SPELLCASTING: 'SPELLCASTING',
  FIGHTING_STYLE: 'FIGHTING_STYLE',
  INSTRUCTION: 'INSTRUCTION',
  SUGGESTED: 'SUGGESTED',
  PROFICIENCY: 'PROFICIENCY',
};

const LANGUAGE_PATTERNS = [
  /^languages?$/i,
  /\byou\s+(?:can\s+)?(?:speak|read|write)\b/i,
  /\blanguages?\s+you\s+(?:can|speak|read|write)/i,
  /\bchoose\s+(?:one|two|\d+)\s+(?:extra\s+)?languages?/i,
  /language\s+of\s+your\s+choice/i,
];

const ASI_PATTERNS = [
  /^ability\s+score\s+improvement$/i,
  /^asi$/i,
  /^ability\s+score\s+increase$/i,
  /\bincrease\s+your?\s+(?:ability\s+scores?|two\s+different)/i,
  /\bincrease\s+one\s+(?:ability\s+score|ability)/i,
];

const SPELLCASTING_PATTERNS = [
  /^spellcasting$/i,
  /^pact\s+magic$/i,
  /^pact\s+casting$/i,
  /^spell\s+slots?$/i,
  /^magical\w*\s+secrets?$/i,
  /^wild\s+shape$/i,
  /^use\s+magical\w*\s+secrets?$/i,
];

const FIGHTING_STYLE_PATTERNS = [
  /^fighting\s+style$/i,
  /^fighting\s+styles?$/i,
  /\bfighting\s+style:\s*/i,
];

const INSTRUCTION_PATTERNS = [
  /^choose\s+/i,
  /^select\s+/i,
  /^pick\s+/i,
  /^at\s+\d+(?:st|nd|rd|th)\s+level/i,
  /^starting\s+at\s+\d+(?:st|nd|rd|th)\s+level/i,
  /^when\s+you\s+(?:reach|choose|select)/i,
  /\byou\s+(?:may\s+)?choose\s+(?:one|a|an)\s+(?:of\s+)?(?:the\s+)?(?:following|options?)/i,
  /\bat\s+(?:3rd|4th|etc)\s+level/i,
  /^your\s+(?:spellcasting|psionic)\s+ability\s+(?:is|uses)/i,
  /^to\s+learn\s+/i,
  /^to\s+prepare\s+/i,
  /^to\s+cast\s+/i,
];

const SUGGESTED_PATTERNS = [
  /^suggested\s+characteristics/i,
  /^suggested\s+traits/i,
  /^suggested\s+(?: идеи| идеал| прив)?/i,
  /^personality\s+traits/i,
  /^ideals/i,
  /^bonds/i,
  /^flaws/i,
  /^appearance/i,
  /^additional\s+suggestions?/i,
  /^how\s+do\s+you\s+want\s+to\s+look/i,
];

const PROFICIENCY_PATTERNS = [
  /^skill\s+proficiencies$/i,
  /^armor\s+proficiencies$/i,
  /^weapon\s+proficiencies$/i,
  /^tool\s+proficiencies$/i,
  /^saving\s+throw\s+proficiencies$/i,
  /^proficiencies?$/i,
  /\byou\s+(?:are|become)\s+proficient\s+in/i,
  /\byou\s+have\s+proficiency\s+in/i,
];

const DESCRIPTIVE_PATTERNS = [
  /^age$/i,
  /^size$/i,
  /^height$/i,
  /^weight$/i,
  /^speed$/i,
  /^alignment$/i,
  /^description$/i,
];

const FEATURE_TYPE_KEYWORDS = {
  EI: 'INVOCATION',
  AI: 'INFUSION',
  ED: 'DISCIPLINE',
  MM: 'METAMAGIC',
  'MV:B': 'MANEUVER',
  'FS:F': 'FIGHTING_STYLE',
  'FS:B': 'FIGHTING_STYLE',
  'FS:P': 'FIGHTING_STYLE',
  'FS:R': 'FIGHTING_STYLE',
  PB: 'PACT_BOON',
  RN: 'RUNE',
  OTH: 'OTHER',
};

export function categorizeFeature(name, description, source, featureData = {}) {
  const lowerName = name.toLowerCase();
  const lowerDesc = (description || '').toLowerCase();

  if (LANGUAGE_PATTERNS.some(p => p.test(lowerName) || p.test(lowerDesc))) {
    return FEATURE_CATEGORIES.LANGUAGE;
  }

  if (ASI_PATTERNS.some(p => p.test(lowerName) || p.test(lowerDesc))) {
    return FEATURE_CATEGORIES.ASI;
  }

  if (SPELLCASTING_PATTERNS.some(p => p.test(lowerName) || p.test(lowerDesc))) {
    return FEATURE_CATEGORIES.SPELLCASTING;
  }

  if (FIGHTING_STYLE_PATTERNS.some(p => p.test(lowerName) || p.test(lowerDesc))) {
    return FEATURE_CATEGORIES.FIGHTING_STYLE;
  }

  if (SUGGESTED_PATTERNS.some(p => p.test(lowerName))) {
    return FEATURE_CATEGORIES.SUGGESTED;
  }

  if (PROFICIENCY_PATTERNS.some(p => p.test(lowerName) || p.test(lowerDesc))) {
    return FEATURE_CATEGORIES.PROFICIENCY;
  }

  if (DESCRIPTIVE_PATTERNS.some(p => p.test(lowerName))) {
    return FEATURE_CATEGORIES.INSTRUCTION;
  }

  if (featureData.featureType && Array.isArray(featureData.featureType)) {
    for (const ft of featureData.featureType) {
      if (FEATURE_TYPE_KEYWORDS[ft]) {
        return FEATURE_CATEGORIES.REAL_FEATURE;
      }
    }
  }

  if (INSTRUCTION_PATTERNS.some(p => p.test(lowerName) || p.test(lowerDesc))) {
    const hasActualContent = description && description.length > 50 && 
      !/choose\s+(?:one|a)\s+(?:of\s+)?(?:the\s+)?(?:following|options?)/i.test(lowerDesc);
    if (!hasActualContent) {
      return FEATURE_CATEGORIES.INSTRUCTION;
    }
  }

  if (/choose one feature|choose your|from the list/i.test(lowerDesc)) {
    const isInstructionOnly = !description || description.length < 100;
    if (isInstructionOnly) {
      return FEATURE_CATEGORIES.INSTRUCTION;
    }
  }

  return FEATURE_CATEGORIES.REAL_FEATURE;
}

export function isRealFeature(category) {
  return category === FEATURE_CATEGORIES.REAL_FEATURE;
}

export function getCategoryLabel(category) {
  const labels = {
    [FEATURE_CATEGORIES.REAL_FEATURE]: 'Feature',
    [FEATURE_CATEGORIES.LANGUAGE]: 'Language',
    [FEATURE_CATEGORIES.ASI]: 'ASI',
    [FEATURE_CATEGORIES.SPELLCASTING]: 'Spellcasting',
    [FEATURE_CATEGORIES.FIGHTING_STYLE]: 'Fighting Style',
    [FEATURE_CATEGORIES.INSTRUCTION]: 'Instruction',
    [FEATURE_CATEGORIES.SUGGESTED]: 'Suggested',
    [FEATURE_CATEGORIES.PROFICIENCY]: 'Proficiency',
  };
  return labels[category] || 'Feature';
}

export default {
  FEATURE_CATEGORIES,
  categorizeFeature,
  isRealFeature,
  getCategoryLabel,
};
