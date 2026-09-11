/* Small shared bits: footer year, and the email sign-up form. */
(function () {
  'use strict';

  // Footer year
  Array.prototype.slice.call(document.querySelectorAll('[data-year]')).forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  // Expose the existing solutions navigation to supported assistant browsers.
  if (document.modelContext && document.modelContext.registerTool) {
    var lifecycle = new AbortController();
    try {
      Promise.resolve(document.modelContext.registerTool({
        name: 'open_book_solutions',
        description: 'Open an existing book solutions page selected from the visible links.',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false },
        annotations: { readOnlyHint: false },
        execute: function (input) {
          var links = Array.from(document.querySelectorAll('a[href]'));
          var link = links.find(function (a) {
            return a.getAttribute('href') === input.path && /^(\.\/)?(?:solutions[^/]*|5000|5000sols)\.html(?:#.*)?$/.test(input.path);
          });
          if (!link) { throw new Error('Choose an existing solutions link on this page.'); }
          link.click();
          return { navigatingTo: input.path };
        }
      }, { signal: lifecycle.signal })).catch(function () {});
      window.addEventListener('pagehide', function () { lifecycle.abort(); }, { once: true });
    } catch (error) { /* Ordinary website navigation remains available. */ }
  }

  var subscriptionTest = true;
  // Confirm only after durable storage.
  var form = document.getElementById('signup-form');
  if (!form) { return; }
  var unsubscribing = new URL(form.action, window.location.href).pathname.endsWith('/unsubscribe');
  var testEndpoint = 'https://subscription-server.cgp1975.chatgpt.site/api/lists/3c68e506-c7b2-4a19-afb3-fe9b72b33bf3';
  var note = document.getElementById('signup-note');
  var button = form.querySelector('button[type="submit"]');
  var successDialog = document.getElementById('subscription-success');
  if (successDialog) {
    successDialog.querySelector('[data-close-subscription]').addEventListener('click', function () {
      successDialog.close();
    });
    successDialog.addEventListener('click', function (event) {
      var bounds = successDialog.getBoundingClientRect();
      if (event.target === successDialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) {
        successDialog.close();
      }
    });
    successDialog.addEventListener('close', function () {
      document.documentElement.classList.remove('subscription-dialog-open');
      (button.disabled ? form.querySelector('[name="email"]') : button).focus();
    });
  }
  function updatePopup(state, message) {
    if (!successDialog) { return; }
    successDialog.querySelector('[data-subscription-spinner]').hidden = state !== 'saving';
    document.getElementById('subscription-success-title').textContent = state === 'saving' ? 'Saving…' : state === 'success' ? 'Thank you for subscribing' : 'Please try again';
    document.getElementById('subscription-success-description').textContent = message;
  }
  var busy = false;
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (busy || !form.reportValidity()) { return; }
    busy = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    note.hidden = false;
    note.classList.remove('error');
    note.textContent = 'Saving…';
    if (successDialog && typeof successDialog.showModal === 'function') {
      updatePopup('saving', 'Adding you to our book news and discounts list.');
      successDialog.showModal();
      document.documentElement.classList.add('subscription-dialog-open');
      note.hidden = true;
    }
    try {
      var data = new FormData(form);
      async function submitTo(url, external) {
        var response = await fetch(url, {
          method: 'POST',
          credentials: external ? 'omit' : 'same-origin',
          headers: external ? { 'Accept': 'application/json', 'Content-Type': 'application/json' } : { 'Accept': 'application/json' },
          body: external ? JSON.stringify({
            email: data.get('email'),
            consent: data.get('consent') === 'book-news-v1',
            website: data.get('_honey') || '',
          }) : new URLSearchParams(data),
          signal: AbortSignal.timeout(20000),
        });
        var result = await response.json();
        if (!response.ok) { throw new Error(result.error || 'We could not save that. Please try again.'); }
        return result;
      }
      var confirmation;
      if (unsubscribing) {
        // GitHub Pages has no backend: use the dedicated preview list for removal.
        var removals = await Promise.allSettled([
          submitTo(testEndpoint + '/unsubscribe', true),
        ]);
        if (removals.some(function (removal) { return removal.status === 'rejected'; })) {
          throw new Error('We could not confirm your unsubscribe request. Please try again; repeating this is safe.');
        }
        confirmation = 'If that address was subscribed, it has now been removed from this book mailing list.';
      } else {
        var result = await submitTo(subscriptionTest ? testEndpoint : form.action, subscriptionTest);
        confirmation = subscriptionTest ? 'You’re subscribed. We’ll keep you posted about Martin Littlewolf book news and discounts.' : result.message;
      }
      note.textContent = confirmation;
      form.reset();
      updatePopup('success', confirmation);
      note.hidden = Boolean(successDialog && successDialog.open);
    } catch (error) {
      note.textContent = error.name === 'TimeoutError' ? 'Saving took too long. Please try again.' : error instanceof TypeError ? (subscriptionTest ? 'We could not reach the subscription service. Please try again.' : 'We could not connect. Please try again when you are online.') : error.message;
      note.classList.add('error');
      updatePopup('error', note.textContent);
      note.hidden = Boolean(successDialog && successDialog.open);
    } finally {
      busy = false;
      button.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
})();
