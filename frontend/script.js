// ==================== SUPABASE CONFIGURATION ====================
const SUPABASE_URL = 'https://mslvqduxmkuusuyaewej.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbHZxZHV4bWt1dXN1eWFld2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODkzNDcsImV4cCI6MjA5MTU2NTM0N30.VxvR39nI5lNK_JZ6fwctQJgAH06YhbCTd8bXuiLpJgs';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== GLOBAL VARIABLES ====================
let cart = [];

// ==================== HELPERS ====================
function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  if (!el) {
    alert(msg);
    return;
  }
  el.textContent = msg;
  el.className = `show ${type}`;
  setTimeout(() => (el.className = ""), 3000);
}

function logout() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

async function getVendorId(username) {
  const { data, error } = await sb
    .from('vendors')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (error || !data) return null;
  return data.id;
}

async function getStudentId(username) {
  const { data, error } = await sb
    .from('students')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (error || !data) return null;
  return data.id;
}

// ==================== ADMIN: VENDOR CONTROL ====================
async function loadVendors() {
  const tbody = document.getElementById('vendorBody');
  if (!tbody) return;

  const { data, error } = await sb
    .from('vendors')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:red;">Failed to load</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">No vendors yet</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(v => `
    <tr>
      <td>${v.username}</td>
      <td>${v.status}</td>
      <td style="display:flex; gap:0.5rem;">
        ${v.status !== "approved"
          ? `<button onclick="updateVendorStatus('${v.id}', 'approved')">Approve</button>`
          : `<button onclick="updateVendorStatus('${v.id}', 'suspended')">Suspend</button>`
        }
        <button onclick="deleteVendor('${v.id}')">Remove</button>
      </td>
    </tr>
  `).join("");
}

async function updateVendorStatus(vendorId, status) {
  const { error } = await sb
    .from('vendors')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', vendorId);
  if (error) {
    toast("Update failed", "error");
  } else {
    toast(`Vendor ${status}`);
    loadVendors();
  }
}

async function deleteVendor(vendorId) {
  if (!confirm("Remove this vendor?")) return;
  const { error } = await sb.from('vendors').delete().eq('id', vendorId);
  if (error) {
    toast("Delete failed", "error");
  } else {
    toast("Vendor removed");
    loadVendors();
  }
}

// ==================== VENDOR: MENU ====================
async function loadVendorMenu() {
  const container = document.getElementById("vendorMenu");
  if (!container) return;

  const username = sessionStorage.getItem("username");
  const vendorId = await getVendorId(username);

  if (!vendorId) {
    container.innerHTML = "<p>Vendor not found</p>";
    return;
  }

  const { data, error } = await sb
    .from("menu")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: true });

  if (error) {
    container.innerHTML = "<p>Failed to load menu</p>";
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "<p>No items yet.</p>";
    return;
  }

  container.innerHTML = data.map(item => `
    <div class="menu-item">
      <div style="font-weight:bold">${item.name}</div>
      ${item.image_url ? `<img src="${item.image_url}" style="width: 180px; height: 180px; object-fit: cover; border-radius: 10px; margin: 10px 0;" />` : ""}
      <div>${item.description || ""}</div>
      <div>R${item.price}</div>
      <div>${item.status}</div>
      <button onclick="toggleSoldOut(${item.id}, ${item.status === "sold_out"})">
        ${item.status === "sold_out" ? "Mark Available" : "Mark Sold Out"}
      </button>
      <button onclick="deleteMenuItem(${item.id})">Delete</button>
    </div>
  `).join("");
}

async function addMenuItem() {
  const nameEl = document.getElementById("itemName");
  const priceEl = document.getElementById("itemPrice");
  const descEl = document.getElementById("itemDescription");
  const imageEl = document.getElementById("itemImage");

  const name = nameEl?.value.trim();
  const price = Number(priceEl?.value);
  const description = descEl?.value.trim();
  const file = imageEl?.files[0];
  const username = sessionStorage.getItem("username");

  if (!name || !price || !description) {
    toast("Fill in all fields", "error");
    return;
  }

  const vendorId = await getVendorId(username);
  if (!vendorId) {
    toast("Vendor not found", "error");
    return;
  }

  let imageUrl = null;
  if (file) {
    const fileName = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await sb.storage.from("menu_images").upload(fileName, file);
    if (uploadError) {
      toast("Image upload failed", "error");
      return;
    }
    const { data: urlData } = sb.storage.from("menu_images").getPublicUrl(fileName);
    imageUrl = urlData.publicUrl;
  }

  const { error } = await sb.from("menu").insert([{
    vendor_id: vendorId,
    name,
    price,
    description,
    image_url: imageUrl,
    status: "available"
  }]);

  if (error) {
    toast("Failed to add item", "error");
  } else {
    toast("Item added successfully");
    nameEl.value = "";
    priceEl.value = "";
    descEl.value = "";
    imageEl.value = "";
    loadVendorMenu();
  }
}

