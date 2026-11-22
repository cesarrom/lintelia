import { useCallback, useMemo } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { JourneyPresentation } from '@repo/lintelia/schemas';
import { cn } from '@/lib/utils';
import { JourneyRunner } from './JourneyRunner';
import { appThemeProps, RuntimeProvider, useRuntime, type AppRuntime } from './runtime';

/** A journey open over the page (docs/plans/14): which case, and how it is presented. */
export interface JourneyOverlayState {
  caseId: string;
  journey: string | null;
  presentation: JourneyPresentation & { mode: 'dialog' | 'sheet' | 'fullscreen' };
}

const DIALOG_SIZE = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' } as const;
const SHEET_SIZE = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' } as const;
const BOTTOM_SIZE = { sm: 'sm:max-w-xl', md: 'sm:max-w-3xl', lg: '' } as const;

/**
 * A journey in a dialog, a sheet (from the right or the bottom) or the whole screen, over the page the client was on.
 * Opening a page or finishing closes it; when dismissible (default), the client may close it and continue later.
 */
export function JourneyOverlay({ overlay, onClose }: { overlay: JourneyOverlayState; onClose: () => void }) {
  const runtime = useRuntime();
  const { mode, size = 'md', side = 'right' } = overlay.presentation;
  const dismissible = overlay.presentation.dismissible !== false;
  // Inside the overlay, going somewhere else closes it first.
  const inner = useMemo<AppRuntime>(() => ({
    ...runtime,
    openPage: (page, params) => { onClose(); runtime.openPage(page, params); },
    openCase: (caseId, journey) => { onClose(); runtime.openCase(caseId, journey); },
  }), [runtime, onClose]);
  const theme = appThemeProps(runtime.definition, runtime.institution);
  const title = (overlay.journey && runtime.definition.journeys[overlay.journey]?.title) || 'Journey';
  const leave = useCallback(() => onClose(), [onClose]);

  const content = mode === 'fullscreen'
    ? 'inset-0 h-full w-full bg-canvas data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4'
    : mode === 'sheet' && side === 'bottom'
      ? cn('inset-x-0 bottom-0 mx-auto max-h-[92dvh] w-full rounded-t-3xl border-t bg-background shadow-overlay data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-300', BOTTOM_SIZE[size])
      : mode === 'sheet'
        ? cn('inset-y-0 right-0 h-full w-full border-l bg-background shadow-overlay data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-300', SHEET_SIZE[size])
        : cn('left-1/2 top-1/2 max-h-[90dvh] w-[calc(100%-1.5rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background shadow-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95', DIALOG_SIZE[size]);

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open && dismissible) onClose(); }}>
      <DialogPrimitive.Portal>
        {mode !== 'fullscreen' && <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[hsl(232_40%_8%/0.45)] data-[state=open]:animate-in data-[state=open]:fade-in-0 dark:bg-black/70" />}
        <DialogPrimitive.Content
          {...theme}
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => { if (!dismissible) e.preventDefault(); }}
          onPointerDownOutside={(e) => { if (!dismissible) e.preventDefault(); }}
          onInteractOutside={(e) => { if (!dismissible) e.preventDefault(); }}
          className={cn('fixed z-50 flex flex-col overflow-hidden text-foreground outline-none', content)}
          data-testid="journey-overlay" data-mode={mode} data-side={mode === 'sheet' ? side : undefined}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {mode === 'sheet' && side === 'bottom' && <span className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25" aria-hidden />}
          {dismissible && (
            <DialogPrimitive.Close className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-2 text-muted-foreground backdrop-blur transition hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="journey-overlay-close">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
          <div className={cn('min-h-0 flex-1 overflow-y-auto', mode === 'fullscreen' ? 'px-4 py-8 sm:py-12' : 'px-5 py-6 sm:px-7')}>
            <RuntimeProvider runtime={inner}>
              <JourneyRunner key={overlay.caseId} caseId={overlay.caseId} onLeave={leave} presentation={mode} dismissible={dismissible} />
            </RuntimeProvider>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
