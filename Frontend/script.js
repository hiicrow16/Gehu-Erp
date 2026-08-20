// Requires config.js to be loaded first (defines window.API_BASE)
const API = window.API_BASE;

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     NAVBAR SHRINK ON SCROLL
  ========================== */
  const topNav = document.getElementById("topNav");
  if (topNav) {
    window.addEventListener("scroll", () => {
      topNav.classList.toggle("scrolled", window.scrollY > 30);
    }, { passive: true });
  }

  /* =========================
     MOBILE NAV TOGGLE
  ========================== */
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      navToggle.classList.toggle("open");
      navLinks.classList.toggle("open");
    });

    navLinks.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        navToggle.classList.remove("open");
        navLinks.classList.remove("open");
      });
    });
  }

  /* =========================
     NAVBAR LOGIN DROPDOWN (home page quick-login panel)
  ========================== */
  const studentBtn = document.getElementById("studentBtn");
  const loginPanel = document.getElementById("loginPanel");

  if (studentBtn && loginPanel) {
    studentBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = loginPanel.style.display === "block";
      loginPanel.style.display = isOpen ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
      if (!loginPanel.contains(e.target) && e.target !== studentBtn) {
        loginPanel.style.display = "none";
      }
    });
  }

  // The navbar panel is a shortcut into the real login page rather than a
  // second login form, so credentials are only ever submitted from login.html.
  const homeLoginBtn = document.getElementById("homeLoginBtn");
  if (homeLoginBtn) {
    homeLoginBtn.addEventListener("click", () => {
      window.location.href = "login.html";
    });
  }

  /* =========================
     SCROLL REVEAL ANIMATIONS
  ========================== */
  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add("in"));
  }

  /* =========================
     ANIMATED STAT COUNTERS
  ========================== */
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length && "IntersectionObserver" in window) {
    const counterIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.getAttribute("data-count"), 10);
        const suffix = el.getAttribute("data-suffix") || "";
        const duration = 1400;
        const start = performance.now();

        function tick(now) {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(eased * target).toLocaleString() + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        counterIO.unobserve(el);
      });
    }, { threshold: 0.5 });

    counters.forEach(el => counterIO.observe(el));
  }

  /* =========================
     LOGIN FORM (login.html) — real backend auth
  ========================== */
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();
      const msg = document.getElementById("loginMessage");
      const submitBtn = loginForm.querySelector("button[type='submit']");

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Signing in…"; }
      if (msg) msg.textContent = "";

      try {
        const res = await fetch(`${API}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (data.success) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("role", data.role);
          localStorage.setItem("username", data.username);
          if (data.profile && data.profile._id) {
            localStorage.setItem("profileId", data.profile._id);
          }

          if (data.role === "student") {
            window.location.href = "student-dashboard.html";
          } else if (data.role === "admin") {
            window.location.href = "admin-dashboard.html";
          } else if (data.role === "faculty") {
            // Faculty dashboard UI isn't built yet — see README "Next phases".
            if (msg) msg.textContent = "Faculty login succeeded, but the faculty dashboard page isn't built yet.";
          }
        } else if (msg) {
          msg.textContent = data.message || "Login failed.";
        }
      } catch (error) {
        if (msg) msg.textContent = "Can't reach the backend. Check config.js API_BASE and that the server is running.";
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Login"; }
      }
    });
  }

  /* =========================
     LOAD DATA ON STUDENT DASHBOARD
  ========================== */
  const profileId = localStorage.getItem("profileId");
  if (profileId && localStorage.getItem("role") === "student") {
    loadStudentAttendance(profileId);
    loadCourses();
  }

  /* =========================
     SHOW ATTENDANCE SECTION
  ========================== */
  window.showAttendance = function () {
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    const sec = document.getElementById("attendanceSection");
    if (sec) sec.classList.add("active");
  };

  /* =========================
     MARK ATTENDANCE (faculty-only endpoint; needs a logged-in faculty token)
  ========================== */
  window.markAttendance = async function () {
    const student = document.getElementById("attStudentId").value;
    const subjectField = document.getElementById("attSubjectId");
    const subject = subjectField ? subjectField.value : null;
    const date = document.getElementById("attDate").value;
    const status = document.getElementById("attStatus").value;

    if (!student || !subject || !date) {
      alert("Fill all fields (student, subject, date)");
      return;
    }

    const res = await fetch(`${API}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ student, subject, date, status })
    });

    if (res.ok) {
      alert("Attendance marked successfully");
      viewAttendance(student);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "Could not mark attendance");
    }
  };

  /* =========================
     APPLY FORM (apply.html) — static, submits via Formspree, no backend
  ========================== */
  const applyForm = document.getElementById("applyForm");
  if (applyForm) {
    applyForm.addEventListener("submit", () => {
      const btn = applyForm.querySelector("button[type='submit']");
      if (btn) {
        btn.textContent = "Submitting…";
        btn.disabled = true;
      }
    });
  }

  /* =========================
     TRACK YOUR ORDER (index.html - Help & Support)
  ========================== */
  const trackForm = document.getElementById("trackOrderForm");
  if (trackForm) {
    const resultBox = document.getElementById("trackResult");

    const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");

    trackForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const orderId = document.getElementById("trackOrderId").value.trim();
      const studentId = document.getElementById("trackStudentId").value.trim();
      const btn = trackForm.querySelector("button[type='submit']");

      if (btn) { btn.disabled = true; btn.textContent = "Checking…"; }
      resultBox.className = "track-result hidden";
      resultBox.innerHTML = "";

      try {
        const res = await fetch(`${API}/store/track?orderId=${encodeURIComponent(orderId)}&studentId=${encodeURIComponent(studentId)}`);
        const data = await res.json();

        if (!data.success) {
          resultBox.className = "track-result error";
          resultBox.textContent = data.message || "No matching order found.";
        } else {
          const o = data.order;
          const itemsList = o.items.map(i => `${i.name} x${i.quantity}`).join(", ");
          const dateStr = new Date(o.createdAt).toLocaleString();

          resultBox.className = "track-result";
          resultBox.innerHTML = `
            <div class="track-row"><span>Order Date</span><span>${dateStr}</span></div>
            <div class="track-row"><span>Total</span><span>₹${o.totalAmount}</span></div>
            <div class="track-row"><span>Payment</span><span>${o.paymentMethod}</span></div>
            <div class="track-row"><span>Payment Status</span><span class="track-badge ${slug(o.paymentStatus)}">${o.paymentStatus}</span></div>
            <div class="track-row"><span>Order Status</span><span class="track-badge ${slug(o.status)}">${o.status}</span></div>
            <div class="track-row track-items"><span>Items</span><span>${itemsList}</span></div>
          `;
        }
      } catch (err) {
        resultBox.className = "track-result error";
        resultBox.textContent = "Couldn't reach the server. Try again in a moment.";
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Track Order"; }
      }
    });
  }

});