async function toggleSoldOut(itemId, currentlySoldOut) {
  const newStatus = currentlySoldOut ? "available" : "sold_out";
  await sb.from("menu").update({ status: newStatus }).eq("id", itemId);
  toast("Item updated");
  loadVendorMenu();
}

async function deleteMenuItem(itemId) {
  if (!confirm("Delete this item?")) return;
  await sb.from("menu").delete().eq("id", itemId);
  toast("Item deleted");
  loadVendorMenu();
}

// ==================== VENDOR: ORDERS ====================
async function loadVendorOrders() {
  const tbody = document.getElementById("ordersBody");
  if (!tbody) return;

  const username = sessionStorage.getItem("username");
  const vendorId = await getVendorId(username);

  if (!vendorId) {
    tbody.innerHTML = "<tr><td colspan='6'>Vendor not found</td></tr>";
    return;
  }

  const { data, error } = await sb
    .from("orders")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='6'>No orders yet</td></tr>";
    return;
  }

  tbody.innerHTML = data.map(order => `
    <tr>
      <td>#${order.order_number || order.id}</td>
      <td>${order.student_username}</td>
      <td>${Array.isArray(order.items) ? order.items.map(i => i.name).join(", ") : ""}</td>
      <td>R${order.total_price}</td>
      <td>${order.status}</td>
      <td>
        <select onchange="updateOrderStatus(${order.id}, this.value)">
          <option value="pending" ${order.status === "pending" ? "selected" : ""}>Pending</option>
          <option value="confirmed" ${order.status === "confirmed" ? "selected" : ""}>Confirmed</option>
          <option value="completed" ${order.status === "completed" ? "selected" : ""}>Completed</option>
          <option value="cancelled" ${order.status === "cancelled" ? "selected" : ""}>Cancelled</option>
        </select>
      </td>
    </tr>
  `).join("");
}

async function updateOrderStatus(orderId, newStatus) {
  await sb.from("orders").update({ status: newStatus }).eq("id", orderId);
  toast("Order updated");
  loadVendorOrders();
}

// ==================== STUDENT: MENU & CART ====================
async function loadStudentMenu() {
  const container = document.getElementById("menuContainer");
  if (!container) return;

  const { data: vendors, error: vendorError } = await sb
    .from("vendors")
    .select("id, username")
    .eq("status", "approved");

  if (vendorError || !vendors || vendors.length === 0) {
    container.innerHTML = "<p>No vendors available yet.</p>";
    return;
  }

  let allMenu = [];
  for (const vendor of vendors) {
    const { data: menu, error: menuError } = await sb
      .from("menu")
      .select("*")
      .eq("vendor_id", vendor.id)
      .eq("status", "available");

    if (!menuError && menu) {
      allMenu.push(...menu.map(item => ({
        ...item,
        vendor_name: vendor.username,
        vendor_id: vendor.id
      })));
    }
  }

  if (allMenu.length === 0) {
    container.innerHTML = "<p>No menu available yet.</p>";
    return;
  }

  container.innerHTML = allMenu.map(item => `
    <div class="menu-item">
      <div style="font-weight: bold;">${item.name}</div>
      <div>R${item.price}</div>
      <div style="font-size: 12px; color: #666;">${item.vendor_name}</div>
      <div style="font-size: 12px; color: #666;">${item.description || ""}</div>
      ${item.image_url ? `<img src="${item.image_url}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; margin-top: 8px;">` : ""}
      <button class="btn btn-primary btn-sm" onclick="addToCart('${item.id}', '${item.name}', ${item.price}, '${item.vendor_id}')">
        + Add to Cart
      </button>
    </div>
  `).join("");

  const savedCart = sessionStorage.getItem("cart");
  if (savedCart) {
    cart = JSON.parse(savedCart);
    updateCartDisplay();
  }
}

