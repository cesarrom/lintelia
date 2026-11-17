import { useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * A code of N digits (a one-time code received by SMS or e-mail, a card PIN, a confirmation number): one box per
 * digit, pasting fills them all, phones offer the code they received (`autocomplete="one-time-code"`).
 */
export function OtpInput({ id, length = 6, value, onChange, secret, invalid }: { id: string; length?: number; value: unknown; onChange: (value: string) => void; secret?: boolean; invalid?: boolean }) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, length).padEnd(length, ' ').split('');
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const set = (index: number, typed: string) => {
    const clean = typed.replace(/\D/g, '');
    if (!clean) return;
    const next = [...digits];
    for (let i = 0; i < clean.length && index + i < length; i++) next[index + i] = clean[i];
    onChange(next.join('').replace(/\s/g, ''));
    boxes.current[Math.min(index + clean.length, length - 1)]?.focus();
  };
  return (
    <div className="flex gap-2" role="group" aria-labelledby={`${id}-label`} data-testid={`otp-${id.replace(/^field-/, '')}`}>
      {digits.map((digit, i) => (
        <input
          key={i} ref={(el) => { boxes.current[i] = el; }} id={i === 0 ? id : undefined}
          value={digit.trim()} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={length} aria-label={`Digit ${i + 1}`}
          type={secret ? 'password' : 'text'} aria-invalid={invalid}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digit.trim() && i > 0) {
              const next = [...digits];
              next[i - 1] = ' ';
              onChange(next.join('').replace(/\s/g, ''));
              boxes.current[i - 1]?.focus();
            } else if (e.key === 'Backspace') {
              const next = [...digits];
              next[i] = ' ';
              onChange(next.join('').replace(/\s+$/g, '').replace(/\s/g, ''));
            }
          }}
          onFocus={(e) => e.target.select()}
          className={cn('h-12 w-11 rounded-lg border border-input bg-background text-center text-lg font-semibold tabular shadow-xs focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20', invalid && 'border-destructive')}
        />
      ))}
    </div>
  );
}
