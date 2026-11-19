import { AuditIssue, Box, IssueCategory, NormalizedFigmaNode, Sides } from '../shared/types';
import { NodeMatch } from './matcher';
import { round2 } from './geometry';

export interface DiffResult {
  issues: AuditIssue[];
  checks: number;
}

interface IssueTarget {
  figma: NormalizedFigmaNode;
  selector: string | null;
  box: Box;
}

const normFamily = (f: string): string => (f.split(',')[0] ?? '').replace(/["']/g, '').trim().toLowerCase();

const SIDES: (keyof Sides)[] = ['top', 'right', 'bottom', 'left'];

export function diffNodes(figmaNodes: NormalizedFigmaNode[], matches: Map<string, NodeMatch>, tolerance: number): DiffResult {
  const issues: AuditIssue[] = [];
  const byId = new Map(figmaNodes.map((f) => [f.id, f]));
  let checks = 0;
  let seq = 0;

  const severityFor = (delta: number, limit: number): AuditIssue['severity'] => (delta > Math.max(limit * 3, 4) ? 'error' : 'warning');

  const push = (
    category: IssueCategory,
    property: string,
    target: IssueTarget,
    expected: string | number,
    actual: string | number,
    severity: AuditIssue['severity'],
    deltaPx?: number,
    secondaryBox?: Box,
  ): void => {
    seq += 1;
    issues.push({
      id: `issue-${seq}`,
      category,
      property,
      severity,
      figmaNodeId: target.figma.id,
      figmaNodeName: target.figma.name,
      domSelector: target.selector,
      expected,
      actual,
      ...(deltaPx === undefined ? {} : { deltaPx: round2(deltaPx) }),
      highlightBox: target.box,
      ...(secondaryBox ? { secondaryBox } : {}),
    });
  };

  const targetOf = (m: NodeMatch): IssueTarget => ({ figma: m.figma, selector: m.dom.selector, box: m.dom.box });

  const numericCheck = (category: IssueCategory, property: string, m: NodeMatch, expected: number, actual: number, limit: number, applies = true): void => {
    const delta = Math.abs(expected - actual);
    checks += applies ? 1 : 0;
    applies && delta > limit && push(category, property, targetOf(m), round2(expected), round2(actual), severityFor(delta, limit), actual - expected);
  };

  const exactCheck = (property: string, m: NodeMatch, expected: string | number, actual: string | number, same: boolean): void => {
    checks += 1;
    same || push('TYPOGRAPHY', property, targetOf(m), expected, actual, 'error');
  };

  const typographyChecks = (m: NodeMatch): void => {
    const ft = m.figma.typography;
    const dt = m.dom.typography;
    ft && exactCheck('font-family', m, ft.fontFamily, dt.fontFamily, normFamily(ft.fontFamily) === normFamily(dt.fontFamily));
    ft && exactCheck('font-weight', m, ft.fontWeight, dt.fontWeight, ft.fontWeight === dt.fontWeight);
    ft && numericCheck('TYPOGRAPHY', 'font-size', m, ft.fontSize, dt.fontSize, 1);
    ft && numericCheck('TYPOGRAPHY', 'line-height', m, ft.lineHeightPx, dt.lineHeightPx, tolerance);
    ft && numericCheck('TYPOGRAPHY', 'letter-spacing', m, ft.letterSpacing, dt.letterSpacing, 0.5);
  };

  const paddingChecks = (m: NodeMatch): void => {
    const applicable = m.figma.type !== 'TEXT';
    SIDES.filter(() => applicable).forEach((side) => {
      const e = m.figma.padding[side];
      const a = m.dom.padding[side];
      numericCheck('PADDING', `padding-${side}`, m, e, a, tolerance, e > 0 || a > 0);
    });
  };

  matches.forEach(typographyChecks);
  matches.forEach(paddingChecks);

  const gapCheck = (parent: NormalizedFigmaNode, a: NormalizedFigmaNode, b: NormalizedFigmaNode): void => {
    const vertical = parent.layoutMode === 'VERTICAL';
    const ma = matches.get(a.id);
    const mb = matches.get(b.id);
    const both = ma && mb ? { ma, mb } : null;
    const expected = vertical ? b.relativeBox.y - (a.relativeBox.y + a.relativeBox.height) : b.relativeBox.x - (a.relativeBox.x + a.relativeBox.width);
    const actual = both
      ? vertical
        ? both.mb.dom.box.y - (both.ma.dom.box.y + both.ma.dom.box.height)
        : both.mb.dom.box.x - (both.ma.dom.box.x + both.ma.dom.box.width)
      : expected;
    const delta = Math.abs(expected - actual);
    checks += both ? 1 : 0;
    both &&
      delta > tolerance &&
      push(
        'MARGIN_SPACING',
        vertical ? 'vertical-gap' : 'horizontal-gap',
        { figma: b, selector: `${both.ma.dom.selector}  →  ${both.mb.dom.selector}`, box: both.ma.dom.box },
        round2(expected),
        round2(actual),
        severityFor(delta, tolerance),
        actual - expected,
        both.mb.dom.box,
      );
  };

  figmaNodes
    .filter((f) => f.layoutMode !== 'NONE')
    .forEach((parent) => {
      const vertical = parent.layoutMode === 'VERTICAL';
      const children = parent.childrenIds
        .map((id) => byId.get(id))
        .filter((f): f is NormalizedFigmaNode => Boolean(f))
        .sort((a, b) => (vertical ? a.relativeBox.y - b.relativeBox.y : a.relativeBox.x - b.relativeBox.x));
      children.slice(1).forEach((b, i) => gapCheck(parent, children[i], b));
    });

  figmaNodes
    .filter((f) => f.type === 'TEXT' && String(f.text ?? '').trim() && !matches.has(f.id))
    .forEach((f) => {
      checks += 1;
      push('MISSING_ELEMENT', 'text-content', { figma: f, selector: null, box: f.relativeBox }, String(f.text ?? '').trim().slice(0, 140), 'Not found on page', 'warning');
    });

  return { issues, checks };
}
