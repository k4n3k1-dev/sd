// ==================== SUPABASE CONFIGURATION ====================
const SUPABASE_URL = 'https://mslvqduxmkuusuyaewej.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbHZxZHV4bWt1dXN1eWFld2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODkzNDcsImV4cCI6MjA5MTU2NTM0N30.VxvR39nI5lNK_JZ6fwctQJgAH06YhbCTd8bXuiLpJgs';

// Use a different variable name to avoid conflict
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== GLOBAL VARIABLES ====================
let cart = [];

// ==================== HELPERS ====================
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

async function getVendorId(username) {
  const { data, error } = await sb
    .from('vendors')
    .select('id')
    .eq('username', username)
    .single();
  
  if (error) return null;
  return data.id;
}

async function getStudentId(username) {
  const { data, error } = await sb
    .from('students')
    .select('id')
    .eq('username', username)
    .single();
  
  if (error) return null;
  return data.id;
}

// ==================== ADMIN: VENDOR CONTROL ====================
async function loadVendors() {
  const tbody = document.getElementById('vendorBody');
  if (!tbody) return;

  const { data, error } = await sb
    .from('vendors')
    .select('*')
    .order('created_at', 'asc');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--danger)">Failed to load</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--muted)">No vendors yet</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(v => `
    <tr>
      <td>${v.username}</td>
      <td><span class="status status-${v.status}">${v.status}</span></td>
      <td style="display:flex; gap:0.5rem;">
        ${v.status !== 'approved' 
          ? `<button class="btn btn-sm" style="background:var(--success);color:#fff" onclick="updateVendorStatus('${v.id}', 'approved')">Approve</button>`
          : `<button class="btn btn-sm" style="background:#f59e0b;color:#fff" onclick="updateVendorStatus('${v.id}', 'suspended')">Suspend</button>`
        }
        <button class="btn btn-sm btn-danger" onclick="deleteVendor('${v.id}')">Remove</button>
      </td>
    </tr>
  `).join('');
}

async function updateVendorStatus(vendorId, status) {
  const { error } = await sb
    .from('vendors')
    .update({ status, updated_at: new Date() })
    .eq('id', vendorId);

  if (error) {
    toast('Update failed', 'error');
  } else {
    toast(`Vendor ${status}`);
    loadVendors();
  }
}

async function deleteVendor(vendorId) {
  if (!confirm('Remove this vendor?')) return;

  const { error } = await sb
    .from('vendors')
    .delete()
    .eq('id', vendorId);

  if (error) {
    toast('Delete failed', 'error');
  } else {
    toast('Vendor removed');
    loadVendors();
  }
}

async function createVendor() {
  const input = document.getElementById('newVendor');
  const username = input?.value.trim();

  if (!username) {
    toast('Enter a username', 'error');
    return;
  }

  const { data: existing } = await sb
    .from('vendors')
    .select('username')
    .eq('username', username)
    .single();

  if (existing) {
    toast('Vendor already exists', 'error');
    return;
  }

  const email = `${username}@campusfood.com`;
  const password = username;

  const { data: authData, error: authError } = await sb.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        username: username,
        role: 'vendor'
      }
    }
  });

  if (authError) {
    toast('Error creating vendor: ' + authError.message, 'error');
    return;
  }

  const { error: insertError } = await sb
    .from('vendors')
    .insert([{ id: authData.user.id, username: username, status: 'pending' }]);

  if (insertError) {
    toast('Error saving vendor', 'error');
  } else {
    toast(`Vendor ${username} created (pending approval)`);
    input.value = '';
    loadVendors();
  }
}

