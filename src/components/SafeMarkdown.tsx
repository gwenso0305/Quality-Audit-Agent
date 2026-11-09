import React, { useMemo } from 'react';
import { marked } from 'marked';

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
      return marked.parse(escaped, { async: false, breaks: true }) as string;
    } catch (err) {
      console.warn('Markdown parsing failed:', err);
      return `<p>${escaped}</p>`;
    }
  }, [content]);

  return (
    <div
      className={`prose prose-slate max-w-none text-sm leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};
