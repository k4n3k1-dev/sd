const BASE_URL = "https://gut-vsj7.onrender.com";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(BASE_URL + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `show ${type}`;
  setTimeout(() => (el.className = ""), 3000);
}

function logout() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────

document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const username = document.getElementById("userInput").value.toLowerCase().trim();
  if (!username) { toast("Enter your username", "error"); return; }

  try {
    const data = await apiFetch("/login", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
    sessionStorage.setItem("username", data.username);
    sessionStorage.setItem("role", data.role);

    const routes = {
      admin:   "dashboard_admin.html",
      vendor:  "dashboard_vendor.html",
      student: "dashboard_student.html",
    };
    window.location.href = routes[data.role] || "index.html";
  } catch {
    toast("Invalid user", "error");
  }
});

// ── STUDENT: MENU + CART ──────────────────────────────────────────────────────

let cart = [];

async function loadMenu() {
  const container = document.getElementById("menuContainer");
  if (!container) return;

  try {
    const menu = await apiFetch("/menu");
    if (!menu.length) {
      container.innerHTML = "<p style='color:var(--muted)'>No menu available yet.</p>";
      return;
    }

    container.innerHTML = menu.flatMap(vendor =>
      vendor.items.map(item => `
        <div class="menu-item ${item.soldOut ? "sold-out" : ""}">
          <div class="item-name">${item.name}</div>
          <div class="item-price">R${item.price}</div>
          ${item.soldOut
            ? '<span class="badge">Sold Out</span>'
            : `<button class="btn btn-primary btn-sm"
                onclick="addToCart('${vendor.vendor}', '${item.name}', ${item.price})">
                + Add to Cart
              </button>`
          }
        </div>`)
    ).join("");
  } catch {
    container.innerHTML = "<p style='color:var(--danger)'>Failed to load menu.</p>";
  }
}

function addToCart(vendor, name, price) {
  cart.push({ vendor, name, price });
  renderCart();
  toast(`${name} added to cart`);
}

function removeFromCart(idx) {
  cart.splice(idx, 1);
  renderCart();
}

function renderCart() {
  const panel = document.getElementById("cartPanel");
  const items = document.getElementById("cartItems");
  const total = document.getElementById("cartTotal");
  if (!panel) return;

  if (!cart.length) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "block";
  items.innerHTML = cart.map((i, idx) => `
    <div style="display:flex;justify-content:space-between;align-items:center;
                padding:0.5rem 0;border-bottom:1px solid #e5e7eb;">
      <span>${i.name}</span>
      <span style="display:flex;align-items:center;gap:0.75rem;">
        R${i.price}
        <button class="btn btn-danger btn-sm" onclick="removeFromCart(${idx})">✕</button>
      </span>
    </div>`).join("");

  total.textContent = "R" + cart.reduce((s, i) => s + i.price, 0);
}

async function placeOrder() {
  if (!cart.length) { toast("Your cart is empty", "error"); return; }

  const student = sessionStorage.getItem("username");
  const vendor  = cart[0].vendor;

  try {
    await apiFetch("/orders", {
      method: "POST",
      body: JSON.stringify({ student, vendor, items: cart }),
    });
    toast("Order placed! 🎉");
    cart = [];
    renderCart();
  } catch {
    toast("Failed to place order", "error");
  }
}

// ── VENDOR: MENU MANAGEMENT ───────────────────────────────────────────────────

async function loadVendorMenu() {
  const container = document.getElementById("vendorMenu");
  if (!container) return;

  try {
    const menu   = await apiFetch("/menu");
    const vendor = sessionStorage.getItem("username");
    const mine   = menu.find(m => m.vendor === vendor);

    if (!mine || !mine.items.length) {
      container.innerHTML = "<p style='color:var(--muted)'>No items yet. Add one above.</p>";
      return;
    }

    container.innerHTML = mine.items.map(item => `
      <div class="menu-item ${item.soldOut ? "sold-out" : ""}">
        <div class="item-name">${item.name}</div>
        <div class="item-price">R${item.price}</div>
        ${item.soldOut ? '<span class="badge">Sold Out</span>' : ""}
        <div class="item-actions">
          <button class="btn btn-sm"
            style="background:var(--teal-light);color:var(--teal-dark)"
            onclick="toggleSoldOut('${item.name}', ${!item.soldOut})">
            ${item.soldOut ? "Mark Available" : "Mark Sold Out"}
          </button>
          <button class="btn btn-danger btn-sm"
            onclick="deleteMenuItem('${item.name}')">Delete</button>
        </div>
      </div>`).join("");
  } catch {
    container.innerHTML = "<p style='color:var(--danger)'>Failed to load menu.</p>";
  }
}

