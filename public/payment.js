// Payment functionality for Kedai Dimesem

// ==================== UTILITY FUNCTIONS ====================

// Format currency helper
function formatCurrency(amount) {
    return 'Rp ' + amount.toLocaleString('id-ID');
}

// Validate phone number (Indonesian)
function validatePhoneNumber(phone) {
    const re = /^(\+62|62|0)8[1-9][0-9]{6,9}$/;
    return re.test(phone);
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelectorAll('.checkout-notification');
    existing.forEach(el => el.remove());
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `checkout-notification fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300 ${
        type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
        type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
        'bg-blue-100 text-blue-800 border border-blue-200'
    }`;
    
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${
                type === 'error' ? 'fa-exclamation-circle' :
                type === 'success' ? 'fa-check-circle' : 'fa-info-circle'
            } mr-3"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Update cart count
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
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

// ==================== SESSION MANAGEMENT ====================

// Check if user is authenticated
async function checkAuthentication() {
    console.log('=== Checking authentication ===');
    
    try {
        const response = await fetch('/api/auth/check', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        console.log('Auth check status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Auth data:', data);
            return data.authenticated ? data : null;
        } else {
            console.log('Auth check failed with status:', response.status);
            return null;
        }
    } catch (error) {
        console.error('Auth check error:', error);
        return null;
    }
}

// ==================== ORDER SUMMARY FUNCTIONS ====================

// Update order summary
function updateOrderSummary() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    
    if (cart.length === 0) {
        // Show empty cart message
        const orderItems = document.getElementById('orderItems');
        if (orderItems) {
            orderItems.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-shopping-cart text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">Keranjang belanja kosong</p>
                    <a href="dashboard.html" class="inline-block mt-4 text-red-600 hover:text-red-700">
                        <i class="fas fa-arrow-left mr-2"></i>Kembali Belanja
                    </a>
                </div>
            `;
        }
        
        // Disable pay button
        const payButton = document.getElementById('payButton');
        if (payButton) {
            payButton.disabled = true;
        }
        
        return;
    }
    
    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = 10000;
    const total = subtotal + shipping;
    
    // Update UI
    const subtotalEl = document.getElementById('subtotal');
    const totalAmountEl = document.getElementById('totalAmount');
    const checkoutTotalEl = document.getElementById('checkoutTotal');
    
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (totalAmountEl) totalAmountEl.textContent = formatCurrency(total);
    if (checkoutTotalEl) checkoutTotalEl.textContent = formatCurrency(total);
    
    // Enable pay button
    const payButton = document.getElementById('payButton');
    if (payButton) {
        payButton.disabled = false;
    }
    
    // Render cart items
    renderOrderItems(cart);
}

// Render order items
function renderOrderItems(cart) {
    const orderItems = document.getElementById('orderItems');
    if (!orderItems) return;
    
    let html = '';
    
    cart.forEach(item => {
        const itemName = item.name || 'Produk';
        const itemPrice = parseFloat(item.price) || 0;
        const itemQuantity = parseInt(item.quantity) || 1;
        const itemImage = item.image || 'https://via.placeholder.com/60x60?text=Dimsum';
        const itemSubtotal = itemPrice * itemQuantity;
        
        html += `
            <div class="flex items-center border-b py-4">
                <img src="${itemImage}" 
                     alt="${itemName}" 
                     class="w-16 h-16 object-cover rounded-lg">
                <div class="ml-4 flex-grow">
                    <h4 class="font-semibold">${itemName}</h4>
                    <p class="text-red-600 font-bold">Rp ${itemPrice.toLocaleString('id-ID')}</p>
                </div>
                <div class="text-right">
                    <div class="text-gray-600">${itemQuantity} x</div>
                    <div class="font-semibold">Rp ${itemSubtotal.toLocaleString('id-ID')}</div>
                </div>
            </div>
        `;
    });
    
    orderItems.innerHTML = html;
}

// ==================== VALIDATION FUNCTIONS ====================

// Validate form before submission
function validateCheckoutForm() {
    const name = document.getElementById('customerName').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const address = document.getElementById('customerAddress').value.trim();
    
    // Basic validation
    if (!name || !email || !phone || !address) {
        showNotification('Harap lengkapi semua field yang wajib diisi', 'error');
        return false;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Format email tidak valid', 'error');
        return false;
    }
    
    // Phone validation (relaxed for now)
    if (!phone || phone.length < 10) {
        showNotification('Nomor telepon harus minimal 10 digit', 'error');
        return false;
    }
    
    // Check cart is not empty
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    if (cart.length === 0) {
        showNotification('Keranjang belanja kosong', 'error');
        return false;
    }
    
    return true;
}

// ==================== PAYMENT PROCESSING ====================

// Process payment - MAIN FUNCTION
async function processPayment() {
    console.log('=== PROCESS PAYMENT START ===');
    
    // 1. CHECK SESSION FIRST
    try {
        console.log('Checking authentication before checkout...');
        const authData = await checkAuthentication();
        
        if (!authData || !authData.authenticated) {
            console.log('User not authenticated, redirecting to login...');
            alert('Session telah habis. Silakan login kembali.');
            
            // Save current cart for recovery
            const currentCart = localStorage.getItem('cart');
            if (currentCart) {
                sessionStorage.setItem('cart_backup', currentCart);
            }
            
            // Redirect to login with return URL
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
            return;
        }
        
        console.log('✅ User authenticated:', authData.user);
        
        // Update session storage with fresh data
        sessionStorage.setItem('user', JSON.stringify(authData.user));
        
    } catch (error) {
        console.error('Session check error:', error);
        alert('Gagal memeriksa session. Silakan login kembali.');
        window.location.href = 'login.html';
        return;
    }
    
    // 2. VALIDATE FORM
    const form = document.getElementById('checkoutForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    if (!document.getElementById('terms').checked) {
        alert('Anda harus menyetujui Syarat & Ketentuan');
        return;
    }
    
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    if (cart.length === 0) {
        alert('Keranjang belanja kosong');
        return;
    }
    
    // 3. GET FORM DATA
    const customerName = document.getElementById('customerName').value.trim();
    const customerEmail = document.getElementById('customerEmail').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const customerAddress = document.getElementById('customerAddress').value.trim();
    const customerNote = document.getElementById('customerNote').value.trim();
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    
    // Validate required fields
    if (!customerName || !customerAddress || !paymentMethod) {
        alert('Nama, alamat, dan metode pembayaran harus diisi');
        return;
    }
    
// 4. PREPARE ITEMS DATA
const items = cart.map(item => {
    return {
        productId: item.id,      // Ubah 'id' menjadi 'productId' agar sesuai backend
        productName: item.name,   // Gunakan 'productName'
        price: parseFloat(item.price),
        quantity: parseInt(item.quantity),
        subtotal: parseFloat(item.price) * parseInt(item.quantity)
    };
});
    
    console.log('Prepared items:', items);
    
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = 10000;
    const total = subtotal + shipping;
    
    // 5. PREPARE ORDER DATA
    const orderData = {
        customer_name: customerName,
        customer_email: customerEmail || '',
        customer_phone: customerPhone || '',
        customer_address: customerAddress,
        customer_note: customerNote || '',
        payment_method: paymentMethod,
        items: items,
        subtotal: subtotal,
        shipping: shipping,
        total_amount: total
    };
    
    console.log('Sending order data:', orderData);
    
    // 6. SUBMIT ORDER
    try {
        const payButton = document.getElementById('payButton');
        const originalText = payButton.innerHTML;
        payButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Memproses...';
        payButton.disabled = true;
        
        // Submit with credentials
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Request-Timestamp': Date.now().toString()
            },
            body: JSON.stringify(orderData),
            credentials: 'include' // CRITICAL for sending cookies
        });
        
        console.log('Checkout response status:', response.status);
        console.log('Checkout response headers:', Object.fromEntries(response.headers.entries()));
        
        const result = await response.json();
        console.log('Checkout result:', result);
        
        if (response.ok) {
            // Clear cart
            localStorage.removeItem('cart');
            
            // Show success message
            showOrderSuccess(result.transactionId, result.transactionCode);
            
            // Update cart count
            updateCartCount();
        } else {
            throw new Error(result.error || result.details || 'Gagal memproses pembayaran');
        }
        
    } catch (error) {
        console.error('Payment processing error:', error);
        alert('Terjadi kesalahan: ' + error.message);
        
        // Reset button state
        const payButton = document.getElementById('payButton');
        if (payButton) {
            payButton.innerHTML = '<i class="fas fa-credit-card mr-2"></i>Bayar Sekarang';
            payButton.disabled = false;
        }
    }
    
    console.log('=== PROCESS PAYMENT END ===');
}

// ==================== SUCCESS MODAL FUNCTIONS ====================

// Show order success modal
function showOrderSuccess(transactionId, transactionCode) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    modal.id = 'successModal';
    
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95">
            <div class="p-8 text-center">
                <!-- Success Icon -->
                <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i class="fas fa-check-circle text-green-600 text-4xl"></i>
                </div>
                
                <!-- Title -->
                <h3 class="text-2xl font-bold text-gray-800 mb-4">Pesanan Berhasil!</h3>
                
                <!-- Message -->
                <p class="text-gray-600 mb-6">
                    Terima kasih telah berbelanja di Kedai Dimesem. 
                    Pesanan Anda akan segera kami proses.
                </p>
                
                <!-- Transaction Details -->
                <div class="bg-gray-50 rounded-lg p-4 mb-6">
                    <div class="flex justify-between mb-2">
                        <span class="text-gray-600">ID Transaksi:</span>
                        <span class="font-semibold">${transactionCode}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Tanggal:</span>
                        <span class="font-semibold">${new Date().toLocaleDateString('id-ID')}</span>
                    </div>
                </div>
                
                <!-- Payment Method -->
                <div class="mb-8">
                    <p class="text-sm text-gray-500 mb-2">Metode Pembayaran</p>
                    <p class="font-semibold">
                        ${document.querySelector('input[name="paymentMethod"]:checked').value === 'transfer' ? 'Transfer Bank' : 'COD'}
                    </p>
                </div>
                
                <!-- Action Buttons -->
                <div class="space-y-3">
                    <button onclick="downloadInvoice('${transactionId}')" 
                            class="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold">
                        <i class="fas fa-download mr-2"></i>Download Invoice
                    </button>
                    <button onclick="closeSuccessModal()" 
                            class="w-full border border-gray-300 hover:bg-gray-50 py-3 rounded-lg font-semibold">
                        <i class="fas fa-home mr-2"></i>Kembali ke Beranda
                    </button>
                </div>
                
                <!-- Additional Info -->
                <p class="text-xs text-gray-500 mt-6">
                    Invoice juga telah dikirim ke email Anda. 
                    Hubungi kami jika ada pertanyaan.
                </p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Animate in
    setTimeout(() => {
        modal.querySelector('.scale-95').classList.remove('scale-95');
    }, 10);
}

// Close success modal
function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.remove();
    }
    // Redirect to home
    window.location.href = 'dashboard.html';
}

// Download invoice
async function downloadInvoice(transactionId) {
    try {
        // Open PDF in new tab
        window.open(`/api/generate-pdf/${transactionId}`, '_blank');
    } catch (error) {
        console.error('Error downloading invoice:', error);
        showNotification('Gagal mengunduh invoice', 'error');
    }
}

// ==================== PAGE INITIALIZATION ====================

// Initialize payment page
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Payment page initialized');
    
    // 1. CHECK AUTHENTICATION ON PAGE LOAD
    try {
        const authData = await checkAuthentication();
        
        if (!authData || !authData.authenticated) {
            console.log('User not authenticated on page load, redirecting...');
            
            // Save cart for recovery
            const currentCart = localStorage.getItem('cart');
            if (currentCart) {
                sessionStorage.setItem('cart_backup', currentCart);
            }
            
            // Redirect to login
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
            return;
        }
        
        console.log('✅ User authenticated on page load:', authData.user);
        
        // Update session storage
        sessionStorage.setItem('user', JSON.stringify(authData.user));
        
        // Load user data into form
        document.getElementById('customerName').value = authData.user.name || '';
        document.getElementById('customerEmail').value = authData.user.email || '';
        
    } catch (error) {
        console.error('Initial auth check error:', error);
        // Don't redirect immediately, let user see the page first
    }
    
    // 2. LOAD USER DATA FROM SESSION STORAGE (fallback)
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (user && user.name) {
        if (!document.getElementById('customerName').value) {
            document.getElementById('customerName').value = user.name;
        }
        if (!document.getElementById('customerEmail').value) {
            document.getElementById('customerEmail').value = user.email || '';
        }
    }
    
    // 3. SETUP PAYMENT METHOD TOGGLE
    const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
    paymentMethods.forEach(radio => {
        radio.addEventListener('change', function() {
            const transferInstructions = document.getElementById('transferInstructions');
            const codInstructions = document.getElementById('codInstructions');
            
            if (this.value === 'transfer') {
                transferInstructions.classList.remove('hidden');
                codInstructions.classList.add('hidden');
            } else {
                transferInstructions.classList.add('hidden');
                codInstructions.classList.remove('hidden');
            }
        });
    });
    
    // 4. SETUP PAY BUTTON
    const payButton = document.getElementById('payButton');
    if (payButton) {
        payButton.addEventListener('click', processPayment);
    }
    
    // 5. UPDATE ORDER SUMMARY
    updateOrderSummary();
    
    // 6. RESTORE CART BACKUP IF EXISTS
    const cartBackup = sessionStorage.getItem('cart_backup');
    if (cartBackup && !localStorage.getItem('cart')) {
        localStorage.setItem('cart', cartBackup);
        sessionStorage.removeItem('cart_backup');
        updateOrderSummary();
        console.log('Cart restored from backup');
    }
    
    // 7. DEBUG: LOG CURRENT STATE
    console.log('Current cart:', JSON.parse(localStorage.getItem('cart') || '[]'));
    console.log('Current user:', JSON.parse(sessionStorage.getItem('user') || '{}'));
});