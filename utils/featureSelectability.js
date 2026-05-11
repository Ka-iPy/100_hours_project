const SELECTABLE_PATTERNS = [
  /\bchoose\s+one\s+(feature|option|benefit|maneuver|invocation|skill|language|tool|proficiency|spell|cantrip)/i,
  /\bselect\s+one\s+(feature|option|benefit|maneuver|invocation|skill|language|tool|proficiency|spell|cantrip)/i,
  /\bchoose\s+(a\s+)?(feature|option|benefit|maneuver|invocation|skill|language|tool|proficiency|spell|cantrip)\s+of\s+your\s+choice/i,
  /\bselect\s+(a\s+)?(feature|option|benefit|maneuver|invocation|skill|language|tool|proficiency|spell|cantrip)\s+of\s+your\s+choice/i,
  /\bof\s+your\s+choice.*(?:{@filter|feature|option|benefit|maneuver|invocation)/i,
  /{@filter[^}]*feature[^}]*}\s+of\s+your\s+choice/i,
  /choose\s+(one|a|your)\s+[^.]*\s+from\s+/i,
  /select\s+(one|a|your)\s+[^.]*\s+from\s+/i,
  /\byou\s+may\s+choose\b/i,
  /\byou\s+choose\b.*between\b/i,
  /\byou\s+gain\s+(?:proficiency|expertise)\s+in\s+(?:one|two|\d+)\s+(?:skill|tool|language)s?\s+of\s+your\s+choice/i,
  /\bgain\s+(?:proficiency|expertise)\s+in\s+(?:one|two|\d+)\s+(?:skill|tool|language)s?\s+of\s+your\s+choice/i,
];

const AUTO_GRANTED_PATTERNS = [
  /\byou\s+gain\b/,
  /\byou\s+have\b/,
  /\byou\s+can\b/,
  /\byou\s+know\b/,
  /\byou\s+proficient\b/,
  /\byou\s+are\s+(?:proficient|immune|resistant)/,
  /\byou\s+(?:start|begin|become)/,
  /\byour\s+\w+\s+(?:increases?|decreases?|becomes?)\b/,
  /\bwhen\s+you\s+(?:cast|hit|take|use|make|finish|start|attack)/,
  /\bstarting\s+at\s+\d+(?:st|nd|rd|th)\s+level\b/,
  /\bat\s+\d+(?:st|nd|rd|th)\s+level[,.]?\s+you\b/,
  /\byou\s+reappear\b/,
  /\bthe\s+\w+\s+(?:grants?|provides?|gives?)\b/,
  /\bcounts?\s+as\b/,
  /\bwhile\s+(?:you(?:'re|'re)|you're)\b/,
];

const SUBOPTION_PATTERNS = [
  /{@filter[^}]*}\s+of\s+your\s+choice/i,
  /choose\s+one\s+of\s+the\s+following/i,
  /select\s+(?:one|an?)\s+from\s+(?:among\s+)?the\s+(?:list|options|following)/i,
  /choose\s+(?:one|an?)\s+(?:of|from)/i,
];

export function isFeatureSelectable(name, description) {
  if (!description) return false;
  
  const lowerDesc = description.toLowerCase();
  const lowerName = name.toLowerCase();
  
  for (const pattern of SELECTABLE_PATTERNS) {
    if (pattern.test(description) || pattern.test(lowerDesc)) {
      return true;
    }
  }
  
  for (const pattern of SUBOPTION_PATTERNS) {
    if (pattern.test(description)) {
      return true;
    }
  }
  
  const hasChoiceIndicators = /\b(choice|choose|select|pick)\b/i.test(description);
  const hasOptionList = /type:\s*["']?list/i.test(description) || 
                        /(?:^|\n)\s*[-*]\s+\w/i.test(description) ||
                        /{(?:type|item)}:\s*["']?\w/i.test(description);
  
  if (hasChoiceIndicators && hasOptionList) {
    return true;
  }
  
  if (/\byou\s+(?:must\s+)?choose\b/i.test(description) && /\bfrom\b/i.test(description)) {
    return true;
  }
  
  return false;
}

export function extractAvailableOptions(description, featureName) {
  if (!description) return null;
  
  const options = [];
  
  const listItemRegex = /{@filter[^}]*feature\s+type\s*=\s*([^}|]+)[^}]*}/gi;
  let match;
  while ((match = listItemRegex.exec(description)) !== null) {
    options.push({
      type: 'filter',
      filterType: match[1],
      raw: match[0]
    });
  }
  
  const itemListRegex = /{(?:type)?["']?item["']?,\s*(?:name|nameDisplay):\s*["']?([^"']+)["']?(?:,\s*(?:entries|desc):\s*\[[^\]]*\])?}/gi;
  while ((match = itemListRegex.exec(description)) !== null) {
    options.push({
      type: 'item',
      name: match[1],
      raw: match[0]
    });
  }
  
  const listMatch = description.match(/(?:type|item)["']?\s*:\s*["']?(?:list|options)["']?/i);
  if (listMatch) {
    const parts = description.split(listMatch[0]);
    if (parts.length > 1) {
      const listSection = parts[1];
      const bulletItems = listSection.match(/^\s*[-*]\s+(.+)$/gm);
      if (bulletItems) {
        for (const item of bulletItems) {
          const cleanItem = item.replace(/^[-*]\s+/, '').trim();
          options.push({
            type: 'bullet',
            name: cleanItem,
            raw: item
          });
        }
      }
    }
  }
  
  return options.length > 0 ? options : null;
}

export function needsSubOptionSelection(description) {
  if (!description) return false;
  
  const hasList = description.includes('type":"list') || 
                  description.includes('type":"item') ||
                  description.includes('"type":"list"') ||
                  description.includes('"type":"item"');
  
  const hasFilter = /{@filter/i.test(description);
  const hasChoicePhrase = /choose\s+one\s+of\s+/i.test(description) ||
                         /select\s+one\s+of\s+/i.test(description) ||
                         /of\s+your\s+choice/i.test(description);
  
  return (hasList && hasChoicePhrase) || hasFilter;
}

export default {
  isFeatureSelectable,
  extractAvailableOptions,
  needsSubOptionSelection
};
