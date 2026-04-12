// ==================== SUPABASE CONFIGURATION ====================
// ⚠️ REPLACE WITH YOUR ACTUAL SUPABASE KEYS ⚠️
const SUPABASE_URL = 'https://mslvqduxmkuusuyaewej.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';  // ← PASTE YOUR ey... KEY HERE

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// ==================== LOGIN ====================
async function loginWithUsername(username) {
  // Determine role
  let role = 'student';
  
  if (username === 'admin') {
    role = 'admin';
  } else {
    // Check if username exists in vendors table
    const { data: vendor } = await supabase
      .from('vendors')
      .select('*')
      .eq('username', username)
      .single();
    
    if (vendor) {
      role = 'vendor';
      // Check if vendor is approved
      if (vendor.status !== 'approved') {
        toast('Your account is pending admin approval', 'error');
        return null;
      }
    }
  }
  
  // Create email for Supabase Auth
  const email = `${username}@${role}.local`;
  const password = username; // Simple password for demo
  
  try {
    // Try to sign in
    let { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) {
      // User doesn't exist, create them
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: { data: { username, role } }
      });
      
      if (signUpError) throw signUpError;
      
      // Create record in appropriate table
      if (role === 'vendor') {
        await supabase.from('vendors').insert([{ 
          id: signUpData.user.id, 
          username: username, 
          status: 'pending' 
        }]);
        toast('Vendor account created. Waiting for admin approval.', 'error');
        return null;
      } else if (role === 'student') {
        await supabase.from('students').insert([{ 
          id: signUpData.user.id, 
          username: username 
        }]);
      }
      
      // Login again after creation
      const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      if (retryError) throw retryError;
      
      sessionStorage.setItem("username", username);
      sessionStorage.setItem("role", role);
      return { username, role };
    }
    
    // Login successful
    sessionStorage.setItem("username", username);
    sessionStorage.setItem("role", role);
    return { username, role };
    
  } catch (err) {
    console.error('Login error:', err);
    toast(err.message, 'error');
    return null;
  }
}

// Login button handler
document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const username = document.getElementById("userInput").value.toLowerCase().trim();
  if (!username) {
    toast("Enter your username", "error");
    return;
  }

  const user = await loginWithUsername(username);
  if (!user) return;

  const routes = {
    admin:   "dashboard_admin.html",
    vendor:  "dashboard_vendor.html",
    student: "dashboard_student.html",
  };
  window.location.href = routes[user.role] || "index.html";
});

// ==================== SHARED FUNCTIONS (used by dashboards) ====================
// Make these available globally
window.supabase = supabase;
window.toast = toast;
window.logout = logout;

// Student functions
window.addToCartGlobal = (vendorId, itemId, itemName, price) => {
  let cart = JSON.parse(sessionStorage.getItem('cart') || '[]');
  cart.push({ vendorId, itemId, name: itemName, price });
  sessionStorage.setItem('cart', JSON.stringify(cart));
  toast(`${itemName} added to cart`);
};

window.getCart = () => {
  return JSON.parse(sessionStorage.getItem('cart') || '[]');
};

window.clearCart = () => {
  sessionStorage.removeItem('cart');
};

// Vendor functions
window.loadVendorData = async (vendorUsername) => {
  // Get vendor ID
  const { data: vendor } = await supabase
    .from('vendors')
    .select('id')
    .eq('username', vendorUsername)
    .single();
  
  return vendor;
};
