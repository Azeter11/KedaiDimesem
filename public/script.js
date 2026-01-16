// Global helper functions for Kedai Dimesem

// Format currency to IDR
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

// Show notification
function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notifications
    const existing = document.querySelectorAll('.global-notification');
    existing.forEach(el => el.remove());
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `global-notification fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300 ${type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} mr-3"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Remove after duration
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// Validate email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate phone number (Indonesian)
function validatePhone(phone) {
    const re = /^(\+62|62|0)8[1-9][0-9]{6,9}$/;
    return re.test(phone);
}

// Get query parameters
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Variable untuk debounce
let searchTimer;

const searchInput = document.getElementById('searchInput');

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        const query = e.target.value;

        searchTimer = setTimeout(() => {
            fetchProducts(query);
        }, 500); // Tunggu 0.5 detik setelah selesai mengetik
    });
}

// Fungsi Fetch Products yang diperbaiki
async function fetchProducts(searchQuery = '') {
    try {
        const url = searchQuery 
            ? `/api/search?q=${encodeURIComponent(searchQuery)}` 
            : '/api/products';
            
        const response = await fetch(url);
        const products = await response.json();

        // Perbaikan Error: pastikan 'products' adalah Array sebelum di .map()
        if (Array.isArray(products)) {
            displayProducts(products);
        } else {
            console.error('Data yang diterima bukan array:', products);
            displayProducts([]); // Tampilkan kosong jika error
        }
    } catch (error) {
        console.error('Fetch Error:', error);
    }
}

// Check authentication status
function checkAuth() {
    return new Promise((resolve) => {
        fetch('/api/auth/check', {
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            resolve(data.authenticated ? data.user : null);
        })
        .catch(() => {
            resolve(null);
        });
    });
}
function displayProducts(products) {
    const container = document.getElementById('product-container'); 
    if (!container) return;

    if (products.length === 0) {
        container.innerHTML = `<p class="col-span-full text-center py-10 text-amber-800">Produk tidak ditemukan.</p>`;
        return;
    }

    container.innerHTML = products.map(item => `
        <div class="card-hover bg-white rounded-2xl shadow-md overflow-hidden border border-amber-100">
            <img src="${item.image || '/assets/default-dimsum.jpg'}" class="w-full h-48 object-cover">
            <div class="p-4">
                <h3 class="text-lg font-bold text-amber-900">${item.name}</h3>
                <p class="text-amber-600 font-bold mt-2">Rp ${Number(item.price).toLocaleString('id-ID')}</p>
                <button onclick="addToCart(${item.id})" class="w-full mt-3 bg-amber-800 text-white py-2 rounded-xl hover:bg-amber-900 transition">
                    Tambah
                </button>
            </div>
        </div>
    `).join('');
}

// Logout function
function logout() {
    fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
    })
    .then(() => {
        sessionStorage.removeItem('user');
        localStorage.removeItem('cart');
        window.location.href = 'login.html';
    });
}

// Load cart from localStorage
function getCart() {
    return JSON.parse(localStorage.getItem('cart') || '[]');
}

// Save cart to localStorage
function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Calculate cart total
function calculateCartTotal() {
    const cart = getCart();
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Update cart count in navbar
function updateCartCount() {
    const cart = getCart();
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCount = document.getElementById('cartCount');
    
    if (cartCount) {
        if (totalItems > 0) {
            cartCount.textContent = totalItems;
            cartCount.classList.remove('hidden');
        } else {
            cartCount.classList.add('hidden');
        }
    }
}

// Initialize common functionality
document.addEventListener('DOMContentLoaded', function() {
    // Update cart count on page load
    updateCartCount();
    
    // Add logout button listener if exists
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Check user session
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (user && user.name) {
        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
            userNameEl.textContent = user.name;
        }
        
        // Show user section, hide guest section
        const userSection = document.getElementById('userSection');
        const guestSection = document.getElementById('guestSection');
        if (userSection && guestSection) {
            userSection.classList.remove('hidden');
            guestSection.classList.add('hidden');
        }
    }
});