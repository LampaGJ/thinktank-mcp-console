// e8-console-port (#34): instance-selectable demo chat console. Generalizes
// the reference repo's single-org backend resolution (fixed base()/
// localStorage token tied to one deployment) into a backend-URL-from-URL-
// param mechanism — no backend URL hardcoded in this shipped file, per
// CLAUDE.md's core/instance split applied at the UI level.
(function () {
  "use strict";

  const STORAGE_KEY = "thinktank-mcp.server";

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

  async function askBackend(backendUrl, question) {
    const response = await fetch(`${backendUrl.replace(/\/$/, "")}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Backend returned ${response.status}: ${body}`);
    }

    return response.json();
  }

  function init() {
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
        const result = await askBackend(backendUrl, question);
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
