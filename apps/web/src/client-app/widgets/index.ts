import type { ComponentType } from 'react';
import { AccountsWidget, PaymentCardsWidget, TransactionsWidget } from './banking';
import { CalloutWidget, EmbedWidget, FaqWidget, HeadingWidget, HeroWidget, ImageWidget, TextWidget } from './content';
import { ChartWidget, DetailsWidget, ListWidget, ProgressListWidget, StatWidget, TableWidget } from './data';
import { ButtonWidget, FabWidget, QrCodeWidget } from './actions';
import { ApplicationsWidget, JourneysWidget, NotificationsWidget, QuickActionsWidget, RequestsWidget } from './process';
import { PrivacyWidget, ProfileWidget, SecurityWidget } from './profile';
import type { WidgetProps } from './shared';

/** Renderers of the widget catalogue (`CLIENT_WIDGETS` in @repo/lintelia/schemas); `section` is drawn by the runtime. */
export const WIDGETS: Record<string, ComponentType<WidgetProps>> = {
  hero: HeroWidget,
  heading: HeadingWidget,
  text: TextWidget,
  callout: CalloutWidget,
  image: ImageWidget,
  faq: FaqWidget,
  stat: StatWidget,
  list: ListWidget,
  table: TableWidget,
  details: DetailsWidget,
  chart: ChartWidget,
  'progress-list': ProgressListWidget,
  accounts: AccountsWidget,
  transactions: TransactionsWidget,
  'payment-cards': PaymentCardsWidget,
  'quick-actions': QuickActionsWidget,
  journeys: JourneysWidget,
  button: ButtonWidget,
  fab: FabWidget,
  'qr-code': QrCodeWidget,
  applications: ApplicationsWidget,
  requests: RequestsWidget,
  notifications: NotificationsWidget,
  profile: ProfileWidget,
  security: SecurityWidget,
  privacy: PrivacyWidget,
  embed: EmbedWidget,
};

export type { WidgetProps };