// ==================== VENDOR: MENU MANAGEMENT ====================
async function loadVendorMenu() {
  const container = document.getElementById('vendorMenu');
  if (!container) return;

  const username = sessionStorage.getItem('username');
  const vendorId = await getVendorId(username);

  if (!vendorId) {
    container.innerHTML = '<p style="color:var(--danger)">Vendor not found</p>';
    return;
  }

  const { data, error } = await sb
    .from('menu')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', 'asc');

  if (error) {
    container.innerHTML = '<p style="color:var(--danger)">Failed to load menu</p>';
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<p style="color:var(--muted)">No items yet. Add one above.</p>';
    return;
  }

  container.innerHTML = data.map(item => `
    <div class="menu-item ${item.status === 'sold_out' ? 'sold-out' : ''}">
      <div class="item-name">${item.name}</div>
      <div class="item-price">R${item.price}</div>
      ${item.status === 'sold_out' ? '<span class="badge">Sold Out</span>' : ''}
      <div class="item-actions">
        <button class="btn btn-sm" style="background:var(--teal-light);color:var(--teal-dark)"
          onclick="toggleSoldOut(${item.id}, ${item.status === 'sold_out'})">
          ${item.status === 'sold_out' ? 'Mark Available' : 'Mark Sold Out'}
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteMenuItem(${item.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

async function addMenuItem() {
  const nameEl = document.getElementById('itemName');
  const priceEl = document.getElementById('itemPrice');
  const name = nameEl?.value.trim();
  const price = Number(priceEl?.value);
  const username = sessionStorage.getItem('username');

  if (!name || !price) {
    toast('Fill in both fields', 'error');
    return;
  }

  const vendorId = await getVendorId(username);
  if (!vendorId) {
    toast('Vendor not found', 'error');
    return;
  }

  const { error } = await sb
    .from('menu')
    .insert([{ vendor_id: vendorId, name, price, status: 'available' }]);

  if (error) {
    toast('Failed to add item: ' + error.message, 'error');
  } else {
    toast('Item added!');
    nameEl.value = '';
    priceEl.value = '';
    loadVendorMenu();
  }
}

async function toggleSoldOut(itemId, currentlySoldOut) {
  const newStatus = currentlySoldOut ? 'available' : 'sold_out';
  
  const { error } = await sb
    .from('menu')
    .update({ status: newStatus })
    .eq('id', itemId);

  if (error) {
    toast('Update failed', 'error');
  } else {
    toast(currentlySoldOut ? 'Item available again' : 'Marked as sold out');
    loadVendorMenu();
  }
}

async function deleteMenuItem(itemId) {
  if (!confirm('Delete this item?')) return;

  const { error } = await sb
    .from('menu')
    .delete()
    .eq('id', itemId);

  if (error) {
    toast('Delete failed', 'error');
  } else {
    toast('Item deleted');
    loadVendorMenu();
  }
}

// ==================== VENDOR: ORDERS ====================
async function loadVendorOrders() {
  const tbody = document.getElementById('ordersBody');
  if (!tbody) return;

  const username = sessionStorage.getItem('username');
  const vendorId = await getVendorId(username);

  if (!vendorId) {
    tbody.innerHTML = '<tr><td colspan="6">Vendor not found</td></tr>';
    return;
  }

  const { data, error } = await sb
    .from('orders')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', 'desc');

  if (error) {
    tbody.innerHTML = '<tr><td colspan="6">Failed to load orders</td></tr>';
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">No orders yet</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(order => `
    <tr>
      <td>#${order.order_number || order.id}</td>
      <td>${order.student_username}</td>
      <td>${order.items.map(i => i.name).join(', ')}</td>
      <td>R${order.total_price}</td>
      <td><span class="status status-${order.status}">${order.status}</span></td>
      <td>
        <select onchange="updateOrderStatus(${order.id}, this.value)" style="padding:4px;border-radius:4px;">
          <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
    </tr>
  `).join('');
}

async function updateOrderStatus(orderId, newStatus) {
  const { error } = await sb
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId);

  if (error) {
    toast('Update failed', 'error');
  } else {
    toast(`Order status updated to ${newStatus}`);
    loadVendorOrders();
  }
}

// ==================== STUDENT: MENU & CART ====================
async function loadStudentMenu() {
  const container = document.getElementById('menuContainer');
  if (!container) return;

  const { data: vendors, error: vendorError } = await sb
    .from('vendors')
    .select('id, username')
    .eq('status', 'approved');

  if (vendorError || !vendors) {
    container.innerHTML = '<p style="color:var(--danger)">Failed to load menu</p>';
    return;
  }

  let allMenu = [];
  for (const vendor of vendors) {
    const { data: menu, error: menuError } = await sb
      .from('menu')
      .select('*')
      .eq('vendor_id', vendor.id)
      .eq('status', 'available');

    if (!menuError && menu) {
      allMenu.push(...menu.map(item => ({ ...item, vendor_name: vendor.username, vendor_id: vendor.id })));
    }
  }

  if (allMenu.length === 0) {
    container.innerHTML = '<p style="color:var(--muted)">No menu available yet.</p>';
    return;
  }

  container.innerHTML = allMenu.map(item => `
    <div class="menu-item">
      <div class="item-name">${item.name}</div>
      <div class="item-price">R${item.price}</div>
      <div style="font-size:12px;color:var(--muted)">${item.vendor_name}</div>
      <button class="btn btn-primary btn-sm" onclick="addToCart('${item.id}', '${item.name}', ${item.price}, '${item.vendor_id}')">
        + Add to Cart
      </button>
    </div>
  `).join('');
  
  const savedCart = sessionStorage.getItem('cart');
  if (savedCart) {
    cart = JSON.parse(savedCart);
    updateCartDisplay();
  }
}

function addToCart(itemId, name, price, vendorId) {
  cart.push({ id: itemId, name, price, vendor_id: vendorId });
  sessionStorage.setItem('cart', JSON.stringify(cart));
  updateCartDisplay();
  toast(`${name} added to cart`);
}

function removeFromCart(index) {
  cart.splice(index, 1);
  sessionStorage.setItem('cart', JSON.stringify(cart));
  updateCartDisplay();
}

function updateCartDisplay() {
  const cartPanel = document.getElementById('cartPanel');
  const cartItems = document.getElementById('cartItems');
  const cartTotalSpan = document.getElementById('cartTotal');

  if (!cartPanel) return;

  if (cart.length === 0) {
    cartPanel.style.display = 'none';
    return;
  }

  cartPanel.style.display = 'block';
  
  cartItems.innerHTML = cart.map((item, idx) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid #e5e7eb;">
      <span>${item.name}</span>
      <span style="display:flex;align-items:center;gap:0.75rem;">
        R${item.price}
        <button class="btn btn-danger btn-sm" onclick="removeFromCart(${idx})">✕</button>
      </span>
    </div>
  `).join('');

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  cartTotalSpan.textContent = `R${total}`;
}

