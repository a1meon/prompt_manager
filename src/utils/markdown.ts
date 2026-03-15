import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';

const VARIABLE_TOKEN_REGEX = /\{([^{}]+)\}/g;
const VARIABLE_COLOR_COUNT = 8;

function hashToIndex(input: string, modulo: number) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return modulo === 0 ? 0 : hash % modulo;
}

function variableTokenPlugin(md: MarkdownIt) {
  md.core.ruler.after('inline', 'var_tokens', (state) => {
    const TokenCtor = (state as any).Token;
    for (const blockToken of state.tokens) {
      if (blockToken.type !== 'inline' || !blockToken.children) continue;
      const children = blockToken.children;
      const nextChildren: any[] = [];

      for (const t of children) {
        if (t.type !== 'text') {
          nextChildren.push(t);
          continue;
        }

        const text = t.content ?? '';
        VARIABLE_TOKEN_REGEX.lastIndex = 0;
        let last = 0;
        let match: RegExpExecArray | null;

        while ((match = VARIABLE_TOKEN_REGEX.exec(text)) !== null) {
          const full = match[0];
          const inner = match[1] ?? '';
          const start = match.index;
          const end = start + full.length;

          if (start > last) {
            const textToken = new TokenCtor('text', '', 0);
            textToken.content = text.slice(last, start);
            nextChildren.push(textToken);
          }

          const varToken = new TokenCtor('var_token', '', 0);
          varToken.content = full;
          varToken.meta = { name: inner };
          nextChildren.push(varToken);

          last = end;
        }

        if (last < text.length) {
          const textToken = new TokenCtor('text', '', 0);
          textToken.content = text.slice(last);
          nextChildren.push(textToken);
        }
      }

      blockToken.children = nextChildren;
    }
  });

  md.renderer.rules.var_token = (tokens, idx) => {
    const token = tokens[idx];
    const inner = (token?.meta as any)?.name ?? '';
    const normalized = String(inner).trim().toLowerCase();
    const colorIndex = hashToIndex(normalized, VARIABLE_COLOR_COUNT);
    const nameEscaped = md.utils.escapeHtml(String(inner));
    return `<span class="var-token var-token-${colorIndex}"><span class="var-name">${nameEscaped}</span></span>`;
  };
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
}).use(variableTokenPlugin);

export function markdownToHtml(markdown: string): string {
  const raw = md.render(markdown ?? '');
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true }
  });
}

export function markdownToPlainText(markdown: string): string {
  const html = markdownToHtml(markdown);
  const el = document.createElement('div');
  el.innerHTML = html;
  const text = (el as any).innerText ?? el.textContent ?? '';
  return String(text).replace(/\r/g, '').trimEnd();
}
