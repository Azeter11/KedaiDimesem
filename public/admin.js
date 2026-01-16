// Admin Panel JavaScript for Kedai Dimesem

// Load products for admin
async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        
        const tbody = document.getElementById('productsTable');
        tbody.innerHTML = '';
        
        products.forEach(product => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            
            row.innerHTML = `
                <td class="py-3 px-4">
                    <img src="${product.image || 'https://via.placeholder.com/50x50?text=Dimsum'}" 
                         alt="${product.name}" 
                         class="w-12 h-12 object-cover rounded">
                </td>
                <td class="py-3 px-4">
                    <div class="font-medium">${product.name}</div>
                    <div class="text-sm text-gray-500 truncate max-w-xs">${product.description || '-'}</div>
                </td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                        ${product.category || 'dimsum'}
                    </span>
                </td>
                <td class="py-3 px-4 font-semibold">Rp ${product.price.toLocaleString('id-ID')}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${product.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${product.is_active ? 'Aktif' : 'Non-Aktif'}
                    </span>
                </td>
                <td class="py-3 px-4">
                    <div class="flex space-x-2">
                        <button onclick="editProduct(${product.id})" 
                                class="text-blue-600 hover:text-blue-800" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteProduct(${product.id})" 
                                class="text-red-600 hover:text-red-800" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading products:', error);
        document.getElementById('productsTable').innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-gray-500">
                    Gagal memuat data produk
                </td>
            </tr>
        `;
    }
}

// Load transactions for admin
async function loadTransactions() {
    try {
        const response = await fetch('/api/transactions');
        const transactions = await response.json();
        
        const tbody = document.getElementById('transactionsTable');
        tbody.innerHTML = '';
        
        transactions.forEach(transaction => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            
            const statusClass = transaction.status === 'paid' ? 'bg-green-100 text-green-800' :
                              transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800';
            
            const statusText = transaction.status === 'paid' ? 'Lunas' :
                             transaction.status === 'pending' ? 'Pending' : 'Berhasil';
            
            const methodText = transaction.payment_method === 'transfer' ? 'Transfer' : 'COD';
            
            row.innerHTML = `
                <td class="py-3 px-4">${transaction.transaction_code}</td>
                <td class="py-3 px-4">${transaction.customer_name}</td>
                <td class="py-3 px-4">${new Date(transaction.created_at).toLocaleDateString('id-ID')}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        ${methodText}
                    </span>
                </td>
                <td class="py-3 px-4 font-semibold">Rp ${transaction.total_amount.toLocaleString('id-ID')}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td class="py-3 px-4">
                    <div class="flex space-x-2">
                        <button onclick="viewTransaction(${transaction.id})" 
                                class="text-green-600 hover:text-green-800" title="Lihat Detail">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="downloadInvoice(${transaction.id})" 
                                class="text-purple-600 hover:text-purple-800" title="Download Invoice">
                            <i class="fas fa-download"></i>
                        </button>
                        ${transaction.status === 'pending' ? `
                            <button onclick="updateTransactionStatus(${transaction.id}, 'paid')" 
                                    class="text-blue-600 hover:text-blue-800" title="Tandai sebagai Lunas">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading transactions:', error);
        document.getElementById('transactionsTable').innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-gray-500">
                    Gagal memuat data transaksi
                </td>
            </tr>
        `;
    }
}

// Load users for admin
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        
        const tbody = document.getElementById('usersTable');
        tbody.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            
            const roleClass = user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                            'bg-blue-100 text-blue-800';
            
            row.innerHTML = `
                <td class="py-3 px-4">
                    <div class="font-medium">${user.name}</div>
                </td>
                <td class="py-3 px-4">${user.email}</td>
                <td class="py-3 px-4">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${roleClass}">
                        ${user.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                </td>
                <td class="py-3 px-4">${new Date(user.created_at).toLocaleDateString('id-ID')}</td>
                <td class="py-3 px-4">
                    <div class="flex space-x-2">
                        ${user.role !== 'admin' ? `
                            <button onclick="promoteToAdmin(${user.id})" 
                                    class="text-green-600 hover:text-green-800 text-sm" title="Jadikan Admin">
                                <i class="fas fa-user-shield mr-1"></i>Admin
                            </button>
                        ` : ''}
                        <button onclick="resetUserPassword(${user.id})" 
                                class="text-yellow-600 hover:text-yellow-800 text-sm" title="Reset Password">
                            <i class="fas fa-key mr-1"></i>Reset
                        </button>
                    </div>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('usersTable').innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-gray-500">
                    Gagal memuat data pengguna
                </td>
            </tr>
        `;
    }
}

async function loadProductsSearch() {
    // 1. Ambil nilai dari elemen filter
    const search = document.getElementById('productSearch').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    const status = document.getElementById('statusFilter').value;

    try {
        // 2. Fetch data (Sesuaikan URL API Anda)
        const response = await fetch(`/api/products?search=${search}&category=${category}&status=${status}`);
        let products = await response.json();

        // 3. Render ke Tabel
        const tbody = document.getElementById('productsTable');
        tbody.innerHTML = '';

        products.forEach(product => {
            // Logika status aktif/non-aktif
            const statusLabel = product.is_active ? 'Aktif' : 'Non-Aktif';
            const statusClass = product.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

            const row = `
                <tr class="border-b hover:bg-gray-50">
                    <td class="py-3 px-4">
                        <img src="${product.image}" class="w-12 h-12 object-cover rounded shadow-sm">
                    </td>
                    <td class="py-3 px-4 font-medium">${product.name}</td>
                    <td class="py-3 px-4 capitalize">${product.category}</td>
                    <td class="py-3 px-4">${formatCurrency(product.price)}</td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
                            ${statusLabel}
                        </span>
                    </td>
                    <td class="py-3 px-4">
                        <button onclick="editProduct(${product.id})" class="text-blue-600 hover:text-blue-800 mr-3">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteProduct(${product.id})" class="text-red-600 hover:text-red-800">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
            tbody.insertAdjacentHTML('beforeend', row);
        });
    } catch (error) {
        console.error('Gagal memuat produk:', error);
    }
}