function addToCart(itemId, name, price, vendorId) {
  cart.push({ id: itemId, name, price, vendor_id: vendorId });
  sessionStorage.setItem("cart", JSON.stringify(cart));
  updateCartDisplay();
  toast(`${name} added to cart`);
}

function removeFromCart(index) {
  cart.splice(index, 1);
  sessionStorage.setItem("cart", JSON.stringify(cart));
  updateCartDisplay();
}

function updateCartDisplay() {
  const cartPanel = document.getElementById("cartPanel");
  const cartItems = document.getElementById("cartItems");
  const cartTotalSpan = document.getElementById("cartTotal");

  if (!cartPanel || !cartItems || !cartTotalSpan) return;

  if (cart.length === 0) {
    cartPanel.style.display = "none";
    return;
  }

  cartPanel.style.display = "block";
  cartItems.innerHTML = cart.map((item, idx) => `
    <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid #ddd;">
      <span>${item.name}</span>
      <span>R${item.price} <button onclick="removeFromCart(${idx})">✕</button></span>
    </div>
  `).join("");
  cartTotalSpan.textContent = `R${cart.reduce((sum, item) => sum + item.price, 0)}`;
}

async function placeOrder() {
  if (cart.length === 0) {
    toast("Your cart is empty", "error");
    return;
  }

  const username = sessionStorage.getItem("username");
  const studentId = await getStudentId(username);

  if (!studentId) {
    toast("Student not found. Please login again.", "error");
    return;
  }

  const vendorIds = [...new Set(cart.map(item => item.vendor_id))];
  if (vendorIds.length > 1) {
    toast("Please order from one vendor at a time", "error");
    return;
  }

  const vendorId = vendorIds[0];
  const totalPrice = cart.reduce((sum, item) => sum + item.price, 0);
  const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const { error } = await sb.from("orders").insert([{
    order_number: orderNumber,
    student_id: studentId,
    student_username: username,
    vendor_id: vendorId,
    items: cart.map(item => ({ id: item.id, name: item.name, price: item.price })),
    total_price: totalPrice,
    status: "pending"
  }]);

  if (error) {
    toast("Failed to place order", "error");
  } else {
    toast("Order placed!");
    cart = [];
    sessionStorage.removeItem("cart");
    updateCartDisplay();
  }
}

// ==================== STUDENT: ORDER HISTORY ====================
async function loadStudentOrderHistory() {
  const tbody = document.getElementById("historyBody");
  if (!tbody) return;

  const username = sessionStorage.getItem("username");
  const studentId = await getStudentId(username);

  if (!studentId) {
    tbody.innerHTML = "<tr><td colspan='6'>Student not found</td></tr>";
    return;
  }

  const { data, error } = await sb
    .from("orders")
    .select("*, vendors(username)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='6'>No orders yet</td></tr>";
    return;
  }

  tbody.innerHTML = data.map(order => `
    <tr>
      <td>#${order.order_number || order.id}</td>
      <td>${order.vendors?.username || "Unknown"}</td>
      <td>${Array.isArray(order.items) ? order.items.map(i => i.name).join(", ") : ""}</td>
      <td>R${order.total_price}</td>
      <td>${order.status}</td>
      <td>${new Date(order.created_at).toLocaleDateString()}</td>
    </tr>
  `).join("");
}

// ==================== ADMIN: ALL ORDERS ====================
async function loadAllOrders() {
  const tbody = document.getElementById("allOrdersBody");
  if (!tbody) return;

  const { data, error } = await sb
    .from("orders")
    .select("*, vendors(username)")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='7'>No orders yet</td></tr>";
    return;
  }

  tbody.innerHTML = data.map(order => `
    <tr>
      <td>#${order.order_number || order.id}</td>
      <td>${order.vendors?.username || "Unknown"}</td>
      <td>${order.student_username}</td>
      <td>${Array.isArray(order.items) ? order.items.map(i => i.name).join(", ") : ""}</td>
      <td>R${order.total_price}</td>
      <td>${order.status}</td>
      <td>${new Date(order.created_at).toLocaleDateString()}</td>
    </tr>
  `).join("");
}