async function addMenuItem() {
  const nameEl  = document.getElementById("itemName");
  const priceEl = document.getElementById("itemPrice");
  const name    = nameEl?.value.trim();
  const price   = Number(priceEl?.value);
  const vendor  = sessionStorage.getItem("username");

  if (!name || !price) { toast("Fill in both fields", "error"); return; }

  try {
    await apiFetch("/menu", {
      method: "POST",
      body: JSON.stringify({ vendor, name, price }),
    });
    toast("Item added!");
    nameEl.value  = "";
    priceEl.value = "";
    loadVendorMenu();
  } catch {
    toast("Failed to add item", "error");
  }
}

async function toggleSoldOut(itemName, soldOut) {
  const vendor = sessionStorage.getItem("username");
  try {
    await apiFetch(`/menu/${vendor}/${encodeURIComponent(itemName)}`, {
      method: "PUT",
      body: JSON.stringify({ soldOut }),
    });
    toast(soldOut ? "Marked as sold out" : "Item available again");
    loadVendorMenu();
  } catch {
    toast("Update failed", "error");
  }
}

async function deleteMenuItem(itemName) {
  if (!confirm(`Delete "${itemName}"?`)) return;
  const vendor = sessionStorage.getItem("username");
  try {
    await apiFetch(`/menu/${vendor}/${encodeURIComponent(itemName)}`, {
      method: "DELETE",
    });
    toast("Item deleted");
    loadVendorMenu();
  } catch {
    toast("Delete failed", "error");
  }
}

// ── ADMIN: VENDOR CONTROL ─────────────────────────────────────────────────────

async function loadVendors() {
  const tbody = document.getElementById("vendorBody");
  if (!tbody) return;

  try {
    const vendors = await apiFetch("/vendors");

    if (!vendors.length) {
      tbody.innerHTML = `<tr><td colspan="3"
        style="text-align:center;padding:1.5rem;color:var(--muted)">
        No vendors yet</td></tr>`;
      return;
    }

    tbody.innerHTML = vendors.map(v => `
      <tr>
        <td>${v.username}</td>
        <td><span class="status status-${v.status}">${v.status}</span></td>
        <td style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          ${v.status !== "approved"
            ? `<button class="btn btn-sm" style="background:var(--success);color:#fff"
                onclick="setVendorStatus('${v.username}','approved')">Approve</button>`
            : `<button class="btn btn-sm" style="background:#f59e0b;color:#fff"
                onclick="setVendorStatus('${v.username}','suspended')">Suspend</button>`
          }
          <button class="btn btn-danger btn-sm"
            onclick="deleteVendor('${v.username}')">Remove</button>
        </td>
      </tr>`).join("");
  } catch {
    tbody.innerHTML = `<tr><td colspan="3"
      style="text-align:center;color:var(--danger)">Failed to load vendors</td></tr>`;
  }
}

async function createVendor() {
  const input    = document.getElementById("newVendor");
  const username = input?.value.trim();
  if (!username) { toast("Enter a username", "error"); return; }

  try {
    await apiFetch("/vendors", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
    toast("Vendor created!");
    input.value = "";
    loadVendors();
  } catch {
    toast("Failed — username may already exist", "error");
  }
}

async function setVendorStatus(username, status) {
  try {
    await apiFetch(`/vendors/${username}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    toast(`Vendor ${status}`);
    loadVendors();
  } catch {
    toast("Update failed", "error");
  }
}

async function deleteVendor(username) {
  if (!confirm(`Remove vendor "${username}"?`)) return;
  try {
    await apiFetch(`/vendors/${username}`, { method: "DELETE" });
    toast("Vendor removed");
    loadVendors();
  } catch {
    toast("Delete failed", "error");
  }
}