/* =========================
   LOAD LOGGED-IN STUDENT'S OWN COURSE + SUBJECTS (database-driven)
========================== */
async function loadCourses() {
  try {
    const meRes = await fetch(`${API}/students/me`, { headers: authHeaders() });
    const meData = await meRes.json();

    const container = document.getElementById("coursesContainer");
    if (!container) return;

    if (!meData.success || !meData.student || !meData.student.course) {
      container.innerHTML = "<p>No course assigned yet</p>";
      return;
    }

    const course = meData.student.course;
    const semester = meData.student.semester;

    const subjectsRes = await fetch(
      `${API}/subjects?course=${course._id}${semester ? `&semester=${semester}` : ""}`,
      { headers: authHeaders() }
    );
    const subjectsData = await subjectsRes.json();
    const subjects = subjectsData.success ? subjectsData.subjects : [];

    container.innerHTML = "";
    const card = document.createElement("div");
    card.className = "course-card";

    const list = subjects.length
      ? subjects.map(s => `<li>${s.name}</li>`).join("")
      : "<li>No subjects added for this semester yet</li>";

    card.innerHTML = `<h3>${course.name}</h3><ul>${list}</ul>`;
    container.appendChild(card);
  } catch (err) {
    console.log("Course load error", err);
  }
}

