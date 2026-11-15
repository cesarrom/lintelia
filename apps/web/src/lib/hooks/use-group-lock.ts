'use client';

import { atom, useAtom, useAtomValue } from 'jotai';

const lockedGroupsAtom = atom<string[]>([]);

// Custom hook to manage locked groups
export const useGroupLock = (groups?: string[]) => {
  const lockedGroups = useAtomValue(lockedGroupsAtom);

  if (!groups?.length) return false;
  return groups.some(group => lockedGroups.includes(group));
};

// Custom hook to control group locking
export const useGroupLocker = () => {
  const [lockedGroups, setLockedGroups] = useAtom(lockedGroupsAtom);

  const lock = (groups: string[]) => {
    const next = new Set([...lockedGroups, ...groups]);
    setLockedGroups(Array.from(next));
  };

  const unlock = (groups: string[]) => {
    const next = new Set(lockedGroups);
    groups.forEach(g => next.delete(g));
    setLockedGroups(Array.from(next));
  };

  return {
    lock,
    unlock,
    isLocked: (group: string) => lockedGroups.includes(group)
  };
}; 