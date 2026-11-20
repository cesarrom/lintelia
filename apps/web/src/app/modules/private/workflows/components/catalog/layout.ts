import ELK from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node } from 'reactflow';
import type { NodeData } from '@repo/lintelia/schemas';

const elk = new ELK();

/** Layered left-to-right layout (ELK) of the workflow graph; positions are then saved in the YAML. */
export async function autoLayout(nodes: Node<NodeData>[], edges: Edge[]): Promise<Node<NodeData>[]> {
  const graph = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.spacing.nodeNode': '40',
    },
    children: nodes.map((n) => ({ id: n.id, width: n.width ?? 300, height: n.height ?? 140 })),
    edges: edges.filter((e) => nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target))
      .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });
  const positions = new Map((graph.children ?? []).map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]));
  return nodes.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position }));
}
