import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Register hook once at module level to add target="_blank" and rel="noopener noreferrer" to all remaining <a> tags
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

export const SafeMarkdown: React.FC<SafeMarkdownProps> = ({ content, className = '' }) => {
  const sanitizedHtml = useMemo(() => {
    if (!content) return '';

    // Strip or escape dangerous raw HTML tags before parsing markdown
    const escaped = content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    try {
      // marked parses markdown cleanly into formatted tags
      const rawHtml = marked.parse(escaped, { async: false, breaks: true }) as string;
      return DOMPurify.sanitize(rawHtml);
    } catch (err) {
      console.warn('Markdown parsing failed:', err);
      return DOMPurify.sanitize(`<p>${escaped}</p>`);
    }
  }, [content]);

  return (
    <div
      className={`prose prose-slate max-w-none text-sm leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