async function placeOrder() {
  if (cart.length === 0) {
    toast('Your cart is empty', 'error');
    return;
  }

  const username = sessionStorage.getItem('username');
  const studentId = await getStudentId(username);

  if (!studentId) {
    toast('Student not found. Please login again.', 'error');
    return;
  }

  const vendorIds = [...new Set(cart.map(item => item.vendor_id))];
  if (vendorIds.length > 1) {
    toast('Please order from one vendor at a time', 'error');
    return;
  }

  const vendorId = vendorIds[0];
  const totalPrice = cart.reduce((sum, item) => sum + item.price, 0);
  const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const { error } = await sb
    .from('orders')
    .insert([{
      order_number: orderNumber,
      student_id: studentId,
      student_username: username,
      vendor_id: vendorId,
      items: cart.map(item => ({ id: item.id, name: item.name, price: item.price })),
      total_price: totalPrice,
      status: 'pending'
    }]);

  if (error) {
    toast('Failed to place order: ' + error.message, 'error');
  } else {
    toast('Order placed! 🎉');
    cart = [];
    sessionStorage.removeItem('cart');
    updateCartDisplay();
  }
}

// ==================== STUDENT: ORDER HISTORY ====================
async function loadStudentOrderHistory() {
  const tbody = document.getElementById('historyBody');
  if (!tbody) return;

  const username = sessionStorage.getItem('username');
  const studentId = await getStudentId(username);

  if (!studentId) {
    tbody.innerHTML = '<tr><td colspan="6">Student not found</td></tr>';
    return;
  }

  const { data, error } = await sb
    .from('orders')
    .select('*, vendors(username)')
    .eq('student_id', studentId)
    .order('created_at', 'desc');

  if (error) {
    tbody.innerHTML = '<tr><td colspan="6">Failed to load orders</td></tr>';
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">No orders yet</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(order => `
    <tr>
      <td>#${order.order_number || order.id}</td>
      <td>${order.vendors?.username || 'Unknown'}</td>
      <td>${order.items.map(i => i.name).join(', ')}</td>
      <td>R${order.total_price}</td>
      <td><span class="status status-${order.status}">${order.status}</span></td>
      <td>${new Date(order.created_at).toLocaleDateString()}</td>
    </tr>
  `).join('');
}

// ==================== ADMIN: ALL ORDERS ====================
async function loadAllOrders() {
  const tbody = document.getElementById('allOrdersBody');
  if (!tbody) return;

  const { data, error } = await sb
    .from('orders')
    .select('*, vendors(username)')
    .order('created_at', 'desc');

  if (error) {
    tbody.innerHTML = '<tr><td colspan="7">Failed to load orders</td></tr>';
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">No orders yet</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(order => `
    <tr>
      <td>#${order.order_number || order.id}</td>
      <td>${order.vendors?.username || 'Unknown'}</td>
      <td>${order.student_username}</td>
      <td>${order.items.map(i => i.name).join(', ')}</td>
      <td>R${order.total_price}</td>
      <td><span class="status status-${order.status}">${order.status}</span></td>
      <td>${new Date(order.created_at).toLocaleDateString()}</td>
    </tr>
  `).join('');
}

// ==================== MAKE FUNCTIONS GLOBAL ====================
window.logout = logout;
window.loadVendors = loadVendors;
window.updateVendorStatus = updateVendorStatus;
window.deleteVendor = deleteVendor;
window.createVendor = createVendor;
window.loadVendorMenu = loadVendorMenu;
window.addMenuItem = addMenuItem;
window.toggleSoldOut = toggleSoldOut;
window.deleteMenuItem = deleteMenuItem;
window.loadVendorOrders = loadVendorOrders;
window.updateOrderStatus = updateOrderStatus;
window.loadStudentMenu = loadStudentMenu;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.placeOrder = placeOrder;
window.loadStudentOrderHistory = loadStudentOrderHistory;
window.loadAllOrders = loadAllOrders;
