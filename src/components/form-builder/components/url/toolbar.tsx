'use client';

import { Link } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

interface UrlConfig {
  prefix: string;
  showPrefix: boolean;
  validateUrl: boolean;
  allowedProtocols: string[];
  openInNewTab: boolean;
  showLinkPreview: boolean;
}

const defaultConfig: UrlConfig = {
  prefix: 'https://',
  showPrefix: true,
  validateUrl: true,
  allowedProtocols: ['http://', 'https://'],
  openInNewTab: true,
  showLinkPreview: true
};

export function UrlToolbar() {
  return (
    <ToolbarButton
      type="url"
      label="URL"
      icon={Link}
      config={defaultConfig}
    />
  );
} 