// ==================== REVIEW SYSTEM ====================
async function submitReviewToDB(orderId, rating) {
  const username = sessionStorage.getItem("username");
  const vendorId = await getVendorId(username);

  if (!vendorId) {
    toast("Vendor not found", "error");
    return false;
  }

  const { data: existing } = await sb
    .from("reviews")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing) {
    toast("Review already submitted", "error");
    return false;
  }

  const { error } = await sb.from("reviews").insert([{
    order_id: orderId,
    vendor_id: vendorId,
    rating: rating
  }]);

  if (error) {
    toast("Failed to submit review", "error");
    return false;
  }

  toast("Review submitted!");
  return true;
}

// ==================== BROWSE BY VENDOR ====================
async function loadVendorsList() {
  const container = document.getElementById("vendorsContainer");
  if (!container) return;

  const { data: vendors, error } = await sb
    .from("vendors")
    .select("id, username")
    .eq("status", "approved");

  if (error || !vendors || vendors.length === 0) {
    container.innerHTML = '<p>No vendors available yet.</p>';
    return;
  }

  container.innerHTML = vendors.map(vendor => `
    <div class="menu-item" style="cursor: pointer;" onclick="showVendorMenu('${vendor.id}', '${vendor.username}')">
      <div style="font-weight: bold; font-size: 1.2rem;">🏪 ${vendor.username}</div>
      <div style="margin-top: 0.5rem;">Click to view menu →</div>
    </div>
  `).join('');
}

async function showVendorMenu(vendorId, vendorName) {
  const container = document.getElementById("menuContainer");
  if (!container) return;

  const menuView = document.getElementById("menuView");
  const vendorsView = document.getElementById("vendorsView");
  const browseByMenuBtn = document.getElementById("browseByMenuBtn");
  const browseByVendorBtn = document.getElementById("browseByVendorBtn");

  if (menuView && vendorsView) {
    menuView.style.display = "block";
    vendorsView.style.display = "none";
  }

  if (browseByMenuBtn && browseByVendorBtn) {
    browseByMenuBtn.className = "btn btn-primary";
    browseByVendorBtn.className = "btn";
    browseByVendorBtn.style.background = "var(--surface-alt)";
    browseByVendorBtn.style.color = "var(--text)";
  }

  container.innerHTML = `<p>Loading ${vendorName}'s menu...</p>`;

  const { data: menu, error } = await sb
    .from("menu")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("status", "available");

  if (error || !menu || menu.length === 0) {
    container.innerHTML = `<p>No items available from ${vendorName} yet.</p>`;
    return;
  }

  const menuHeading = document.querySelector("#menuView h2");
  if (menuHeading) {
    menuHeading.innerHTML = `${vendorName} Menu <button onclick="resetToAllMenu()" style="margin-left: 1rem; padding: 0.25rem 0.75rem; font-size: 0.8rem;" class="btn">Back to All Menu</button>`;
  }

  container.innerHTML = menu.map(item => `
    <div class="menu-item">
      <div style="font-weight: bold;">${item.name}</div>
      <div>R${item.price}</div>
      <div style="font-size: 12px;">${item.description || ""}</div>
      ${item.image_url ? `<img src="${item.image_url}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; margin-top: 8px;">` : ""}
      <button class="btn btn-primary btn-sm" onclick="addToCart('${item.id}', '${item.name}', ${item.price}, '${vendorId}')">
        + Add to Cart
      </button>
    </div>
  `).join("");
}

function resetToAllMenu() {
  const menuHeading = document.querySelector("#menuView h2");
  if (menuHeading) {
    menuHeading.innerHTML = "Available Menu";
  }
  loadStudentMenu();
}

// ==================== MAKE FUNCTIONS GLOBAL ====================
window.logout = logout;
window.loadVendors = loadVendors;
window.updateVendorStatus = updateVendorStatus;
window.deleteVendor = deleteVendor;
window.loadVendorMenu = loadVendorMenu;
window.addMenuItem = addMenuItem;
window.toggleSoldOut = toggleSoldOut;
window.deleteMenuItem = deleteMenuItem;
window.loadVendorOrders = loadVendorOrders;
window.updateOrderStatus = updateOrderStatus;
window.loadStudentMenu = loadStudentMenu;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartDisplay = updateCartDisplay;
window.placeOrder = placeOrder;
window.loadStudentOrderHistory = loadStudentOrderHistory;
window.loadAllOrders = loadAllOrders;
window.submitReviewToDB = submitReviewToDB;
window.loadVendorsList = loadVendorsList;
window.showVendorMenu = showVendorMenu;
window.resetToAllMenu = resetToAllMenu;
