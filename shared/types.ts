export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Sides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Typography {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeightPx: number;
  letterSpacing: number;
}

export interface NormalizedFigmaNode {
  id: string;
  name: string;
  type: 'FRAME' | 'GROUP' | 'TEXT' | 'RECTANGLE' | 'INSTANCE' | 'COMPONENT' | string;
  text: string | null;
  relativeBox: Box;
  padding: Sides;
  itemSpacing: number | null;
  layoutMode: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  typography: Typography | null;
  parentId: string | null;
  childrenIds: string[];
}

export interface NormalizedDomNode {
  uid: string;
  tag: string;
  selector: string;
  figmaIdAttr: string | null;
  text: string | null;
  fullText: string | null;
  box: Box;
  padding: Sides;
  margin: Sides;
  typography: Typography;
}

export type IssueCategory = 'TYPOGRAPHY' | 'PADDING' | 'MARGIN_SPACING' | 'MISSING_ELEMENT';

export interface AuditIssue {
  id: string;
  category: IssueCategory;
  property: string;
  severity: 'error' | 'warning';
  figmaNodeId: string;
  figmaNodeName: string;
  domSelector: string | null;
  expected: string | number;
  actual: string | number;
  deltaPx?: number;
  highlightBox: Box;
  secondaryBox?: Box;
}

export interface AuditReport {
  meta: {
    figmaUrl: string;
    siteUrl: string;
    viewportWidth: number;
    timestamp: string;
    totalNodesChecked: number;
    score: number;
  };
  screenshotBase64: string;
  issues: AuditIssue[];
}

export interface AuditRequest {
  figmaUrl: string;
  figmaToken: string;
  siteUrl: string;
  tolerance?: number;
}
