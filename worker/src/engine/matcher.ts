import { Box, NormalizedDomNode, NormalizedFigmaNode } from '../shared/types';
import { area, centerDistance, contains, iou } from './geometry';

export interface NodeMatch {
  figma: NormalizedFigmaNode;
  dom: NormalizedDomNode;
  confidence: number;
  pass: 1 | 2 | 3;
}

const CONTAINER_TAGS = new Set(['div', 'section', 'header', 'nav', 'button', 'a', 'article', 'li', 'main', 'footer', 'aside', 'ul', 'ol', 'form', 'span', 'label']);
const CONTAINER_TYPES = new Set(['FRAME', 'INSTANCE', 'COMPONENT', 'COMPONENT_SET', 'GROUP', 'SECTION']);
const IOU_THRESHOLD = 0.7;
const SHARED_IOU_THRESHOLD = 0.5;

const unionBox = (boxes: Box[]): Box | null =>
  boxes.length
    ? (() => {
        const x = Math.min(...boxes.map((b) => b.x));
        const y = Math.min(...boxes.map((b) => b.y));
        const r = Math.max(...boxes.map((b) => b.x + b.width));
        const btm = Math.max(...boxes.map((b) => b.y + b.height));
        return { x, y, width: r - x, height: btm - y };
      })()
    : null;

const norm = (s: string | null | undefined): string => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

const pickClosest = <T extends NormalizedDomNode>(target: NormalizedFigmaNode, candidates: T[]): T | undefined =>
  candidates
    .map((c) => ({ c, d: centerDistance(target.relativeBox, c.box), a: area(c.box) }))
    .sort((p, q) => p.d - q.d || p.a - q.a)[0]?.c;

export function matchNodes(figmaNodes: NormalizedFigmaNode[], domNodes: NormalizedDomNode[]): Map<string, NodeMatch> {
  const matches = new Map<string, NodeMatch>();
  const claimed = new Map<string, string>();
  const sharedWithContainer = new Set<string>();
  const claim = (figma: NormalizedFigmaNode, dom: NormalizedDomNode | undefined, confidence: number, pass: 1 | 2 | 3, allowShared = false): void => {
    const available = dom && (!claimed.has(dom.uid) || (allowShared && !sharedWithContainer.has(dom.uid)));
    available &&
      !matches.has(figma.id) &&
      (claimed.has(dom.uid) && sharedWithContainer.add(dom.uid), claimed.set(dom.uid, figma.id), matches.set(figma.id, { figma, dom, confidence, pass }));
  };
  const free = (): NormalizedDomNode[] => domNodes.filter((d) => !claimed.has(d.uid));

  const byFigmaAttr = new Map<string, NormalizedDomNode>();
  domNodes.forEach((d) => d.figmaIdAttr && !byFigmaAttr.has(d.figmaIdAttr) && byFigmaAttr.set(d.figmaIdAttr, d));
  figmaNodes.forEach((f) => claim(f, byFigmaAttr.get(f.id) ?? byFigmaAttr.get(f.id.replace(/:/g, '-')), 1.0, 1));

  figmaNodes
    .filter((f) => f.type === 'TEXT' && norm(f.text) && !matches.has(f.id))
    .forEach((f) => {
      const t = norm(f.text);
      const pool = free();
      const direct = pool.filter((d) => norm(d.text) === t);
      const viaFull = pool.filter((d) => norm(d.fullText) === t);
      claim(f, pickClosest(f, direct.length ? direct : viaFull), 0.9, 2);
    });

  const byId = new Map(figmaNodes.map((f) => [f.id, f]));
  const depthOf = (f: NormalizedFigmaNode): number => {
    let depth = 0;
    let cur = f.parentId ? byId.get(f.parentId) : undefined;
    while (cur) {
      depth += 1;
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return depth;
  };
  const descendantsOf = (f: NormalizedFigmaNode): NormalizedFigmaNode[] =>
    f.childrenIds.flatMap((id) => {
      const c = byId.get(id);
      return c ? [c, ...descendantsOf(c)] : [];
    });
  const hasPadding = (f: NormalizedFigmaNode): boolean => f.padding.top + f.padding.right + f.padding.bottom + f.padding.left > 0;

  figmaNodes
    .filter((f) => CONTAINER_TYPES.has(f.type) && (hasPadding(f) || f.childrenIds.length > 1 || f.layoutMode !== 'NONE') && !matches.has(f.id))
    .map((f) => ({ f, depth: depthOf(f) }))
    .sort((a, b) => b.depth - a.depth)
    .forEach(({ f }) => {
      const matchedDesc = descendantsOf(f)
        .map((c) => matches.get(c.id))
        .filter((m): m is NodeMatch => Boolean(m));
      const childBoxes = matchedDesc.map((m) => m.dom.box);
      const figmaUnion = unionBox(matchedDesc.map((m) => m.figma.relativeBox));
      const domUnion = unionBox(childBoxes);
      const shift = figmaUnion && domUnion
        ? { dx: domUnion.x + domUnion.width / 2 - (figmaUnion.x + figmaUnion.width / 2), dy: domUnion.y + domUnion.height / 2 - (figmaUnion.y + figmaUnion.height / 2) }
        : { dx: 0, dy: 0 };
      const anchored = { ...f.relativeBox, x: f.relativeBox.x + shift.dx, y: f.relativeBox.y + shift.dy };
      const descendantIds = new Set(descendantsOf(f).filter((c) => c.type === 'TEXT').map((c) => c.id));
      const pool = domNodes.filter((d) => !claimed.has(d.uid) || (descendantIds.has(claimed.get(d.uid) ?? '') && !sharedWithContainer.has(d.uid)));
      const best = pool
        .filter((d) => CONTAINER_TAGS.has(d.tag))
        .map((d) => ({ d, score: Math.max(iou(f.relativeBox, d.box), iou(anchored, d.box)), a: area(d.box) }))
        .filter((x) => x.score >= (claimed.has(x.d.uid) ? SHARED_IOU_THRESHOLD : IOU_THRESHOLD) && childBoxes.every((cb) => contains(x.d.box, cb)))
        .sort((p, q) => q.score - p.score || p.a - q.a)[0];
      claim(f, best?.d, 0.8, 3, true);
    });

  return matches;
}
