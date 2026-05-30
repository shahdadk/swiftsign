/**
 * SwiftSign embedded signing snippet.
 *
 * Usage:
 *   <script src="https://app.swiftsign.dev/embed.js"></script>
 *   <div id="sign"></div>
 *   <script>
 *     SwiftSign.embed({
 *       url: "https://app.swiftsign.dev/embed/<token>",
 *       container: "#sign",
 *       onComplete: function (data) {
 *         console.log("signed envelope", data.envelopeId);
 *       },
 *     });
 *   </script>
 */
(function () {
  function resolve(container) {
    if (typeof container === 'string') return document.querySelector(container);
    return container;
  }

  function embed(opts) {
    opts = opts || {};
    var el = resolve(opts.container);
    if (!el) throw new Error('SwiftSign.embed: container not found');
    if (!opts.url) throw new Error('SwiftSign.embed: url is required');

    var iframe = document.createElement('iframe');
    iframe.src = opts.url;
    iframe.allow = 'clipboard-write';
    iframe.style.border = '0';
    iframe.style.width = '100%';
    iframe.style.height = opts.height || '720px';
    iframe.setAttribute('title', 'SwiftSign');

    var origin;
    try {
      origin = new URL(opts.url).origin;
    } catch (e) {
      origin = null;
    }

    function onMessage(event) {
      if (origin && event.origin !== origin) return;
      var data = event.data;
      if (!data || data.type !== 'swiftsign:completed') return;
      window.removeEventListener('message', onMessage);
      if (typeof opts.onComplete === 'function') {
        opts.onComplete({ envelopeId: data.envelopeId });
      }
    }

    window.addEventListener('message', onMessage);
    el.innerHTML = '';
    el.appendChild(iframe);
    return iframe;
  }

  window.SwiftSign = window.SwiftSign || {};
  window.SwiftSign.embed = embed;
})();
