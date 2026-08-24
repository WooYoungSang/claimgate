import { assertEvidencePackProjectable, type EvidencePack } from '../evidence.js';

export type GraphNodeLabel = 'EvidencePack' | 'Claim' | 'Source';
export type GraphEdgeType = 'CONTAINS_CLAIM' | 'ANCHORED_TO';
export type GraphValue = string | number | boolean | null | undefined;

export interface GraphNode {
  readonly id: string;
  readonly label: GraphNodeLabel;
  readonly properties: Readonly<Record<string, GraphValue>>;
}

export interface GraphEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly type: GraphEdgeType;
}

export interface GraphProjection {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export function projectEvidencePackToGraph(pack: EvidencePack): GraphProjection {
  assertEvidencePackProjectable(pack);

  const packNodeId = graphId('evidence-pack', pack.id);
  const packNode: GraphNode = {
    id: packNodeId,
    label: 'EvidencePack',
    properties: {
      title: pack.title,
      generatedAt: pack.generatedAt,
      itemCount: pack.items.length
    }
  };

  const claimNodes = pack.items.map<GraphNode>((item) => ({
    id: graphId('claim', item.claimId),
    label: 'Claim',
    properties: {
      text: item.claimText,
      decision: item.reviewerDecision,
      value: item.normalizedValue,
      sourceAnchorId: item.sourceAnchorId
    }
  }));

  const sourceNodes = pack.sources.map<GraphNode>((source) => ({
    id: graphId('source', source.id),
    label: 'Source',
    properties: {
      kind: source.kind,
      title: source.title,
      locator: source.locator,
      checksum: source.checksum
    }
  }));

  const containsEdges = pack.items.map<GraphEdge>((item) => {
    const claimNodeId = graphId('claim', item.claimId);
    return {
      id: graphEdgeId(packNode.id, claimNodeId),
      from: packNode.id,
      to: claimNodeId,
      type: 'CONTAINS_CLAIM'
    };
  });

  const anchorEdges = pack.items.map<GraphEdge>((item) => {
    const claimNodeId = graphId('claim', item.claimId);
    const sourceNodeId = graphId('source', item.sourceAnchor.sourceId);
    return {
      id: graphEdgeId(claimNodeId, sourceNodeId),
      from: claimNodeId,
      to: sourceNodeId,
      type: 'ANCHORED_TO'
    };
  });

  return Object.freeze({
    nodes: Object.freeze([packNode, ...claimNodes, ...sourceNodes].map(stripUndefinedProperties).sort(compareNode)),
    edges: Object.freeze([...containsEdges, ...anchorEdges].sort(compareEdge))
  });
}

function compareNode(left: GraphNode, right: GraphNode): number {
  return left.id.localeCompare(right.id);
}

const edgeTypeOrder: Readonly<Record<GraphEdgeType, number>> = { CONTAINS_CLAIM: 0, ANCHORED_TO: 1 };

function compareEdge(left: GraphEdge, right: GraphEdge): number {
  return edgeTypeOrder[left.type] - edgeTypeOrder[right.type] || left.id.localeCompare(right.id);
}

function stripUndefinedProperties<T extends GraphNode>(node: T): T {
  return Object.freeze({
    ...node,
    properties: Object.freeze(Object.fromEntries(Object.entries(node.properties).filter(([, value]) => value !== undefined)))
  }) as T;
}


function graphId(kind: string, rawId: string): string {
  return `${kind}:${encodeURIComponent(rawId)}`;
}

function graphEdgeId(from: string, to: string): string {
  return `${from}->${to}`;
}
