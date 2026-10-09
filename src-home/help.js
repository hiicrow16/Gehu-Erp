/* Help centre: tabs, FAQ, order tracking, ticket form, cheat-notes terminal.
   Ported from the classic homepage; talks to the same backend endpoints. */

const API = () => window.API_BASE;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const authHeaders = () => {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "note";

export function initHelp(onLayoutChange) {
  const root = $("#help");
  if (!root) return;
  const changed = () => onLayoutChange && onLayoutChange();

  /* ---- tabs ---- */
  const tabs = $$(".h-tab", root), panels = $$(".h-panel", root);
  const activate = (name) => {
    tabs.forEach((t) => { const on = t.dataset.tab === name; t.classList.toggle("active", on); t.setAttribute("aria-selected", on); });
    panels.forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
    changed();
  };
  tabs.forEach((t) => t.addEventListener("click", () => activate(t.dataset.tab)));

  /* ---- FAQ ---- */
  $$(".faq-q", root).forEach((q) => {
    q.addEventListener("click", () => {
      const item = q.closest(".faq-i");
      const was = item.classList.contains("open");
      $$(".faq-i.open", root).forEach((i) => { i.classList.remove("open"); $(".faq-a", i).style.maxHeight = null; });
      if (!was) { item.classList.add("open"); const a = $(".faq-a", item); a.style.maxHeight = a.scrollHeight + "px"; }
      setTimeout(changed, 450);
    });
  });

  /* ---- track order ---- */
  const track = $("#trackOrderForm"), tr = $("#trackResult");
  if (track) track.addEventListener("submit", async (e) => {
    e.preventDefault();
    const orderId = $("#trackOrderId").value.trim(), studentId = $("#trackStudentId").value.trim();
    const btn = $("button[type=submit]", track);
    btn.disabled = true; btn.textContent = "Checking…";
    tr.className = "track-result"; tr.innerHTML = "";
    try {
      const r = await fetch(`${API()}/store/track?orderId=${encodeURIComponent(orderId)}&studentId=${encodeURIComponent(studentId)}`);
      const d = await r.json();
      if (!d.success) { tr.className = "track-result show error"; tr.textContent = d.message || "No matching order found."; }
      else {
        const o = d.order;
        const items = o.items.map((i) => `${esc(i.name)} ×${esc(i.quantity)}`).join(", ");
        tr.className = "track-result show";
        tr.innerHTML = `
          <div class="tr-row"><span>Order date</span><b>${esc(new Date(o.createdAt).toLocaleString())}</b></div>
          <div class="tr-row"><span>Total</span><b>₹${esc(o.totalAmount)}</b></div>
          <div class="tr-row"><span>Payment</span><b>${esc(o.paymentMethod)}</b></div>
          <div class="tr-row"><span>Payment status</span><b class="badge ${slug(o.paymentStatus)}">${esc(o.paymentStatus)}</b></div>
          <div class="tr-row"><span>Order status</span><b class="badge ${slug(o.status)}">${esc(o.status)}</b></div>
          <div class="tr-row"><span>Items</span><b>${items}</b></div>`;
      }
    } catch (err) {
      tr.className = "track-result show error"; tr.textContent = "Couldn't reach the server. Try again in a moment.";
    } finally { btn.disabled = false; btn.textContent = "Track order"; changed(); }
  });

  /* ---- ticket (Formspree) ---- */
  const tf = $("#ticketForm");
  if (tf) tf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#ticketMsg"), btn = $("#ticketSubmitBtn");
    msg.textContent = ""; btn.disabled = true; btn.textContent = "Submitting…";
    try {
      const r = await fetch(tf.action, { method: "POST", headers: { Accept: "application/json" }, body: new FormData(tf) });
      if (r.ok) { tf.style.display = "none"; $("#ticketSuccess").classList.add("open"); }
      else msg.textContent = "Couldn't submit right now. Please try again or email us directly.";
    } catch (err) { msg.textContent = "Couldn't reach the server. Please try again in a moment."; }
    finally { btn.disabled = false; btn.textContent = "Submit ticket"; changed(); }
  });

  /* ---- cheat notes terminal (public read, admin write) ---- */
  const wrap = $("#cheatTerminal");
  if (!wrap) return;
  const listEl = $("#termNotes"), searchEl = $("#termSearch"), newBtn = $("#termNewBtn"), badge = $("#termAdminBadge");
  const isAdmin = !!localStorage.getItem("token") && localStorage.getItem("role") === "admin";
  let notes = [], editingId = null, loaded = false;
  if (isAdmin) { newBtn.hidden = false; badge.hidden = false; }

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  async function api(path, opts = {}) {
    const res = await fetch(`${API()}/cheatnotes${path}`, { ...opts, headers: { "Content-Type": "application/json", ...authHeaders() } });
    let data = {}; try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (res.status === 401 || res.status === 403) throw new Error("Your admin session has expired. Please log in again.");
    if (!res.ok || !data.success) throw new Error(data.message || "Something went wrong.");
    return data;
  }

  function editor(note) {
    const box = el("div", "term-editor");
    box.append(el("label", "", "title"));
    const title = el("input"); title.maxLength = 80; title.placeholder = "e.g. git-basics"; title.value = note ? note.title : ""; box.append(title);
    box.append(el("label", "", "content"));
    const content = el("textarea"); content.maxLength = 5000; content.placeholder = "Write your note here…"; content.value = note ? note.content : ""; box.append(content);
    const err = el("div", "term-error"), act = el("div", "term-editor-actions");
    const save = el("button", "term-btn primary", "save"); save.type = "button";
    const cancel = el("button", "term-btn", "cancel"); cancel.type = "button";
    act.append(save, cancel, err); box.append(act);
    cancel.addEventListener("click", () => { editingId = null; render(); });
    save.addEventListener("click", async () => {
      err.textContent = "";
      if (!title.value.trim() || !content.value.trim()) { err.textContent = "Title and content are required."; return; }
      save.disabled = true; save.textContent = "saving…";
      try {
        const body = JSON.stringify({ title: title.value, content: content.value });
        if (note) await api(`/${note._id}`, { method: "PUT", body }); else await api("", { method: "POST", body });
        editingId = null; await load();
      } catch (e) { err.textContent = e.message; save.disabled = false; save.textContent = "save"; }
    });
    setTimeout(() => title.focus(), 0);
    return box;
  }

  function render() {
    listEl.textContent = "";
    const q = searchEl.value.trim().toLowerCase();
    if (isAdmin && editingId === "new") listEl.append(editor(null));
    const shown = notes.filter((n) => !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    if (!shown.length && editingId !== "new") {
      listEl.append(el("div", "term-dim", notes.length ? "grep: no matches found." : "(empty) — no notes yet."));
      changed(); return;
    }
    shown.forEach((n) => {
      if (isAdmin && editingId === n._id) { listEl.append(editor(n)); return; }
      const item = el("div", "term-note"), head = el("div", "term-note-head"), cmd = el("span", "term-cmd");
      cmd.append(el("span", "term-prompt", "$"), document.createTextNode(` cat ${slug(n.title)}.txt`));
      head.append(cmd);
      const copy = el("button", "term-btn", "copy"); copy.type = "button";
      copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(n.content); copy.textContent = "copied"; } catch (e) { copy.textContent = "failed"; }
        setTimeout(() => (copy.textContent = "copy"), 1200);
      });
      head.append(copy);
      if (isAdmin) {
        const edit = el("button", "term-btn", "edit"); edit.type = "button";
        edit.addEventListener("click", () => { editingId = n._id; render(); });
        const del = el("button", "term-btn danger", "delete"); del.type = "button";
        del.addEventListener("click", async () => {
          if (!confirm(`Delete "${n.title}"?`)) return;
          try { await api(`/${n._id}`, { method: "DELETE" }); await load(); } catch (e) { alert(e.message); }
        });
        head.append(edit, del);
      }
      item.append(head, el("pre", "term-note-body", n.content), el("div", "term-note-meta", `# ${n.title} · updated ${fmt(n.updatedAt || n.createdAt)}`));
      listEl.append(item);
    });
    changed();
  }

  async function load() {
    try {
      const r = await fetch(`${API()}/cheatnotes`); const d = await r.json();
      if (!d.success) throw new Error();
      notes = d.notes; loaded = true; render();
    } catch (e) {
      listEl.textContent = "";
      listEl.append(el("div", "term-dim", "error: can't reach the server. It may be waking up — try again in a moment."));
      changed();
    }
  }
  searchEl.addEventListener("input", render);
  newBtn.addEventListener("click", () => { editingId = "new"; searchEl.value = ""; render(); });
  // load notes only when the tab is first opened (backend may be cold-starting)
  tabs.forEach((t) => t.dataset.tab === "notes" && t.addEventListener("click", () => { if (!loaded) load(); }, { once: true }));
}
