/**
 * Global Obsidian Minimalist Markdown & 5e Syntax Renderer
 */

function clean5eTags(str) {
  if (typeof str !== 'string') return str || '';
  return str.replace(/\{@([a-zA-Z0-9_:]+)\s+([^}]+)\}/g, (raw, tag, content) => {
    const parts = content.split('|');
    const label = parts[0] ? parts[0].trim() : raw;
    const tagName = tag.toLowerCase();

    if (tagName === 'dc') return `<span class="md-badge md-badge-dc">DC ${label}</span>`;
    if (tagName === 'chance') return `<span class="md-badge md-badge-chance">${label}%</span>`;
    if (tagName === 'dice' || tagName === 'damage') return `<code class="md-dice">${label}</code>`;
    if (tagName === 'bold' || tagName === 'b') return `<strong>${label}</strong>`;
    if (tagName === 'italic' || tagName === 'i') return `<em>${label}</em>`;
    if (tagName === 'spell') return `<span class="md-tag md-tag-spell">✨ ${label}</span>`;
    if (tagName === 'item') return `<span class="md-tag md-tag-item">⚔️ ${label}</span>`;
    if (tagName === 'condition') return `<span class="md-tag md-tag-condition">💫 ${label}</span>`;
    if (tagName === 'skill') return `<span class="md-tag md-tag-skill">🎯 ${label}</span>`;
    if (tagName === 'variantrule' || tagName === 'action' || tagName === 'status') return `<span class="md-tag md-tag-rule">${label}</span>`;
    
    // For any 5etools tag with display text override (e.g. {@tag foo|source|display text})
    if (parts.length >= 3 && parts[2].trim() && !parts[2].includes('=')) return parts[2].trim();
    return label;
  });
}

function renderMarkdown(str) {
  if (!str || typeof str !== 'string') return '';
  
  // First clean 5e tags
  let text = clean5eTags(str);

  // Normalize line breaks
  text = text.replace(/\r\n/g, '\n');

  // Handle Obsidian Callouts: > [!NOTE] Title
  text = text.replace(/^>\s*\[!([A-Z]+)\]\s*(.*)$/gm, (match, type, title) => {
    const calloutType = type.toLowerCase();
    const displayTitle = title ? title.trim() : (type.charAt(0).toUpperCase() + type.slice(1).toLowerCase());
    return `<div class="obsidian-callout callout-${calloutType}"><div class="callout-title"><span class="callout-icon">📌</span> ${displayTitle}</div><div class="callout-content">`;
  });

  // Close callout divs if line doesn't start with >
  const lines = text.split('\n');
  let inCallout = false;
  let formattedLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.startsWith('<div class="obsidian-callout')) {
      inCallout = true;
      formattedLines.push(line);
      continue;
    }

    if (inCallout) {
      if (line.startsWith('>')) {
        line = line.replace(/^>\s?/, '');
      } else if (line.trim() === '') {
        // preserve inside callout
      } else {
        formattedLines.push('</div></div>');
        inCallout = false;
      }
    }

    // Standard blockquote: > Text
    if (!inCallout && line.startsWith('>')) {
      const bqText = line.replace(/^>\s?/, '');
      formattedLines.push(`<blockquote>${bqText}</blockquote>`);
      continue;
    }

    formattedLines.push(line);
  }
  if (inCallout) {
    formattedLines.push('</div></div>');
  }

  text = formattedLines.join('\n');

  // Headings (H1 to H6) - Render clean without hashtags
  text = text.replace(/^######\s+(.*$)/gm, '<h6 class="md-h6">$1</h6>');
  text = text.replace(/^#####\s+(.*$)/gm, '<h5 class="md-h5">$1</h5>');
  text = text.replace(/^####\s+(.*$)/gm, '<h4 class="md-h4">$1</h4>');
  text = text.replace(/^###\s+(.*$)/gm, '<h3 class="md-h3">$1</h3>');
  text = text.replace(/^##\s+(.*$)/gm, '<h2 class="md-h2">$1</h2>');
  text = text.replace(/^#\s+(.*$)/gm, '<h1 class="md-h1">$1</h1>');

  // Bold & Italic combinations (***text*** or ___text___)
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>');

  // Bold (**text** or __text__)
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // Italic (*text* or _text_)
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Strikethrough (~~text~~)
  text = text.replace(/~~(.*?)~~/g, '<del>$1</del>');

  // Code (`code`)
  text = text.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');

  // Obsidian Tag Pills (#tag-name)
  text = text.replace(/(^|\s)#([a-zA-Z0-9_\-\/]+)/g, '$1<span class="obsidian-tag">#$2</span>');

  // Unordered list items (- item or * item)
  text = text.replace(/^\s*[\-\*]\s+(.*$)/gm, '<li class="md-li">$1</li>');

  // Wrap contiguous <li> into <ul>
  text = text.replace(/(<li class="md-li">.*<\/li>\s*)+/g, (match) => {
    return `<ul class="md-ul">${match}</ul>`;
  });

  // Paragraph formatting (double linebreaks)
  const paragraphs = text.split(/\n{2,}/);
  text = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<ol') || p.startsWith('<div') || p.startsWith('<blockquote')) {
      return p;
    }
    return `<p class="md-p">${p.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return text;
}

// Make clean5eTags and renderMarkdown globally available
window.clean5eTags = clean5eTags;
window.renderMarkdown = renderMarkdown;

// Auto-render elements with [data-render-md] on page load
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-render-md]').forEach(el => {
    const rawText = el.getAttribute('data-raw-text') || el.innerText || el.textContent;
    if (rawText) {
      el.innerHTML = renderMarkdown(rawText);
    }
  });
});