/* =========================
   STUDENT ATTENDANCE SUMMARY
========================== */
async function loadStudentAttendance(profileId) {
  try {
    const res = await fetch(`${API}/attendance/student/${profileId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) return;

    const percent = data.summary.percentage;
    const card = document.getElementById("attPercent");
    if (card) {
      card.innerText = percent + "%";
      card.style.color = percent >= 75 ? "#00ff88" : "#ff4d6d";
    }
  } catch (err) {
    console.log("Attendance load error", err);
  }
}

/* =========================
   VIEW ATTENDANCE (detailed table)
========================== */
async function viewAttendance(profileId) {
  if (typeof showAttendance === "function") showAttendance();

  const res = await fetch(`${API}/attendance/student/${profileId}`, { headers: authHeaders() });
  const data = await res.json();

  const tableBody = document.querySelector("#attendanceTable tbody");
  const percentageEl = document.getElementById("percentage");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  if (!data.success || !data.records || data.records.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="2">No Data</td></tr>`;
    if (percentageEl) percentageEl.innerText = "";
    return;
  }

  data.records.forEach(record => {
    const dateStr = new Date(record.date).toLocaleDateString();
    tableBody.innerHTML += `
      <tr>
        <td>${dateStr}</td>
        <td style="color:${record.status === 'Present' ? '#00ff88' : '#ff4d6d'}">
          ${record.status}
        </td>
      </tr>
    `;
  });

  if (percentageEl) {
    percentageEl.innerText = `Attendance: ${data.summary.percentage}%`;
  }

  localStorage.setItem("currentStudentProfileId", profileId);
}

/* =========================
   FILTER (re-fetches, then filters client-side)
========================== */
async function applyFilter() {
  const profileId = localStorage.getItem("currentStudentProfileId");
  const filterEl = document.getElementById("filterStatus");
  if (!profileId || !filterEl) return;

  const filter = filterEl.value;
  const res = await fetch(`${API}/attendance/student/${profileId}`, { headers: authHeaders() });
  const data = await res.json();
  if (!data.success) return;

  const tableBody = document.querySelector("#attendanceTable tbody");
  if (!tableBody) return;

  tableBody.innerHTML = "";
  data.records.forEach(record => {
    if (filter === "All" || record.status === filter) {
      const dateStr = new Date(record.date).toLocaleDateString();
      tableBody.innerHTML += `
        <tr>
          <td>${dateStr}</td>
          <td style="color:${record.status === 'Present' ? '#00ff88' : '#ff4d6d'}">
            ${record.status}
          </td>
        </tr>
      `;
    }
  });
}

/* ============
   SPOTIFY
============= */
function getPlaylistByTime() {
  const hour = new Date().getHours();
  if (hour < 12) return "37i9dQZF1DX8NTLI2TtZa6";
  if (hour < 18) return "37i9dQZF1DX3PFzdbtx1Us";
  return "37i9dQZF1DX4WYpdgoIcn6";
}
function loadPlaylist() {
  const playlistId = getPlaylistByTime();
  const frame = document.getElementById("spotifyFrame");
  if (frame) frame.src = `https://open.spotify.com/embed/playlist/${playlistId}`;
}
loadPlaylist();

window.logout = function () {
  localStorage.clear();
  window.location.href = "login.html";
};

/* ============================================================
   COLLEGE STORE (public — front page, no login required)
   ============================================================ */

// Fallback copy in case the backend is unreachable (e.g. cold-starting on
// Render). The real catalog is fetched from `${API}/store/items`, which is
// also the source of truth the backend uses to validate orders.
const STORE_FALLBACK_PRODUCTS = [
  { id: "uni-blazer",  name: "College Blazer",        category: "Dress",      price: 1499, icon: "🧥", stock: 40 },
  { id: "uni-tie",     name: "GEHU Tie",               category: "Dress",      price: 199,  icon: "👔", stock: 100 },
  { id: "uni-shirt",   name: "Formal Shirt (White)",   category: "Dress",      price: 599,  icon: "👕", stock: 80 },
  { id: "uni-id",      name: "ID Card Lanyard",        category: "Dress",      price: 99,   icon: "🪪", stock: 200 },
  { id: "st-notebook", name: "Ruled Notebook (200pg)", category: "Stationery", price: 60,   icon: "📓", stock: 300 },
  { id: "st-fileset",  name: "File Folder Set (5pc)",  category: "Stationery", price: 150,  icon: "🗂️", stock: 120 },
  { id: "st-calc",     name: "Scientific Calculator",  category: "Stationery", price: 899,  icon: "🧮", stock: 35 },
  { id: "st-geo",      name: "Geometry Box",           category: "Stationery", price: 220,  icon: "📐", stock: 60 },
  { id: "pen-blue",    name: "Blue Ball Pen (Pack of 5)",   category: "Pens", price: 75,   icon: "🖊️", stock: 250 },
  { id: "pen-gel",     name: "Premium Gel Pen",             category: "Pens", price: 40,   icon: "✒️", stock: 150 },
  { id: "pen-highlight", name: "Highlighter Set (4 colors)", category: "Pens", price: 130, icon: "🖍️", stock: 90 },
  { id: "bk-firstyear", name: "1st Year Core Book Set", category: "Books", price: 2499, icon: "📚", stock: 25 },
  { id: "bk-labmanual",  name: "Lab Manual (Semester)",  category: "Books", price: 249,  icon: "📗", stock: 70 },
  { id: "bk-referenceguide", name: "Reference Guide",    category: "Books", price: 399,  icon: "📘", stock: 45 },
  { id: "cl-hoodie",  name: "GEHU Hoodie",           category: "Clothes", price: 999, icon: "🧶", stock: 50 },
  { id: "cl-tshirt",  name: "GEHU T-Shirt",          category: "Clothes", price: 449, icon: "👚", stock: 90 },
  { id: "cl-cap",     name: "Campus Cap",             category: "Clothes", price: 249, icon: "🧢", stock: 65 },
];

// Icons aren't stored server-side (catalog there is price/stock only), so we
// map them back on by product id once we have the live list.
const STORE_ICONS = STORE_FALLBACK_PRODUCTS.reduce((map, p) => {
  map[p.id] = p.icon;
  return map;
}, {});

const STORE_CATEGORIES = ["All", "Dress", "Stationery", "Pens", "Books", "Clothes"];
let storeProducts = [];
let storeActiveCategory = "All";

async function loadStoreProducts() {
  const grid = document.getElementById("storeGrid");
  if (!grid) return; // store section isn't on this page

  try {
    const res = await fetch(`${API}/store/items`);
    const data = await res.json();
    storeProducts = data.success && data.items.length
      ? data.items.map(p => ({ ...p, icon: STORE_ICONS[p.id] || "🛍️" }))
      : STORE_FALLBACK_PRODUCTS;
  } catch (err) {
    storeProducts = STORE_FALLBACK_PRODUCTS;
  }

  renderStoreFilters();
  renderStoreProducts();
}

function getStoreCart() {
  return JSON.parse(localStorage.getItem("storeCart") || "{}");
}
function saveStoreCart(cart) {
  localStorage.setItem("storeCart", JSON.stringify(cart));
  const countEl = document.getElementById("storeCartCount");
  if (countEl) {
    const count = Object.values(cart).reduce((sum, q) => sum + q, 0);
    countEl.innerText = count;
  }
}

function addToStoreCart(productId) {
  const cart = getStoreCart();
  cart[productId] = (cart[productId] || 0) + 1;
  saveStoreCart(cart);
}

function changeStoreQty(productId, delta) {
  const cart = getStoreCart();
  cart[productId] = (cart[productId] || 0) + delta;
  if (cart[productId] <= 0) delete cart[productId];
  saveStoreCart(cart);
  renderStoreCartItems();
}

function removeFromStoreCart(productId) {
  const cart = getStoreCart();
  delete cart[productId];
  saveStoreCart(cart);
  renderStoreCartItems();
}

function renderStoreFilters() {
  const bar = document.getElementById("storeFilterBar");
  if (!bar) return;
  bar.innerHTML = "";
  STORE_CATEGORIES.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "store-filter-btn" + (cat === storeActiveCategory ? " active" : "");
    btn.innerText = cat;
    btn.onclick = () => { storeActiveCategory = cat; renderStoreProducts(); renderStoreFilters(); };
    bar.appendChild(btn);
  });
}

