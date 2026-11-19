import { NormalizedFigmaNode, Typography } from '../shared/types';
import { fail } from '../errors';

const FIGMA_API = process.env.FIGMA_API_BASE ?? 'https://api.figma.com';

interface FigmaRawNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  characters?: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  itemSpacing?: number;
  layoutMode?: string;
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    lineHeightPx?: number;
    letterSpacing?: number;
  };
  children?: FigmaRawNode[];
}

const statusMessages: Record<number, () => never> = {
  400: () => fail(400, 'Figma rejected the request. Check the file key and node-id.'),
  401: () => fail(401, 'Invalid or expired Figma Personal Access Token.'),
  403: () => fail(401, 'Invalid or expired Figma Personal Access Token, or no access to this file.'),
  404: () => fail(400, 'Figma file or node not found.'),
  429: () => fail(429, 'Figma API rate limit reached. Try again in a minute.'),
};

export async function fetchFigmaRoot(fileKey: string, nodeId: string, token: string): Promise<FigmaRawNode> {
  String(token ?? '').trim() || fail(401, 'Missing Figma Personal Access Token.');
  const res = await fetch(`${FIGMA_API}/v1/files/${encodeURIComponent(fileKey)}/nodes?ids=${encodeURIComponent(nodeId)}`, {
    headers: { 'X-Figma-Token': token.trim() },
  }).catch(() => fail(502, 'Could not reach the Figma API.'));
  res.ok || (statusMessages[res.status] ?? (() => fail(502, `Figma API error ${res.status}`)))();
  const json = (await res.json()) as { nodes?: Record<string, { document?: FigmaRawNode } | null> };
  return json.nodes?.[nodeId]?.document ?? fail(400, `Node ${nodeId} was not found in the Figma file.`);
}

const toLayoutMode = (mode?: string): NormalizedFigmaNode['layoutMode'] =>
  mode === 'HORIZONTAL' || mode === 'VERTICAL' ? mode : 'NONE';

const toTypography = (node: FigmaRawNode): Typography | null =>
  node.type === 'TEXT' && node.style
    ? {
        fontFamily: node.style.fontFamily ?? '',
        fontSize: node.style.fontSize ?? 0,
        fontWeight: node.style.fontWeight ?? 400,
        lineHeightPx: node.style.lineHeightPx ?? (node.style.fontSize ?? 0) * 1.2,
        letterSpacing: node.style.letterSpacing ?? 0,
      }
    : null;

export function normalizeFigmaTree(root: FigmaRawNode): NormalizedFigmaNode[] {
  const origin = root.absoluteBoundingBox ?? fail(400, 'Selected Figma node has no bounding box. Select a Frame.');
  const out: NormalizedFigmaNode[] = [];
  const visit = (node: FigmaRawNode, parentId: string | null): void => {
    const bb = node.absoluteBoundingBox;
    const visibleChildren = (node.children ?? []).filter((c) => c.visible !== false && c.absoluteBoundingBox);
    bb &&
      out.push({
        id: node.id,
        name: node.name,
        type: node.type,
        text: node.type === 'TEXT' ? node.characters ?? '' : null,
        relativeBox: { x: bb.x - origin.x, y: bb.y - origin.y, width: bb.width, height: bb.height },
        padding: {
          top: node.paddingTop ?? 0,
          right: node.paddingRight ?? 0,
          bottom: node.paddingBottom ?? 0,
          left: node.paddingLeft ?? 0,
        },
        itemSpacing: node.itemSpacing ?? null,
        layoutMode: toLayoutMode(node.layoutMode),
        typography: toTypography(node),
        parentId,
        childrenIds: visibleChildren.map((c) => c.id),
      });
    visibleChildren.forEach((c) => visit(c, node.id));
  };
  visit(root, null);
  return out;
}
