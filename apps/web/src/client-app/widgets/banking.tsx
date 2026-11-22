import { ArrowDownLeft, ChevronRight, Loader2, ShieldAlert, Snowflake, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { filterItems, useResolved } from '../expressions';
import { appCurrency, dayLabel, formatAs } from '../format';
import { AppIcon } from '../icons';
import { useRuntime } from '../runtime';
import { Empty, WidgetCard, itemsOf, type WidgetProps } from './shared';

/** Banking widgets (docs/plans/11 §3): accounts, transactions and payment cards, drawn from the client's records. */

const ACCOUNT_TYPE: Record<string, { label: string; className: string; icon: string }> = {
  current: { label: 'Current account', className: 'bg-primary text-primary-foreground', icon: 'wallet' },
  savings: { label: 'Savings', className: 'bg-[hsl(162_55%_30%)] text-white', icon: 'piggy-bank' },
  loan: { label: 'Loan', className: 'bg-[hsl(222_30%_22%)] text-white', icon: 'landmark' },
  credit: { label: 'Credit', className: 'bg-[hsl(262_45%_35%)] text-white', icon: 'credit-card' },
};

export function AccountsWidget({ props, scope }: WidgetProps) {
  const runtime = useRuntime();
  const accounts = useResolved(async () => filterItems(itemsOf(props.source || 'records:accounts', scope), props.filter, scope), [props.source, props.filter, scope]);
  if (accounts === undefined) return <div className="h-36" />;
  const order = ['current', 'savings', 'credit', 'loan'];
  const sorted = [...accounts].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return (
    <WidgetCard title={props.title || undefined} bare testId="accounts">
      {!sorted.length ? <div className="rounded-2xl border bg-card shadow-card"><Empty>No accounts yet.</Empty></div> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((account) => {
            const type = ACCOUNT_TYPE[account.type] ?? ACCOUNT_TYPE.current;
            const open = () => props.page && runtime.openPage(props.page, { key: String(account.key) });
            return (
              <button
                key={account.key} type="button" onClick={open} disabled={!props.page} data-testid="account-card" data-account={account.key}
                className={cn('group relative flex min-h-[148px] flex-col justify-between overflow-hidden rounded-2xl p-5 text-left shadow-raised transition hover:-translate-y-0.5 disabled:hover:translate-y-0', type.className)}
              >
                <span className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10" />
                <span className="pointer-events-none absolute -bottom-16 right-10 h-32 w-32 rounded-full bg-black/10" />
                <span className="relative flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{account.name}</span>
                    <span className="block text-xs opacity-75">{type.label}{account.number ? ` · ${account.number}` : ''}{account.rate ? ` · ${account.rate}% AER` : ''}</span>
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15"><AppIcon name={type.icon} className="h-4 w-4" /></span>
                </span>
                <span className="relative flex items-end justify-between gap-3">
                  <span>
                    <span className="block text-[11px] uppercase tracking-[0.08em] opacity-70">{account.type === 'loan' ? 'Outstanding' : 'Balance'}</span>
                    <span className="block text-[26px] font-semibold leading-tight tracking-[-0.02em] tabular" data-testid="account-balance">{formatAs(account.balance ?? 0, 'money', account.currency ?? appCurrency())}</span>
                  </span>
                  {account.status && account.status !== 'active' && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium capitalize">{account.status}</span>}
                  {props.page && <ChevronRight className="h-5 w-5 opacity-60 transition-transform group-hover:translate-x-0.5" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}

const CATEGORY_ICON: Record<string, string> = {
  groceries: 'shopping-cart', 'dining out': 'utensils', transport: 'train-front', shopping: 'shopping-bag', entertainment: 'clapperboard',
  health: 'heart-pulse', bills: 'receipt', income: 'banknote', salary: 'banknote', transfers: 'arrow-left-right', savings: 'piggy-bank',
  travel: 'plane', cash: 'wallet', loan: 'landmark', fees: 'percent', interest: 'trending-up',
};

export function TransactionsWidget({ props, scope }: WidgetProps) {
  const transactions = useResolved(async () => {
    const items = await filterItems(itemsOf(props.source || 'records:transactions', scope), props.filter, scope);
    const sorted = [...items].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
    const limit = Number(props.limit);
    return limit > 0 ? sorted.slice(0, limit) : sorted;
  }, [props.source, props.filter, props.limit, scope]);
  const records = (scope.records ?? {}) as Record<string, Array<Record<string, any>>>;
  const accountName = (key: string) => records.accounts?.find((a) => a.key === key)?.name ?? records.cards?.find((c) => c.key === key)?.name ?? '';

  const groups: Array<{ day: string; items: Array<Record<string, any>> }> = [];
  for (const tx of transactions ?? []) {
    const day = dayLabel(String(tx.date ?? ''));
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(tx);
    else groups.push({ day, items: [tx] });
  }
  return (
    <WidgetCard title={props.title} testId="transactions">
      {transactions === undefined ? <div className="h-40" /> : !transactions.length ? <Empty>No transactions yet.</Empty> : (
        <div className="pb-2">
          {groups.map((group) => (
            <div key={group.day}>
              <p className="bg-muted/30 px-5 py-1.5 text-[11.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{group.day}</p>
              <ul className="divide-y">
                {group.items.map((tx) => {
                  const amount = Number(tx.amount) || 0;
                  const incoming = amount > 0;
                  return (
                    <li key={tx.key} className="flex items-center gap-3 px-5 py-3" data-testid="transaction">
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', incoming ? 'bg-success-soft text-success' : 'bg-muted text-foreground/70')}>
                        {incoming && !CATEGORY_ICON[String(tx.category ?? '').toLowerCase()] ? <ArrowDownLeft className="h-4 w-4" /> : <AppIcon name={CATEGORY_ICON[String(tx.category ?? '').toLowerCase()] ?? 'circle-dollar-sign'} className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-medium">{tx.description}</span>
                        <span className="block truncate text-xs text-muted-foreground">{[tx.category, props.showAccount ? accountName(String(tx.account ?? '')) : null, tx.status === 'pending' ? 'Pending' : null].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className={cn('shrink-0 text-[14.5px] font-semibold tabular', incoming && 'text-success')} data-testid="transaction-amount">
                        {incoming ? '+' : ''}{formatAs(amount, 'money', tx.currency ?? appCurrency())}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

const NETWORK: Record<string, string> = { visa: 'VISA', mastercard: 'mastercard', amex: 'AMEX' };
const CARD_STATUS: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success-soft text-success' },
  frozen: { label: 'Frozen', className: 'bg-info-soft text-info' },
  ordered: { label: 'On its way', className: 'bg-warning-soft text-[hsl(30_85%_34%)]' },
  blocked: { label: 'Blocked', className: 'bg-destructive/10 text-destructive' },
  replaced: { label: 'Replaced', className: 'bg-muted text-muted-foreground' },
};

export function PaymentCardsWidget({ props, scope }: WidgetProps) {
  const runtime = useRuntime();
  const cards = itemsOf(props.source || 'records:cards', scope);
  const order = ['active', 'frozen', 'ordered', 'blocked', 'replaced'];
  const sorted = [...cards].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return (
    <WidgetCard title={props.title || undefined} bare testId="payment-cards">
      {!sorted.length ? <div className="rounded-2xl border bg-card shadow-card"><Empty>No cards yet.</Empty></div> : (
        <div className="grid gap-5 md:grid-cols-2">
          {sorted.map((card) => {
            const status = CARD_STATUS[card.status] ?? { label: card.status, className: 'bg-muted text-muted-foreground' };
            const frozen = card.status === 'frozen';
            const usable = card.status === 'active' || frozen;
            const freezing = runtime.starting === props.freezeJourney;
            const reporting = runtime.starting === props.lostJourney;
            return (
              <div key={card.key} className="rounded-2xl border bg-card p-4 shadow-card" data-testid="payment-card" data-card={card.key} data-status={card.status}>
                <div className={cn('relative aspect-[1.586] overflow-hidden rounded-xl p-5 text-white shadow-raised', card.type === 'credit' ? 'bg-[linear-gradient(135deg,hsl(232_40%_18%),hsl(262_45%_38%))]' : 'bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--brand-strong)))]', !usable && 'grayscale')}>
                  <span className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10" />
                  <span className="pointer-events-none absolute -bottom-20 left-10 h-44 w-44 rounded-full bg-black/10" />
                  <div className="relative flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <span className="text-[13px] font-medium opacity-90">{card.name}</span>
                      <span className="text-[15px] font-bold italic tracking-tight opacity-95">{NETWORK[String(card.network ?? '').toLowerCase()] ?? ''}</span>
                    </div>
                    <span className="h-7 w-10 rounded-md bg-[linear-gradient(135deg,#f6e27a,#d4a937)] opacity-90" />
                    <div>
                      <p className="font-mono text-[17px] tracking-[0.18em]" data-testid="card-number">•••• •••• •••• {card.last4}</p>
                      <div className="mt-1.5 flex items-end justify-between text-[11px] uppercase tracking-[0.08em] opacity-80">
                        <span className="truncate">{card.holder}</span>
                        <span>{card.expiry}</span>
                      </div>
                    </div>
                  </div>
                  {frozen && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[hsl(200_80%_85%/0.35)] backdrop-blur-[2px]">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[13px] font-semibold text-[hsl(200_80%_30%)]"><Snowflake className="h-4 w-4" />Frozen</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', status.className)} data-testid="card-status">{status.label}</span>
                    {card.limit !== undefined && <p className="mt-1 text-xs text-muted-foreground tabular">Limit {formatAs(card.limit, 'money')} · available {formatAs(Number(card.limit) - (Number(card.balance) || 0), 'money')}</p>}
                  </div>
                  {usable && (
                    <div className="flex gap-2">
                      {props.freezeJourney && (
                        <Button size="sm" variant="outline" disabled={!!runtime.starting} onClick={() => void runtime.startJourney(props.freezeJourney, { card: String(card.key) })} data-testid={frozen ? 'unfreeze-card' : 'freeze-card'}>
                          {freezing ? <Loader2 className="h-4 w-4 animate-spin" /> : frozen ? <Sun className="h-4 w-4" /> : <Snowflake className="h-4 w-4" />}{frozen ? 'Unfreeze' : 'Freeze'}
                        </Button>
                      )}
                      {props.lostJourney && (
                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={!!runtime.starting} onClick={() => void runtime.startJourney(props.lostJourney, { card: String(card.key) })} data-testid="report-lost">
                          {reporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}Report lost
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