function renderStoreProducts() {
  const grid = document.getElementById("storeGrid");
  const searchEl = document.getElementById("storeSearch");
  if (!grid) return;
  const search = searchEl ? searchEl.value.trim().toLowerCase() : "";

  const filtered = storeProducts.filter(p => {
    const matchesCategory = storeActiveCategory === "All" || p.category === storeActiveCategory;
    const matchesSearch = !search || p.name.toLowerCase().includes(search);
    return matchesCategory && matchesSearch;
  });

  grid.innerHTML = "";
  if (!filtered.length) {
    grid.innerHTML = `<div class="store-empty-note">No items match your search.</div>`;
    return;
  }

  filtered.forEach(p => {
    const outOfStock = p.stock <= 0;
    const card = document.createElement("div");
    card.className = "store-product-card";
    card.innerHTML = `
      <div class="store-product-icon">${p.icon || "🛍️"}</div>
      <div class="cat-tag">${p.category}</div>
      <h4>${p.name}</h4>
      <div class="store-price">₹${p.price}</div>
      <div class="store-stock-note">${outOfStock ? "Out of stock" : p.stock + " in stock"}</div>
      <button class="store-add-btn" ${outOfStock ? "disabled" : ""} onclick="addToStoreCart('${p.id}')">
        ${outOfStock ? "Unavailable" : "Add to Cart"}
      </button>
    `;
    grid.appendChild(card);
  });
}

function openStoreCart() {
  renderStoreCartItems();
  document.getElementById("storeCartDrawer").classList.add("open");
  document.getElementById("storeOverlay").classList.add("open");
}
function closeStoreCart() {
  document.getElementById("storeCartDrawer").classList.remove("open");
  document.getElementById("storeOverlay").classList.remove("open");
}