// Edit product
async function editProduct(productId) {
    try {
        const response = await fetch(`/api/products/${productId}`);
        const product = await response.json();
        
        showProductModal(product);
    } catch (error) {
        console.error('Error loading product for edit:', error);
        showNotification('Gagal memuat data produk', 'error');
    }
}

// Delete product
async function deleteProduct(productId) {
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/products/${productId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Produk berhasil dihapus!', 'success');
            loadProducts();
        } else {
            throw new Error('Failed to delete product');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        showNotification('Gagal menghapus produk', 'error');
    }
}

// View transaction details
async function viewTransaction(transactionId) {
    try {
        const response = await fetch(`/api/transactions/${transactionId}`);
        const transaction = await response.json();
        
        // Show transaction details in modal
        showTransactionModal(transaction);
    } catch (error) {
        console.error('Error loading transaction:', error);
        showNotification('Gagal memuat detail transaksi', 'error');
    }
}

document.getElementById('generateReport').addEventListener('click', function() {
    // Ambil elemen select
    const typeSelect = document.getElementById('reportType');
    const periodSelect = document.getElementById('reportPeriod');

    // Ambil VALUE-nya (contoh: "transactions"), bukan teks pilihannya
    const type = typeSelect.value; 
    const period = periodSelect.value;

    console.log("Mengirim ke server:", { type, period });

    const url = `/api/admin/generate-report?type=${type}&period=${period}`;
    window.open(url, '_blank');
});

// Download invoice
function downloadInvoice(transactionId) {
    window.open(`/api/generate-pdf/${transactionId}`, '_blank');
}

// Update transaction status
async function updateTransactionStatus(transactionId, status) {
    try {
        const response = await fetch(`/api/transactions/${transactionId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showNotification('Status transaksi berhasil diupdate!', 'success');
            loadTransactions();
            loadDashboardStats();
        } else {
            throw new Error('Failed to update transaction status');
        }
    } catch (error) {
        console.error('Error updating transaction:', error);
        showNotification('Gagal mengupdate status transaksi', 'error');
    }
}

// Promote user to admin
async function promoteToAdmin(userId) {
    if (!confirm('Apakah Anda yakin ingin menjadikan user ini sebagai admin?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${userId}/promote`, {
            method: 'PUT'
        });
        
        if (response.ok) {
            showNotification('User berhasil dijadikan admin!', 'success');
            loadUsers();
        } else {
            throw new Error('Failed to promote user');
        }
    } catch (error) {
        console.error('Error promoting user:', error);
        showNotification('Gagal menjadikan user sebagai admin', 'error');
    }
}

// Reset user password
async function resetUserPassword(userId) {
    if (!confirm('Reset password user ini ke default (password123)?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${userId}/reset-password`, {
            method: 'PUT'
        });
        
        if (response.ok) {
            showNotification('Password berhasil direset ke "password123"', 'success');
        } else {
            throw new Error('Failed to reset password');
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        showNotification('Gagal mereset password', 'error');
    }
}

