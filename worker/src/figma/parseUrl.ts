import { fail } from '../errors';

export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId: string;
}

export function parseFigmaUrl(figmaUrl: string): ParsedFigmaUrl {
  const keyMatch = /figma\.com\/(?:file|design|proto)\/([a-zA-Z0-9]+)/.exec(String(figmaUrl ?? ''));
  const fileKey = keyMatch?.[1] ?? fail(400, 'Invalid Figma URL. Expected https://www.figma.com/design/<fileKey>/...?node-id=<id>');
  const url = (() => {
    try {
      return new URL(figmaUrl);
    } catch {
      return fail(400, 'Invalid Figma URL.');
    }
  })();
  const rawNode = url.searchParams.get('node-id') ?? fail(400, 'Figma URL is missing node-id. Select a specific Frame in Figma and copy its link.');
  const nodeId = decodeURIComponent(rawNode).replace(/-/g, ':');
  return { fileKey, nodeId };
}
