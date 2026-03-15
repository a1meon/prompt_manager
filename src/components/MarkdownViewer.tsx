import React, { useMemo } from 'react';
import { cn, markdownToHtml } from '../utils';

type MarkdownViewerProps = {
  markdown: string;
  className?: string;
};

export function MarkdownViewer({ markdown, className }: MarkdownViewerProps) {
  const html = useMemo(() => markdownToHtml(markdown ?? ''), [markdown]);
  return <div className={cn('md-render', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

