// Shopping Cart functionality for Kedai Dimesem

class ShoppingCart {
    constructor() {
        this.cart = this.loadCart();
        this.updateCartCount();
    }
    
    // Load cart from localStorage
    loadCart() {
        try {
            return JSON.parse(localStorage.getItem('cart') || '[]');
        } catch (error) {
            console.error('Error loading cart:', error);
            return [];
        }
    }
    
    // Save cart to localStorage
    saveCart() {
        try {
            localStorage.setItem('cart', JSON.stringify(this.cart));
            this.updateCartCount();
        } catch (error) {
            console.error('Error saving cart:', error);
        }
    }
    
    // Add item to cart
    addItem(product) {
        const existingItem = this.cart.find(item => item.id === product.id);
        
        if (existingItem) {
            existingItem.quantity += product.quantity || 1;
            existingItem.subtotal = existingItem.quantity * existingItem.price;
        } else {
            this.cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: product.quantity || 1,
                subtotal: product.price * (product.quantity || 1)
            });
        }
        
        this.saveCart();
        this.showNotification(`${product.name} ditambahkan ke keranjang`, 'success');
    }
    
    // Update item quantity
    updateQuantity(productId, quantity) {
        const item = this.cart.find(item => item.id === productId);
        
        if (item) {
            if (quantity <= 0) {
                this.removeItem(productId);
                return;
            }
            
            item.quantity = quantity;
            item.subtotal = item.quantity * item.price;
            this.saveCart();
        }
    }
    
    // Remove item from cart
    removeItem(productId) {
        const index = this.cart.findIndex(item => item.id === productId);
        
        if (index !== -1) {
            const removedItem = this.cart[index];
            this.cart.splice(index, 1);
            this.saveCart();
            this.showNotification(`${removedItem.name} dihapus dari keranjang`, 'info');
        }
    }
    
    // Clear cart
    clearCart() {
        this.cart = [];
        this.saveCart();
        this.showNotification('Keranjang dikosongkan', 'info');
    }
    
    // Get cart total
    getTotal() {
        return this.cart.reduce((total, item) => total + item.subtotal, 0);
    }
    
    // Get total items count
    getTotalItems() {
        return this.cart.reduce((count, item) => count + item.quantity, 0);
    }
    
    // Update cart count in navbar
    updateCartCount() {
        const cartCount = document.getElementById('cartCount');
        if (cartCount) {
            const totalItems = this.getTotalItems();
            
            if (totalItems > 0) {
                cartCount.textContent = totalItems;
                cartCount.classList.remove('hidden');
            } else {
                cartCount.classList.add('hidden');
            }
        }
    }
    
    // Render cart items
    renderCart() {
        const cartContainer = document.getElementById('cartItems');
        if (!cartContainer) return;
        
        if (this.cart.length === 0) {
            cartContainer.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-shopping-cart text-4xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500">Keranjang belanja kosong</p>
                    <a href="dashboard.html" class="inline-block mt-4 text-red-600 hover:text-red-700">
                        Mulai Belanja
                    </a>
                </div>
            `;
            return;
        }
        
        let html = '';
        this.cart.forEach(item => {
            html += `
                <div class="flex items-center border-b py-4" data-product-id="${item.id}">
                    <img src="${item.image || 'https://via.placeholder.com/60x60?text=Dimsum'}" 
                         alt="${item.name}" 
                         class="w-16 h-16 object-cover rounded-lg">
                    <div class="ml-4 flex-grow">
                        <h4 class="font-semibold">${item.name}</h4>
                        <p class="text-red-600 font-bold">Rp ${item.price.toLocaleString('id-ID')}</p>
                    </div>
                    <div class="flex items-center">
                        <button onclick="cart.updateQuantity(${item.id}, ${item.quantity - 1})" 
                                class="bg-gray-200 w-8 h-8 rounded-l-lg hover:bg-gray-300">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="bg-gray-50 w-10 h-8 flex items-center justify-center">${item.quantity}</span>
                        <button onclick="cart.updateQuantity(${item.id}, ${item.quantity + 1})" 
                                class="bg-gray-200 w-8 h-8 rounded-r-lg hover:bg-gray-300">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button onclick="cart.removeItem(${item.id})" 
                                class="ml-4 text-red-500 hover:text-red-700">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        cartContainer.innerHTML = html;
        this.updateCartTotal();
    }
    
    // Update cart total display
    updateCartTotal() {
        const totalEl = document.getElementById('cartTotal');
        const checkoutBtn = document.getElementById('checkoutBtn');
        
        if (totalEl) {
            totalEl.textContent = `Rp ${this.getTotal().toLocaleString('id-ID')}`;
        }
        
        if (checkoutBtn) {
            checkoutBtn.disabled = this.cart.length === 0;
        }
    }
    
    // Show notification
    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelectorAll('.cart-notification');
        existing.forEach(el => el.remove());
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = `cart-notification fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300 ${
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
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Sync cart with backend (for logged in users)
    async syncWithBackend() {
        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
        
        if (!user.id) {
            return; // User not logged in
        }
        
        try {
            const response = await fetch('/api/cart/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ items: this.cart }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to sync cart');
            }
        } catch (error) {
            console.error('Error syncing cart:', error);
        }
    }
    
    // Load cart from backend (for logged in users)
    async loadFromBackend() {
        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
        
        if (!user.id) {
            return; // User not logged in
        }
        
        try {
            const response = await fetch('/api/cart', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const backendCart = await response.json();
                
                // Merge with local cart
                if (backendCart.length > 0) {
                    this.cart = backendCart;
                    this.saveCart();
                    this.renderCart();
                }
            }
        } catch (error) {
            console.error('Error loading cart from backend:', error);
        }
    }
    
    // Checkout
    checkout() {
        if (this.cart.length === 0) {
            this.showNotification('Keranjang belanja kosong', 'error');
            return;
        }
        
        // Check if user is logged in
        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
        
        if (!user.id) {
            // Save cart and redirect to login
            this.saveCart();
            sessionStorage.setItem('redirectAfterLogin', 'payment.html');
            window.location.href = 'login.html';
            return;
        }
        
        // Redirect to payment page
        window.location.href = 'payment.html';
    }
}

// Initialize global cart instance
const cart = new ShoppingCart();

// Make cart available globally
window.cart = cart;

// Initialize cart functionality
document.addEventListener('DOMContentLoaded', function() {
    // Load cart from backend if user is logged in
    cart.loadFromBackend();
    
    // Render cart if on cart page
    if (document.getElementById('cartItems')) {
        cart.renderCart();
    }
    
    // Handle checkout button
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function() {
            cart.checkout();
        });
    }
    
    // Handle clear cart button
    const clearCartBtn = document.getElementById('clearCartBtn');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', function() {
            if (confirm('Apakah Anda yakin ingin mengosongkan keranjang?')) {
                cart.clearCart();
                cart.renderCart();
            }
        });
    }
    
    // Add to cart buttons
    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-add-to-cart]')) {
            const button = e.target.closest('[data-add-to-cart]');
            const productId = parseInt(button.dataset.productId);
            const productName = button.dataset.productName;
            const productPrice = parseFloat(button.dataset.productPrice);
            const productImage = button.dataset.productImage;
            
            cart.addItem({
                id: productId,
                name: productName,
                price: productPrice,
                image: productImage
            });
        }
    });
});

// Helper function to add product to cart from product card
function addToCart(productId, productName, price, image) {
    cart.addItem({
        id: productId,
        name: productName,
        price: price,
        image: image
    });
}