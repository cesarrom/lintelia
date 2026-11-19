import { useId, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * When a privileged change takes effect (docs/plans/15 §14): now, or from a date (it waits as "scheduled" and can be
 * cancelled until then). Controlled: `value` is an ISO string or undefined (now).
 */
export function EffectiveDate({ value, onChange, className }: { value: string | undefined; onChange: (value: string | undefined) => void; className?: string }) {
  const id = useId();
  const [later, setLater] = useState(!!value);
  const local = value ? new Date(new Date(value).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '';
  return (
    <div className={cn('space-y-2 rounded-lg border border-dashed p-3', className)} data-testid="effective-date">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="font-medium">Takes effect</span>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={id} checked={!later} onChange={() => { setLater(false); onChange(undefined); }} /> now
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={id} checked={later} onChange={() => setLater(true)} /> from a date
        </label>
      </div>
      {later && (
        <div className="flex items-center gap-2">
          <Label htmlFor={`${id}-at`} className="sr-only">Effective from</Label>
          <Input id={`${id}-at`} aria-label="Effective from" type="datetime-local" className="w-60" value={local}
            min={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)}
            onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : undefined)} />
          <span className="text-xs text-muted-foreground">It waits as scheduled and can be cancelled until then.</span>
        </div>
      )}
    </div>
  );
}
