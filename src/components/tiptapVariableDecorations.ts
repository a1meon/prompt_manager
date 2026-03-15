import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

const VARIABLE_TOKEN_REGEX = /\{([^{}]+)\}/g;
const VARIABLE_COLOR_COUNT = 8;

function hashToIndex(input: string, modulo: number) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return modulo === 0 ? 0 : hash % modulo;
}

function buildDecorations(doc: any, selectionFrom: number, selectionTo: number) {
  const decorations: Decoration[] = [];
  const selStart = Math.min(selectionFrom, selectionTo);
  const selEnd = Math.max(selectionFrom, selectionTo);
  const isCollapsed = selStart === selEnd;

  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    const text = String(node.text ?? '');
    VARIABLE_TOKEN_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = VARIABLE_TOKEN_REGEX.exec(text)) !== null) {
      const full = match[0];
      const inner = match[1] ?? '';
      const from = pos + match.index;
      const to = from + full.length;
      const normalized = String(inner).trim().toLowerCase();
      const colorIndex = hashToIndex(normalized, VARIABLE_COLOR_COUNT);
      const isActive = isCollapsed
        ? selStart > from && selStart < to
        : selStart >= from && selEnd <= to;

      decorations.push(
        Decoration.inline(from, to, { class: `var-token var-token-${colorIndex}${isActive ? ' var-active' : ''}` })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

const variableDecorationsKey = new PluginKey('variableDecorations');

export const VariableDecorations = Extension.create({
  name: 'variableDecorations',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: variableDecorationsKey,
        state: {
          init: (_config, state) => buildDecorations(state.doc, state.selection.from, state.selection.to),
          apply: (tr, old) => {
            if (!tr.docChanged && !tr.selectionSet) return old;
            return buildDecorations(tr.doc, tr.selection.from, tr.selection.to);
          }
        },
        props: {
          decorations: (state) => variableDecorationsKey.getState(state)
        }
      })
    ];
  }
});
