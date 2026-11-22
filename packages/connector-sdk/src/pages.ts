/** Server-rendered pages of connectors (connect/settings): plain HTML, branded with the institution's colour. */

export const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export interface SettingField {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'password' | 'url' | 'checkbox' | 'select';
  /** Stored encrypted in the SecretStore, never shown again (write-only). */
  secret?: boolean;
  required?: boolean;
  help?: string;
  placeholder?: string;
  default?: string | number | boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface PageShell {
  title: string;
  connectorName: string;
  tenantName?: string;
  accent?: string;
  body: string;
}

const safeColor = (value: unknown) => (typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : '#0f172a');

export function layout({ title, connectorName, tenantName, accent, body }: PageShell) {
  const color = safeColor(accent);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ${escapeHtml(connectorName)}</title>
<style>
  *{box-sizing:border-box} body{font-family:system-ui,-apple-system,sans-serif;margin:0;color:#0f172a;background:#f8fafc}
  header{background:#fff;border-bottom:1px solid #e2e8f0;padding:14px 24px;display:flex;justify-content:space-between;align-items:center}
  header b{font-size:15px} header span{color:#64748b;font-size:13px}
  main{padding:24px;max-width:640px;margin:auto}
  h1{font-size:20px;margin:0 0 4px} p.lead{color:#475569;margin:0 0 20px;font-size:14px}
  form{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px}
  .field{margin-bottom:16px} label{display:block;font-weight:600;font-size:13px;margin-bottom:6px}
  input[type=text],input[type=email],input[type=number],input[type=password],input[type=url],select{width:100%;padding:9px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px}
  .check{display:flex;gap:8px;align-items:center} .check label{margin:0}
  .help{color:#64748b;font-size:12px;margin-top:4px}
  .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px}
  button{background:${color};color:#fff;border:0;border-radius:6px;padding:10px 16px;font-size:14px;cursor:pointer}
  a.secondary,button.secondary{background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;padding:10px 16px;font-size:14px;text-decoration:none}
  .error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:6px;padding:10px 12px;margin-bottom:16px;font-size:14px}
  .ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:6px;padding:10px 12px;margin-bottom:16px;font-size:14px}
  .muted{color:#64748b;font-size:12px}
</style></head><body>
<header><b>${escapeHtml(connectorName)}</b><span>${tenantName ? `Connecting for ${escapeHtml(tenantName)}` : ''}</span></header>
<main>${body}</main></body></html>`;
}

export function renderField(field: SettingField, value: unknown, secretSetAt?: Date) {
  const id = `f_${field.name}`;
  const help = field.help ? `<div class="help">${escapeHtml(field.help)}</div>` : '';
  if (field.type === 'checkbox') {
    return `<div class="field"><div class="check"><input type="checkbox" id="${id}" name="${escapeHtml(field.name)}" value="true" ${value === true || value === 'true' ? 'checked' : ''}>
<label for="${id}">${escapeHtml(field.label)}</label></div>${help}</div>`;
  }
  if (field.type === 'select') {
    const options = (field.options ?? []).map((o) => `<option value="${escapeHtml(o.value)}" ${String(value ?? '') === o.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('');
    return `<div class="field"><label for="${id}">${escapeHtml(field.label)}</label><select id="${id}" name="${escapeHtml(field.name)}">${options}</select>${help}</div>`;
  }
  if (field.secret) {
    const hint = secretSetAt ? `<div class="help">•••••••• set ${escapeHtml(secretSetAt.toISOString().slice(0, 10))}. Leave empty to keep it.</div>` : '';
    return `<div class="field"><label for="${id}">${escapeHtml(field.label)}</label>
<input type="password" id="${id}" name="${escapeHtml(field.name)}" autocomplete="new-password" placeholder="${secretSetAt ? 'Unchanged' : escapeHtml(field.placeholder ?? '')}" ${field.required && !secretSetAt ? 'required' : ''}>${hint}${help}</div>`;
  }
  return `<div class="field"><label for="${id}">${escapeHtml(field.label)}</label>
<input type="${field.type ?? 'text'}" id="${id}" name="${escapeHtml(field.name)}" value="${escapeHtml(value ?? field.default ?? '')}" placeholder="${escapeHtml(field.placeholder ?? '')}" ${field.required ? 'required' : ''}>${help}</div>`;
}

/**
 * Final page after saving: inside the core's iframe it tells the host page (postMessage to the core's origin only);
 * in a full-page redirect it goes back to the core.
 */
export function donePage(shell: Omit<PageShell, 'body'>, returnUrl: string, message: string) {
  const origin = new URL(returnUrl).origin;
  return layout({
    ...shell,
    body: `<div class="ok">${escapeHtml(message)}</div><p><a class="secondary" href="${escapeHtml(returnUrl)}" target="_top">Back to Lintelia</a></p>
<script>
  (function(){
    var data = ${JSON.stringify({ type: 'lintelia:connector-saved', message })};
    if (window.parent !== window) { window.parent.postMessage(data, ${JSON.stringify(origin)}); }
    else { setTimeout(function(){ window.location.href = ${JSON.stringify(returnUrl)}; }, 600); }
  })();
</script>`,
  });
}
