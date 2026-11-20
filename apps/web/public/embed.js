/*
 * Lintelia embeddable forms.
 *
 *   <script src="https://<institution host>/embed.js" data-lintelia-form="<public key>" async></script>
 *
 * Replaces the script tag with an iframe of the hosted form (served by the institution's Lintelia host, which only
 * allows framing by the origins listed when the form was published) and sizes it to its content. The page can listen
 * for `lintelia:submitted` / `lintelia:confirmed` DOM events (detail: { reference }).
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var key = script.getAttribute('data-lintelia-form');
  if (!key) return;
  var base = new URL(script.src, window.location.href).origin;

  var iframe = document.createElement('iframe');
  iframe.src = base + '/embed/forms/' + encodeURIComponent(key);
  iframe.title = script.getAttribute('data-title') || 'Application form';
  iframe.setAttribute('data-lintelia-form', key);
  iframe.style.width = '100%';
  iframe.style.minHeight = '480px';
  iframe.style.border = '0';
  iframe.loading = 'lazy';
  script.parentNode.insertBefore(iframe, script.nextSibling);

  window.addEventListener('message', function (event) {
    if (event.origin !== base || event.source !== iframe.contentWindow) return;
    var data = event.data || {};
    if (data.source !== 'lintelia') return;
    if (data.type === 'resize' && typeof data.height === 'number') {
      iframe.style.height = Math.max(data.height, 200) + 'px';
    } else if (data.type === 'submitted' || data.type === 'confirmed') {
      iframe.dispatchEvent(new CustomEvent('lintelia:' + data.type, { bubbles: true, detail: { reference: data.reference } }));
    }
  });
})();
