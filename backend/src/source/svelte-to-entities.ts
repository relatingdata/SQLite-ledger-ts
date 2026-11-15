// Turns a .svelte file into a tree of source nodes, and writes that tree
// into the entities under Application/Source.
//
// The tree is structural: elements with their tag and attributes, text,
// {expressions}, block tags ({#if …}, {:else}, {/if}), script statements,
// style rules and declarations. Whatever lies between two parts in the
// original file (whitespace, punctuation, comments) is kept exactly, as a
// Text node or as one of a node's own relations, so that emitting the tree
// gives back the file byte for byte. The emitter that writes files from the
// entities is the LFE program in source_compiler/; `emitTree` below is a
// reference used to check this converter on its own.

import { parse } from 'svelte/compiler';
import { generateNKeysBetween } from 'fractional-indexing';
import type { Core } from '../core/core.js';

export interface SourceNode {
  kind: string;
  rel: Record<string, string>;
  children: SourceNode[];
}

interface Span {
  start: number;
  end: number;
  type: string;
  [key: string]: any;
}

const ELEMENTS = new Set([
  'RegularElement', 'Component', 'TitleElement', 'SlotElement', 'SvelteElement', 'SvelteHead', 'SvelteBody',
  'SvelteWindow', 'SvelteDocument', 'SvelteComponent', 'SvelteSelf', 'SvelteFragment', 'SvelteBoundary',
]);
const TAGS = new Set(['ExpressionTag', 'HtmlTag', 'ConstTag', 'DebugTag', 'RenderTag', 'AttachTag']);
const BLOCKS: Record<string, string> = { IfBlock: 'if', EachBlock: 'each', AwaitBlock: 'await', KeyBlock: 'key', SnippetBlock: 'snippet' };

function node(kind: string, rel: Record<string, string | undefined> = {}, children: SourceNode[] = []): SourceNode {
  const kept: Record<string, string> = {};
  for (const [k, v] of Object.entries(rel)) if (v !== undefined) kept[k] = v;
  return { kind, rel: kept, children };
}

class Converter {
  constructor(private src: string) {}

  slice(a: number, b: number): string {
    return this.src.slice(a, b);
  }

  /** The parts of [lo, hi) in order: each item converted, and whatever lies
   * between them kept as a node of `gapKind` holding the raw text. */
  seq(lo: number, hi: number, items: Span[], convert: (s: Span) => SourceNode, gapKind = 'Text'): SourceNode[] {
    const out: SourceNode[] = [];
    let at = lo;
    for (const item of [...items].sort((a, b) => a.start - b.start)) {
      if (item.start < at) throw new Error(`Overlapping parts at ${item.start}.`);
      if (item.start > at) out.push(this.gap(gapKind, this.slice(at, item.start)));
      out.push(convert(item));
      at = item.end;
    }
    if (at < hi) out.push(this.gap(gapKind, this.slice(at, hi)));
    return out;
  }

  gap(kind: string, text: string): SourceNode {
    return kind === 'Block Tag' ? node(kind, { Code: text }) : node(kind, { Raw: text });
  }

  file(): SourceNode {
    const ast: any = parse(this.src, { modern: true });
    const items: Span[] = [...ast.fragment.nodes];
    if (ast.instance) items.push(ast.instance);
    if (ast.module) items.push(ast.module);
    if (ast.css) items.push(ast.css);
    if (ast.options) items.push({ ...ast.options, type: 'SvelteOptions' });
    return node('File', {}, this.seq(0, this.src.length, items, (s) => this.part(s)));
  }

  part(s: Span): SourceNode {
    if (s.type === 'Text' || s.type === 'Comment') return node(s.type, { Raw: this.slice(s.start, s.end) });
    if (TAGS.has(s.type)) {
      const raw = this.slice(s.start, s.end);
      if (!raw.startsWith('{') || !raw.endsWith('}')) throw new Error(`Unexpected ${s.type} at ${s.start}.`);
      return node('Expression', { Code: raw.slice(1, -1) });
    }
    if (ELEMENTS.has(s.type) || s.type === 'SvelteOptions') return this.element(s, s.name, s.attributes, s.fragment?.nodes ?? []);
    if (s.type in BLOCKS) return this.block(s);
    if (s.type === 'Script') return this.script(s);
    if (s.type === 'StyleSheet') return this.style(s);
    throw new Error(`No conversion for ${s.type} at ${s.start}.`);
  }

