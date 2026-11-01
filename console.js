// e8-console-port (#34): instance-selectable demo chat console. Generalizes
// the reference repo's single-org backend resolution (fixed base()/
// localStorage token tied to one deployment) into a backend-URL-from-URL-
// param mechanism — no backend URL hardcoded in this shipped file, per
// CLAUDE.md's core/instance split applied at the UI level.
//
// #239: a server published at a public address guards /ask with a bearer token. The maintainer's
// link carries the token in its `#` fragment (`...?server=<url>#token=<token>`), which the browser
// never sends to the page's host. The token goes into sessionStorage (never localStorage, so it ends
// with the tab), the fragment is removed from the address bar, and the token rides on the /ask call
// as `Authorization: Bearer`. It is never logged and never put in an error message.
(function () {
  "use strict";

  const STORAGE_KEY = "thinktank-mcp.server";
  const TOKEN_STORAGE_KEY = "thinktank-mcp.token";
  const TOKEN_NEEDED_MESSAGE = "This link needs its access token, so ask whoever sent it for the full link.";

  const elements = {
    statusDot: document.getElementById("status-dot"),
    statusText: document.getElementById("status-text"),
    backendBanner: document.getElementById("backend-banner"),
    messages: document.getElementById("messages"),
    form: document.getElementById("ask-form"),
    input: document.getElementById("question-input"),
    submitButton: document.getElementById("submit-button"),
  };

  // A ?server= override is persisted and later used as a fetch() base, so only
  // http(s) URLs are accepted. Anything else (javascript:, data:, file:, a
  // string that does not parse as a URL) is ignored and the previously stored
  // backend, if any, stays in force.
  function isHttpUrl(value) {
    try {
      const { protocol } = new URL(value);
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }

  function resolveBackendUrl() {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get("server");
    if (fromParam && isHttpUrl(fromParam)) {
      try {
        window.localStorage.setItem(STORAGE_KEY, fromParam);
      } catch {
        // localStorage can throw in a private window; the in-memory value
        // from the URL param still works for this page load.
      }
      return fromParam;
    }
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  // Reads one `name=value` pair from the fragment. Split by hand rather than with URLSearchParams,
  // which would turn a "+" in a token into a space.
  function fragmentParam(name) {
    for (const pair of window.location.hash.replace(/^#/, "").split("&")) {
      const at = pair.indexOf("=");
      if (at > 0 && pair.slice(0, at) === name) {
        const raw = pair.slice(at + 1);
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw;
        }
      }
    }
    return null;
  }

  // A `#token=` in the address wins and replaces what the tab held; otherwise the tab's own
  // sessionStorage copy is used, so a reload keeps working after the fragment is gone. Once read,
  // the fragment is removed so the token is not left in the visible URL or in history.
  function resolveAccessToken() {
    const fromFragment = fragmentParam("token");
    if (fromFragment) {
      try {
        window.sessionStorage.setItem(TOKEN_STORAGE_KEY, fromFragment);
      } catch {
        // sessionStorage can throw in a private window; the in-memory value still works for this page load.
      }
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return fromFragment;
    }
    try {
      return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function setStatus(state, text) {
    elements.statusDot.classList.remove("is-ready", "is-error");
    if (state === "ready") elements.statusDot.classList.add("is-ready");
    if (state === "error") elements.statusDot.classList.add("is-error");
    elements.statusText.textContent = text;
  }

  function appendMessage(role, text, meta) {
    const el = document.createElement("div");
    el.className = `message message--${role}`;
    el.textContent = text;
    if (meta) {
      const metaEl = document.createElement("div");
      metaEl.className = "message__meta";
      metaEl.textContent = meta;
      el.appendChild(metaEl);
    }
    elements.messages.appendChild(el);
    elements.messages.scrollTop = elements.messages.scrollHeight;
    return el;
  }

  async function askBackend(backendUrl, question, accessToken) {
    const headers = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetch(`${backendUrl.replace(/\/$/, "")}/ask`, {
      method: "POST",
      headers,
      body: JSON.stringify({ question }),
    });

    // The server answers 401 with a fixed body. Say what is missing in one sentence; the message
    // never carries the token or the response body.
    if (response.status === 401) {
      throw new Error(TOKEN_NEEDED_MESSAGE);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Backend returned ${response.status}: ${body}`);
    }

    return response.json();
  }

  function init() {
    const accessToken = resolveAccessToken();
    const backendUrl = resolveBackendUrl();

    if (!backendUrl) {
      elements.backendBanner.hidden = false;
      setStatus("error", "No backend configured");
      elements.input.disabled = true;
      elements.submitButton.disabled = true;
      return;
    }

    elements.backendBanner.hidden = true;
    setStatus("ready", backendUrl);

    elements.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const question = elements.input.value.trim();
      if (!question) return;

      appendMessage("user", question);
      elements.input.value = "";
      elements.input.disabled = true;
      elements.submitButton.disabled = true;

      const pending = appendMessage("agent", "Thinking...");
      pending.classList.add("message--pending");

      try {
        const result = await askBackend(backendUrl, question, accessToken);
        pending.remove();
        appendMessage(
          "agent",
          result.answer,
          `${result.toolCallCount} tool call(s), ${result.iterations} iteration(s)`,
        );
        setStatus("ready", backendUrl);
      } catch (err) {
        pending.remove();
        appendMessage("error", err instanceof Error ? err.message : String(err));
        setStatus("error", backendUrl);
      } finally {
        elements.input.disabled = false;
        elements.submitButton.disabled = false;
        elements.input.focus();
      }
    });
  }

  init();
})();
