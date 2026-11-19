import { Box } from '../shared/types';

export const area = (b: Box): number => Math.max(0, b.width) * Math.max(0, b.height);

export const intersection = (a: Box, b: Box): number => {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return Math.max(0, w) * Math.max(0, h);
};

export const iou = (a: Box, b: Box): number => {
  const inter = intersection(a, b);
  const union = area(a) + area(b) - inter;
  return union > 0 ? inter / union : 0;
};

export const centerDistance = (a: Box, b: Box): number =>
  Math.hypot(a.x + a.width / 2 - (b.x + b.width / 2), a.y + a.height / 2 - (b.y + b.height / 2));

export const contains = (outer: Box, inner: Box, slack = 2): boolean =>
  inner.x >= outer.x - slack &&
  inner.y >= outer.y - slack &&
  inner.x + inner.width <= outer.x + outer.width + slack &&
  inner.y + inner.height <= outer.y + outer.height + slack;

export const round2 = (n: number): number => Math.round(n * 100) / 100;