  /** `<tag attr…>content</tag>`, `<tag … />` or a void `<tag …>`. */
  element(s: Span, name: string, attributes: Span[], content: Span[], contentSpan?: [number, number]): SourceNode {
    if (this.slice(s.start, s.start + 1 + name.length) !== '<' + name) throw new Error(`Element ${name} at ${s.start} does not start with its tag.`);
    const { attrs, at } = this.attributes(s.start + 1 + name.length, attributes);
    const close = this.src.indexOf('>', at);
    const tagEnd = this.slice(at, close);
    const closing = `</${name}>`;
    const closed = this.slice(s.end - closing.length, s.end) === closing && s.end - closing.length > close;
    const [lo, hi] = contentSpan ?? [close + 1, closed ? s.end - closing.length : s.end];
    const children = this.seq(lo, hi, content, (c) => this.part(c));
    return node('Element', { Tag: name, 'Tag End': tagEnd || undefined, Closed: closed ? 'yes' : undefined }, [...attrs, ...children]);
  }

  attributes(from: number, attributes: Span[]): { attrs: SourceNode[]; at: number } {
    const attrs: SourceNode[] = [];
    let at = from;
    for (const a of [...attributes].sort((x, y) => x.start - y.start)) {
      const space = this.slice(at, a.start);
      attrs.push(this.attribute(a, space));
      at = a.end;
    }
    return { attrs, at };
  }

  attribute(a: Span, space: string): SourceNode {
    const raw = this.slice(a.start, a.end);
    const Space = space === ' ' ? undefined : space;
    if (raw.startsWith('{')) return node('Attribute', { Space, Shorthand: 'yes', Code: raw.slice(1, -1) });
    const eq = raw.indexOf('=');
    if (eq < 0) return node('Attribute', { Space, Name: raw });
    const value = raw.slice(eq + 1);
    const quote = value[0] === '"' || value[0] === "'" ? value[0] : '';
    const lo = a.start + eq + 1 + quote.length;
    const hi = a.end - quote.length;
    const parts = this.slice(lo, hi);
    const expressions: Span[] = [];
    if (a.type === 'Attribute') {
      const values = Array.isArray(a.value) ? a.value : a.value === true ? [] : [a.value];
      for (const v of values) if (v.type === 'ExpressionTag') expressions.push(v);
    } else if (a.expression) {
      const open = this.src.lastIndexOf('{', a.expression.start);
      const shut = this.src.indexOf('}', a.expression.end);
      if (open >= lo && shut < hi) expressions.push({ type: 'Brace', start: open, end: shut + 1 });
    }
    const children = this.seq(lo, hi, expressions, (e) => node('Expression', { Code: this.slice(e.start + 1, e.end - 1) }));
    if (children.map((c) => (c.kind === 'Text' ? c.rel.Raw : `{${c.rel.Code}}`)).join('') !== parts) {
      throw new Error(`Attribute at ${a.start} did not split cleanly.`);
    }
    return node('Attribute', { Space, Name: raw.slice(0, eq), Assign: 'yes', Quote: quote || undefined }, children);
  }

  block(s: Span): SourceNode {
    const content: Span[] = [];
    const add = (f: any) => {
      if (f?.nodes) content.push(...f.nodes);
    };
    if (s.type === 'IfBlock') (add(s.consequent), add(s.alternate));
    else if (s.type === 'EachBlock') (add(s.body), add(s.fallback));
    else if (s.type === 'AwaitBlock') (add(s.pending), add(s.then), add(s.catch));
    else if (s.type === 'KeyBlock') add(s.fragment);
    else add(s.body);
    return node('Block', { Form: BLOCKS[s.type] }, this.seq(s.start, s.end, content, (c) => this.part(c), 'Block Tag'));
  }

  script(s: Span): SourceNode {
    const { attrs, at } = this.attributes(s.start + '<script'.length, s.attributes);
    const close = this.src.indexOf('>', at);
    const lo = close + 1;
    const hi = s.end - '</script>'.length;
    if (this.slice(hi, s.end) !== '</script>') throw new Error(`Script at ${s.start} does not end with </script>.`);
    const statements: SourceNode[] = [];
    let prev = lo;
    for (const st of s.content.body as Span[]) {
      statements.push(node('Statement', { Code: this.slice(prev, st.end) }));
      prev = st.end;
    }
    if (prev < hi) statements.push(node('Text', { Raw: this.slice(prev, hi) }));
    return node('Script', { Tag: 'script', 'Tag End': this.slice(at, close) || undefined }, [...attrs, ...statements]);
  }

