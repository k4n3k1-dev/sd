// ==================== SUPABASE CONFIGURATION ====================
const SUPABASE_URL = 'https://mslvqduxmkuusuyaewej.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_KEY_HERE';
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
  const { data, error } = await sb.from('vendors').select('id').eq('username', username).single();
  if (error) return null;
  return data.id;
}

async function getStudentId(username) {
  const { data, error } = await sb.from('students').select('id').eq('username', username).single();
  if (error) return null;
  return data.id;
}

// ==================== ⭐ REVIEW SYSTEM ====================
async function submitReviewToDB(orderId, rating) {
  const username = sessionStorage.getItem('username');
  const vendorId = await getVendorId(username);

  if (!vendorId) {
    toast('Vendor not found', 'error');
    return false;
  }

  // Prevent duplicate reviews
  const { data: existing } = await sb
    .from('reviews')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (existing) {
    toast('Review already submitted', 'error');
    return false;
  }

  const { error } = await sb
    .from('reviews')
    .insert([{
      order_id: orderId,
      vendor_id: vendorId,
      rating: rating
    }]);

  if (error) {
    toast('Failed to submit review', 'error');
    return false;
  }

  toast('Review submitted!');
  return true;
}

// ==================== ADMIN: VENDOR CONTROL ====================
// (UNCHANGED — keeping your original code)
async function loadVendors() {
  const tbody = document.getElementById('vendorBody');
  if (!tbody) return;

  const { data, error } = await sb.from('vendors').select('*').order('created_at', 'asc');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="3">Failed to load</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(v => `
    <tr>
      <td>${v.username}</td>
      <td><span class="status status-${v.status}">${v.status}</span></td>
      <td>
        <button onclick="updateVendorStatus('${v.id}', 'approved')">Approve</button>
        <button onclick="deleteVendor('${v.id}')">Remove</button>
      </td>
    </tr>
  `).join('');
}

async function updateVendorStatus(vendorId, status) {
  await sb.from('vendors').update({ status }).eq('id', vendorId);
  loadVendors();
}

async function deleteVendor(vendorId) {
  await sb.from('vendors').delete().eq('id', vendorId);
  loadVendors();
}

// ==================== (REST OF YOUR ORIGINAL FILE UNCHANGED) ====================
// 👉 I’m not repeating everything to avoid noise — your existing functions stay the same

// ==================== MAKE FUNCTIONS GLOBAL ====================
window.logout = logout;
window.loadVendors = loadVendors;
window.updateVendorStatus = updateVendorStatus;
window.deleteVendor = deleteVendor;

// ⭐ NEW
window.submitReviewToDB = submitReviewToDB;
