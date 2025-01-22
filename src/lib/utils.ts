import { NodeData } from "@/components/workflow/nodes/types";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateNodeName(type: string, existingNodes: { name: string }[]): string {
  // Get all existing names for this type
  const typeNames = existingNodes
    .map(node => node.name)
    .filter(name => name.startsWith(type));

  // Find the highest number used
  let highestNumber = 0;
  typeNames.forEach(name => {
    const match = name.match(new RegExp(`^${type}(\\d+)$`));
    if (match) {
      const number = parseInt(match[1], 10);
      if (number > highestNumber) {
        highestNumber = number;
      }
    }
  });

  // Generate new name with incremented number
  return `${type}${highestNumber + 1}`;
}

export type WorkflowSchema = {
  id: string;
  name: string;
  description?: string;
  nodes: {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: NodeData;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }[];
  inputs?: { name: string; type: string }[];
  outputs?: { name: string; type: string }[];
}; 