// Show transaction modal
function showTransactionModal(transaction) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    
    const statusClass = transaction.status === 'paid' ? 'bg-green-100 text-green-800' :
                      transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800';
    
    const statusText = transaction.status === 'paid' ? 'Lunas' :
                     transaction.status === 'pending' ? 'Pending' : 'Berhasil';
    
    const methodText = transaction.payment_method === 'transfer' ? 'Transfer' : 'COD';
    
    modal.innerHTML = `
        <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div class="p-6">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-xl font-semibold">Detail Transaksi</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <div class="space-y-6">
                    <!-- Transaction Info -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p class="text-sm text-gray-500">ID Transaksi</p>
                            <p class="font-semibold">${transaction.transaction_code}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Tanggal</p>
                            <p class="font-semibold">${new Date(transaction.created_at).toLocaleString('id-ID')}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Status</p>
                            <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
                                ${statusText}
                            </span>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Metode Pembayaran</p>
                            <p class="font-semibold">${methodText}</p>
                        </div>
                    </div>
                    
                    <!-- Customer Info -->
                    <div class="border-t pt-6">
                        <h4 class="font-semibold mb-4">Informasi Pelanggan</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p class="text-sm text-gray-500">Nama</p>
                                <p class="font-medium">${transaction.customer_name}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Alamat</p>
                                <p class="font-medium">${transaction.customer_address}</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Order Items -->
                    <div class="border-t pt-6">
                        <h4 class="font-semibold mb-4">Daftar Pesanan</h4>
                        <div class="overflow-x-auto">
                            <table class="w-full">
                                <thead>
                                    <tr class="border-b">
                                        <th class="text-left py-2 px-4">Produk</th>
                                        <th class="text-left py-2 px-4">Harga</th>
                                        <th class="text-left py-2 px-4">Jumlah</th>
                                        <th class="text-left py-2 px-4">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${transaction.items ? transaction.items.map(item => `
                                        <tr class="border-b">
                                            <td class="py-3 px-4">${item.product_name}</td>
                                            <td class="py-3 px-4">Rp ${item.price.toLocaleString('id-ID')}</td>
                                            <td class="py-3 px-4">${item.quantity}</td>
                                            <td class="py-3 px-4 font-semibold">Rp ${item.subtotal.toLocaleString('id-ID')}</td>
                                        </tr>
                                    `).join('') : ''}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <!-- Total -->
                    <div class="border-t pt-6">
                        <div class="flex justify-between items-center">
                            <span class="text-lg font-semibold">Total Pembayaran</span>
                            <span class="text-2xl font-bold text-red-600">
                                Rp ${transaction.total_amount.toLocaleString('id-ID')}
                            </span>
                        </div>
                    </div>
                    
                    <!-- Actions -->
                    <div class="border-t pt-6 flex justify-end space-x-4">
                        <button onclick="this.closest('.fixed').remove()" 
                                class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                            Tutup
                        </button>
                        <button onclick="downloadInvoice(${transaction.id})" 
                                class="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg">
                            <i class="fas fa-download mr-2"></i>Download Invoice
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Filter products
document.addEventListener('DOMContentLoaded', function() {
    const productSearch = document.getElementById('productSearch');
    const categoryFilter = document.getElementById('categoryFilter');
    const statusFilter = document.getElementById('statusFilter');
    
    if (productSearch) {
        productSearch.addEventListener('input', debounce(function() {
            filterProductsTable();
        }, 300));
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterProductsTable);
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', filterProductsTable);
    }
});

function filterProductsTable() {
    const searchTerm = document.getElementById('productSearch').value.toLowerCase().trim();
    const category = document.getElementById('categoryFilter').value.toLowerCase().trim();
    const status = document.getElementById('statusFilter').value; // 'active', 'inactive', atau ''
    
    const rows = document.querySelectorAll('#productsTable tr');
    
    rows.forEach(row => {
        // Ambil teks dan bersihkan (trim & lowercase)
        const name = row.querySelector('td:nth-child(2) .font-medium')?.textContent.toLowerCase().trim() || '';
        const desc = row.querySelector('td:nth-child(2) .text-gray-500')?.textContent.toLowerCase().trim() || '';
        const rowCategory = row.querySelector('td:nth-child(3) span')?.textContent.toLowerCase().trim() || '';
        const rowStatus = row.querySelector('td:nth-child(5) span')?.textContent.toLowerCase().trim() || '';
        
        // Logika Pencarian
        const matchesSearch = name.includes(searchTerm) || desc.includes(searchTerm);
        
        // Logika Kategori (Jika category kosong/all, anggap match)
        const matchesCategory = !category || rowCategory === category;
        
        // Logika Status
        let matchesStatus = true;
        if (status === 'active') {
            matchesStatus = (rowStatus === 'aktif');
        } else if (status === 'inactive') {
            matchesStatus = (rowStatus === 'non-aktif' || rowStatus === 'non-aktif');
        }
        
        // Tampilkan hanya jika semua kriteria terpenuhi
        if (matchesSearch && matchesCategory && matchesStatus) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}



// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}