  style(s: Span): SourceNode {
    const { attrs, at } = this.attributes(s.start + '<style'.length, s.attributes);
    const close = this.src.indexOf('>', at);
    const hi = s.end - '</style>'.length;
    if (this.slice(hi, s.end) !== '</style>') throw new Error(`Style at ${s.start} does not end with </style>.`);
    const rules = this.seq(close + 1, hi, s.children, (r) => this.css(r));
    return node('Style', { Tag: 'style', 'Tag End': this.slice(at, close) || undefined }, [...attrs, ...rules]);
  }

  cssBlock(b: Span): SourceNode[] {
    if (this.src[b.start] !== '{' || this.src[b.end - 1] !== '}') throw new Error(`CSS block at ${b.start} is not in braces.`);
    return this.seq(b.start + 1, b.end - 1, b.children, (c) => this.css(c));
  }

  css(r: Span): SourceNode {
    if (r.type === 'Rule') {
      if (r.block.end !== r.end) throw new Error(`Rule at ${r.start} ends after its block.`);
      return node(
        'Rule',
        { Selector: this.slice(r.prelude.start, r.prelude.end), Before: this.slice(r.prelude.end, r.block.start) || undefined },
        this.cssBlock(r.block)
      );
    }
    if (r.type === 'Atrule') {
      const head = this.slice(r.start, r.block ? r.block.start : r.end);
      return node('At Rule', { Head: head, Braced: r.block ? 'yes' : undefined }, r.block ? this.cssBlock(r.block) : []);
    }
    if (r.type === 'Declaration') {
      const raw = this.slice(r.start, r.end);
      const rest = raw.slice(r.property.length);
      if (raw.startsWith(r.property) && rest.endsWith(r.value)) {
        return node('Declaration', { Property: r.property, Separator: rest.slice(0, rest.length - r.value.length), Value: r.value });
      }
      return node('Declaration', { Raw: raw });
    }
    throw new Error(`No CSS conversion for ${r.type} at ${r.start}.`);
  }
}

export function svelteToTree(src: string): SourceNode {
  return new Converter(src).file();
}

/** The reference emitter: a tree back to text. The LFE emitter in
 * source_compiler/ does the same from the entities. */
export function emitTree(n: SourceNode): string {
  const r = n.rel;
  const all = () => n.children.map(emitTree).join('');
  const attrs = () => n.children.filter((c) => c.kind === 'Attribute').map(emitTree).join('');
  const content = () => n.children.filter((c) => c.kind !== 'Attribute').map(emitTree).join('');
  switch (n.kind) {
    case 'File':
    case 'Block':
      return all();
    case 'Text':
    case 'Comment':
      return r.Raw;
    case 'Expression':
      return `{${r.Code}}`;
    case 'Block Tag':
    case 'Statement':
      return r.Code;
    case 'Element':
      return `<${r.Tag}${attrs()}${r['Tag End'] ?? ''}>${content()}${r.Closed ? `</${r.Tag}>` : ''}`;
    case 'Script':
    case 'Style':
      return `<${r.Tag}${attrs()}${r['Tag End'] ?? ''}>${content()}</${r.Tag}>`;
    case 'Attribute':
      if (r.Shorthand) return `${r.Space ?? ' '}{${r.Code}}`;
      return `${r.Space ?? ' '}${r.Name}${r.Assign ? `=${r.Quote ?? ''}${all()}${r.Quote ?? ''}` : ''}`;
    case 'Rule':
      return `${r.Selector}${r.Before ?? ''}{${all()}}`;
    case 'At Rule':
      return r.Braced ? `${r.Head}{${all()}}` : r.Head;
    case 'Declaration':
      return r.Raw ?? `${r.Property}${r.Separator}${r.Value}`;
  }
  throw new Error(`No emitter for ${n.kind}.`);
}

/** Writes a tree under `parent`, each child named by an order key. */
export function writeTree(core: Core, parent: number, name: string, tree: SourceNode, by: number): number {
  const made = core.thing(name, parent, tree.kind, by);
  for (const [relation, value] of Object.entries(tree.rel)) core.relate(made.id, relation, value, by);
  const keys = tree.children.length > 0 ? generateNKeysBetween(null, null, tree.children.length) : [];
  tree.children.forEach((child, i) => writeTree(core, made.id, keys[i], child, by));
  return made.id;
}