function renderStoreCartItems() {
  const cart = getStoreCart();
  const container = document.getElementById("storeCartItems");
  if (!container) return;
  const ids = Object.keys(cart);

  if (!ids.length) {
    container.innerHTML = `<div class="store-cart-empty">Your cart is empty</div>`;
    document.getElementById("storeCartTotal").innerText = "₹0";
    return;
  }

  container.innerHTML = "";
  let total = 0;

  ids.forEach(id => {
    const product = storeProducts.find(p => p.id === id);
    if (!product) return;
    const qty = cart[id];
    const lineTotal = product.price * qty;
    total += lineTotal;

    const row = document.createElement("div");
    row.className = "store-cart-item";
    row.innerHTML = `
      <div class="info">
        <h5>${product.icon || "🛍️"} ${product.name}</h5>
        <span>₹${product.price} x ${qty} = ₹${lineTotal}</span>
      </div>
      <div class="store-qty-controls">
        <button onclick="changeStoreQty('${id}', -1)">-</button>
        <span>${qty}</span>
        <button onclick="changeStoreQty('${id}', 1)">+</button>
        <button class="store-remove-btn" onclick="removeFromStoreCart('${id}')">Remove</button>
      </div>
    `;
    container.appendChild(row);
  });

  document.getElementById("storeCartTotal").innerText = `₹${total}`;
}

/* ---------- CHECKOUT MODAL ---------- */
function openCheckoutForm() {
  const cart = getStoreCart();
  if (!Object.keys(cart).length) return;

  closeStoreCart();
  document.getElementById("checkoutForm").style.display = "flex";
  document.getElementById("checkoutSuccess").classList.remove("open");
  document.getElementById("checkoutMsg").textContent = "";
  document.getElementById("checkoutModal").classList.add("open");
  document.getElementById("checkoutOverlay").classList.add("open");
  updateStorePaymentUI();
}
function closeCheckoutForm() {
  document.getElementById("checkoutModal").classList.remove("open");
  document.getElementById("checkoutOverlay").classList.remove("open");
}

function getSelectedPaymentMethod() {
  const checked = document.querySelector('input[name="paymentMethod"]:checked');
  return checked ? checked.value : "UPI";
}

function updateStorePaymentUI() {
  const upiBox = document.getElementById("storeUpiBox");
  const transactionInput = document.getElementById("cf-transactionref");
  if (!upiBox) return;
  const isUpi = getSelectedPaymentMethod() === "UPI";
  upiBox.classList.toggle("open", isUpi);
  if (transactionInput) transactionInput.required = isUpi;
}

function initCheckoutForm() {
  const form = document.getElementById("checkoutForm");
  if (!form) return;

  document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
    radio.addEventListener("change", updateStorePaymentUI);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("checkoutMsg");
    const submitBtn = document.getElementById("checkoutSubmitBtn");
    msg.textContent = "";

    const cart = getStoreCart();
    const items = Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity }));

    if (!items.length) {
      msg.textContent = "Your cart is empty.";
      return;
    }

    const paymentMethod = getSelectedPaymentMethod();
    const transactionRef = document.getElementById("cf-transactionref").value.trim();

    const body = {
      customerName: document.getElementById("cf-name").value.trim(),
      email: document.getElementById("cf-email").value.trim(),
      phone: document.getElementById("cf-phone").value.trim(),
      studentId: document.getElementById("cf-studentid").value.trim(),
      address: document.getElementById("cf-address").value.trim(),
      items,
      paymentMethod,
      transactionRef,
    };

    if (!body.customerName || !body.email || !body.phone || !body.address) {
      msg.textContent = "Please fill in all required fields.";
      return;
    }

    if (paymentMethod === "UPI" && !transactionRef) {
      msg.textContent = "Enter your UPI transaction/reference ID after paying.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Placing order…";

    try {
      const res = await fetch(`${API}/store/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.removeItem("storeCart");
        saveStoreCart({});
        form.reset();
        form.style.display = "none";
        updateStorePaymentUI();
        document.getElementById("checkoutSuccess").classList.add("open");
      } else {
        msg.textContent = data.message || "Could not place order. Please try again.";
      }
    } catch (err) {
      msg.textContent = "Can't reach the backend right now. Please try again in a moment.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Place Order";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadStoreProducts();
  initCheckoutForm();
  saveStoreCart(getStoreCart()); // sync the cart count badge on page load

  const storeSearchEl = document.getElementById("storeSearch");
  if (storeSearchEl) storeSearchEl.addEventListener("input", renderStoreProducts);
});
