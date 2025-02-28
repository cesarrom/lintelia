import { NodeData } from "@/app/(modules)/(private)/(workflows)/(components)/yaml/types";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { atom, useAtom } from "jotai"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const parseId = (idRef: string) => {
  const [domain, id] = idRef.split('::');

  return {
    domain,
    id,
  };
}

export const serializeId = (domain: string, id: string) => {
  return `${domain}::${id}`;
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

export const wait = (ms: number) => new Promise(resolve => { setTimeout(resolve, ms) });

// Global state atom for locked groups
const lockedGroupsAtom = atom<Set<string>>(new Set<string>())

// Hook for components to check if they're locked
export const useGroupLock = (groups?: string[]) => {
  const [lockedGroups] = useAtom(lockedGroupsAtom)
  if (!groups?.length) return false
  return groups.some(group => lockedGroups.has(group))
}

// Hook for services to control group locking
export const useGroupLocker = () => {
  const [lockedGroups, setLockedGroups] = useAtom(lockedGroupsAtom)

  return {
    lock: (groups: string[]) => {
      setLockedGroups(prev => {
        const next = new Set(prev)
        groups.forEach(g => next.add(g))
        return next
      })
    },
    unlock: (groups: string[]) => {
      setLockedGroups(prev => {
        const next = new Set(prev)
        groups.forEach(g => next.delete(g))
        return next
      })
    },
    isLocked: (group: string) => lockedGroups.has(group)
  }
}