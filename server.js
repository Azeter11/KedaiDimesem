const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
const fs = require('fs');

// Inisialisasi app Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true, // ← ALLOW credentials (cookies)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Session configuration
app.use(session({
    secret: 'kedai-dimesem-secret-key-2025',
    resave: false, // Diubah ke false agar lebih stabil
    saveUninitialized: false, 
    cookie: { 
        secure: false, // false jika menggunakan http://localhost
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax'
    },
    store: new session.MemoryStore()
}));

// MySQL Database Connection Pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '', // Sesuaikan dengan password MySQL Anda
    database: 'kedai_dimesem11',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
    }
}

// Helper function untuk query database
async function query(sql, params = []) {
    try {
        const [results] = await pool.execute(sql, params);
        return results;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file gambar yang diperbolehkan (jpeg, jpg, png, gif, webp)'));
        }
    }
});

// Middleware untuk menangani error upload
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Error upload file: ${err.message}` });
    } else if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
};

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized - Silakan login terlebih dahulu' });
    }
};

const isAdmin = (req, res, next) => {
    console.log("Cek Session Role:", req.session.role); // Ini akan muncul di terminal CMD/VSCode
    if (req.session.userId && req.session.role === 'admin') {
        next();
    } else {
        res.status(403).json({ 
            error: 'Forbidden', 
            message: 'Anda harus login sebagai admin',
            currentRole: req.session.role 
        });
    }
};

// ==================== AUTHENTICATION ENDPOINTS ====================

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Semua field harus diisi' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password minimal 6 karakter' });
        }
        
        // Check if email already exists
        const existingUser = await query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Email sudah terdaftar' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert user
        const result = await query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );
        
        res.status(201).json({ 
            success: true, 
            message: 'Registrasi berhasil',
            userId: result.insertId 
        });
        
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Login
// Login endpoint - PERBAIKAN
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = await query('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) return res.status(401).json({ error: 'Email salah' });

        const user = users[0];
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ error: 'Password salah' });

        // SIMPAN KE SESSION
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.name = user.name;

        // Paksa simpan sebelum kirim response
        req.session.save((err) => {
            if (err) return res.status(500).json({ error: 'Gagal buat session' });
            res.json({
                success: true,
                user: { id: user.id, name: user.name, role: user.role }
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Gagal logout' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logout berhasil' });
    });
});

// Check auth status
app.get('/api/auth/check', (req, res) => {
    if (req.session.userId) {
        res.json({
            authenticated: true,
            user: {
                id: req.session.userId,
                name: req.session.name,
                role: req.session.role
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// ==================== PRODUCTS ENDPOINTS ====================

// Get all products (public)
app.get('/api/products', async (req, res) => {
    try {
        const products = await query(`
            SELECT * FROM products 
            WHERE is_active = TRUE 
            ORDER BY created_at DESC
        `);
        
        // Add full URL for images
        const productsWithImageUrl = products.map(product => ({
            ...product,
            image: product.image ? `${req.protocol}://${req.get('host')}/uploads/${product.image}` : null
        }));
        
        res.json(productsWithImageUrl);
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Gagal mengambil data produk' });
    }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const products = await query('SELECT * FROM products WHERE id = ?', [id]);
        
        if (products.length === 0) {
            return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }
        
        const product = products[0];
        if (product.image) {
            product.image = `${req.protocol}://${req.get('host')}/uploads/${product.image}`;
        }
        
        res.json(product);
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Gagal mengambil data produk' });
    }
});

// Create product (admin only)
app.post('/api/products', isAdmin, upload.single('image'), handleUploadError, async (req, res) => {
    try {
        const { name, description, price, category } = req.body;
        
        if (!name || !price) {
            return res.status(400).json({ error: 'Nama dan harga harus diisi' });
        }
        
        const image = req.file ? req.file.filename : null;
        
        const result = await query(
            `INSERT INTO products (name, description, price, image, category) 
             VALUES (?, ?, ?, ?, ?)`,
            [name, description, parseFloat(price), image, category || 'dimsum']
        );
        
        res.status(201).json({
            success: true,
            message: 'Produk berhasil ditambahkan',
            productId: result.insertId
        });
        
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Gagal menambahkan produk' });
    }
});

// Konfigurasi Database
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kedai_dimesem' // Sesuaikan dengan nama DB di .sql Anda
});

// Update product (admin only)
app.put('/api/products/:id', isAdmin, upload.single('image'), handleUploadError, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, category, is_active } = req.body;
        
        // Check if product exists
        const products = await query('SELECT * FROM products WHERE id = ?', [id]);
        if (products.length === 0) {
            return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }
        
        // Build update query
        const updates = [];
        const values = [];
        
        if (name) { updates.push('name = ?'); values.push(name); }
        if (description !== undefined) { updates.push('description = ?'); values.push(description); }
        if (price) { updates.push('price = ?'); values.push(parseFloat(price)); }
        if (category) { updates.push('category = ?'); values.push(category); }
        if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active === '1' || is_active === true); }
        if (req.file) { updates.push('image = ?'); values.push(req.file.filename); }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'Tidak ada data yang diupdate' });
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        
        await query(
            `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        
        res.json({ success: true, message: 'Produk berhasil diupdate' });
        
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Gagal mengupdate produk' });
    }
});

// Delete product (admin only)
app.delete('/api/products/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if product exists
        const products = await query('SELECT * FROM products WHERE id = ?', [id]);
        if (products.length === 0) {
            return res.status(404).json({ error: 'Produk tidak ditemukan' });
        }
        
        // Check if product has transactions
        const transactionItems = await query(
            'SELECT COUNT(*) as count FROM transaction_items WHERE product_id = ?',
            [id]
        );
        
        if (transactionItems[0].count > 0) {
            // Soft delete: set is_active to false
            await query('UPDATE products SET is_active = FALSE WHERE id = ?', [id]);
            res.json({ success: true, message: 'Produk dinonaktifkan (masih ada dalam transaksi)' });
        } else {
            // Hard delete
            await query('DELETE FROM products WHERE id = ?', [id]);
            res.json({ success: true, message: 'Produk berhasil dihapus' });
        }
        
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Gagal menghapus produk' });
    }
});

app.get('/api/make-me-admin', async (req, res) => {
    try {
        await query("UPDATE users SET role = 'admin' WHERE email = ?", [req.session.email]);
        req.session.role = 'admin'; // Update session saat ini
        res.send("Status role di database dan session sudah menjadi admin. Silakan refresh dashboard.");
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// ==================== SEARCH ENDPOINT (PERBAIKAN) ====================
// Endpoint Pencarian Produk Langsung ke Database
app.get('/api/search', async (req, res) => {
    try {
        const keyword = req.query.q;

        // Jika tidak ada kata kunci, kembalikan semua produk
        if (!keyword || keyword.trim() === "") {
            const allProducts = await query("SELECT * FROM products");
            return res.json(allProducts);
        }

        // Menyiapkan pattern SQL LIKE (contoh: %siomay%)
        const searchPattern = `%${keyword}%`;

        // Eksekusi query ke database
        // Sesuaikan nama tabel 'products' dan kolom 'name'/'category' dengan DB Anda
        const results = await query(
            "SELECT * FROM products WHERE name LIKE ? OR category LIKE ?",
            [searchPattern, searchPattern]
        );

        // Selalu pastikan mengirimkan array kembali ke frontend
        // Meskipun hasil kosong, kirimkan [] agar .map() tidak error
        res.json(results || []);

    } catch (error) {
        console.error('Database Search Error:', error);
        res.status(500).json({ 
            error: "Gagal mengambil data dari database",
            details: [] 
        });
    }
});

// ==================== CART ENDPOINTS ====================

// Get user cart
app.get('/api/cart', isAuthenticated, async (req, res) => {
    try {
        // Note: In this implementation, cart is stored in localStorage
        // This endpoint is for syncing cart for logged in users
        const userId = req.session.userId;
        
        // You can implement cart persistence in database here if needed
        res.json({ 
            success: true, 
            message: 'Cart loaded from localStorage',
            items: [] 
        });
        
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ error: 'Gagal mengambil data keranjang' });
    }
});

// Sync cart (save cart to database for logged in users)
app.post('/api/cart/sync', isAuthenticated, async (req, res) => {
    try {
        const { items } = req.body;
        const userId = req.session.userId;
        
        // Implement cart persistence logic here if needed
        // For now, just acknowledge the sync
        
        res.json({ 
            success: true, 
            message: 'Cart synced successfully'
        });
        
    } catch (error) {
        console.error('Sync cart error:', error);
        res.status(500).json({ error: 'Gagal menyinkronkan keranjang' });
    }
});

// ==================== TRANSACTIONS ENDPOINTS ====================

// Create transaction (checkout)
app.post('/api/checkout', isAuthenticated, async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const userId = req.session.userId;
        const {
            customer_name,
            customer_email,
            customer_phone,
            customer_address,
            customer_note,
            payment_method,
            items,
            subtotal,
            shipping,
            total_amount
        } = req.body;
        
        console.log('Checkout request body:', req.body);
        
        // 1. Validasi Field Utama
        if (!customer_name || !customer_address || !payment_method || !items || items.length === 0) {
            await connection.rollback();
            return res.status(400).json({ 
                error: 'Data transaksi tidak lengkap',
                missing: {
                    customer_name: !customer_name,
                    customer_address: !customer_address,
                    payment_method: !payment_method,
                    items: !items || items.length === 0
                }
            });
        }
        
        // 2. Validasi Struktur Item (Dibuat lebih fleksibel)
        for (const item of items) {
            // Cek ID (bisa productId atau id)
            const pId = item.productId || item.id; 
            // Cek Nama (bisa productName atau name)
            const pName = item.productName || item.name;
            const hasPrice = item.price !== undefined && item.price !== null;
            const hasQuantity = item.quantity !== undefined && item.quantity !== null;

            if (!pId || !pName || !hasPrice || !hasQuantity) {
                console.log('Validation Failed for item:', item);
                await connection.rollback();
                return res.status(400).json({ 
                    error: 'Struktur item tidak valid',
                    details: item,
                    message: 'Setiap item wajib memiliki ID, Nama, Harga, dan Jumlah.'
                });
            }
        }
        
        // 3. Generate Kode Transaksi
        const transactionCode = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // 4. Hitung Total (Lebih aman hitung di server)
        const calculatedSubtotal = items.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0);
        const fixedShipping = 10000;
        const finalTotal = calculatedSubtotal + fixedShipping;
        
        // 5. Simpan ke Tabel Transactions
        const [transactionResult] = await connection.execute(
            `INSERT INTO transactions 
             (user_id, transaction_code, customer_name, customer_email, customer_phone, 
              customer_address, customer_note, payment_method, total_amount, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                userId || null,
                transactionCode,
                customer_name,
                customer_email || '',
                customer_phone || '',
                customer_address,
                customer_note || '',
                payment_method,
                finalTotal
            ]
        );
        
        const transactionId = transactionResult.insertId;
        
        // 6. Simpan ke Tabel Transaction_items
        for (const item of items) {
            const pId = item.productId || item.id;
            const pName = item.productName || item.name;
            const qty = parseInt(item.quantity);
            const price = parseFloat(item.price);
            const sub = qty * price;

            await connection.execute(
                `INSERT INTO transaction_items 
                 (transaction_id, product_id, product_name, quantity, price, subtotal) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [transactionId, pId, pName, qty, price, sub]
            );
        }
        
        await connection.commit();
        
        res.status(201).json({
            success: true,
            message: 'Transaksi berhasil dibuat',
            transactionId: transactionId,
            transactionCode: transactionCode
        });
        
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Checkout error:', error);
        res.status(500).json({ 
            error: 'Gagal memproses checkout',
            details: error.message 
        });
    } finally {
        if (connection) connection.release();
    }
});

// Get all transactions (admin only)
app.get('/api/transactions', isAdmin, async (req, res) => {
    try {
        const transactions = await query(`
            SELECT t.*, u.name as user_name, u.email as user_email
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC
        `);
        
        res.json(transactions);
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Gagal mengambil data transaksi' });
    }
});

// Get recent transactions (for dashboard)
app.get('/api/transactions/recent', isAdmin, async (req, res) => {
    try {
        const transactions = await query(`
            SELECT * FROM transactions 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        // Jika query berhasil, 'transactions' adalah Array
        res.json(transactions); 
    } catch (error) {
        console.error('Recent Transactions Error:', error);
        res.status(500).json([]); // Kirim array kosong agar .slice() di frontend tidak error
    }
});

// Get transaction by ID
// Get transaction by ID
app.get('/api/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get transaction dengan info user (jika ada)
        // t.* akan mengambil customer_email, customer_phone, customer_address, dll.
        const transactions = await query(`
            SELECT t.*, u.name as user_account_name, u.email as user_account_email
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.id = ?
        `, [id]);
        
        if (transactions.length === 0) {
            return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
        }
        
        const transaction = transactions[0];
        
        // Get transaction items (Jangan lupa join dengan produk untuk ambil nama produknya)
        const items = await query(`
            SELECT ti.*, p.name as product_name 
            FROM transaction_items ti
            LEFT JOIN products p ON ti.product_id = p.id
            WHERE ti.transaction_id = ?
        `, [id]);
        
        transaction.items = items;
        
        res.json(transaction);
    } catch (error) {
        console.error('Get transaction error:', error);
        res.status(500).json({ error: 'Gagal mengambil data transaksi' });
    }
});

// Update transaction status (admin only)
// Update transaction status (admin only)
app.put('/api/transactions/:id/status', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        // SESUAIKAN: Tambahkan 'completed' sesuai ENUM database baru
        const validStatuses = ['pending', 'paid', 'cancelled', 'completed'];
        
        // Gunakan toLowerCase untuk memastikan kecocokan dengan ENUM database
        const normalizedStatus = status ? status.toLowerCase() : '';

        if (!validStatuses.includes(normalizedStatus)) {
            return res.status(400).json({ error: 'Status tidak valid' });
        }
        
        const result = await query(
            'UPDATE transactions SET status = ? WHERE id = ?',
            [normalizedStatus, id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
        }
        
        res.json({ 
            success: true, 
            message: `Status transaksi berhasil diupdate menjadi ${normalizedStatus}` 
        });
        
    } catch (error) {
        console.error('Update transaction status error:', error);
        res.status(500).json({ error: 'Gagal mengupdate status transaksi' });
    }
});

// ==================== USERS ENDPOINTS ====================

// Get all users (admin only)
app.get('/api/users', isAdmin, async (req, res) => {
    try {
        const users = await query(`
            SELECT id, name, email, role, created_at 
            FROM users 
            ORDER BY created_at DESC
        `);
        
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Gagal mengambil data pengguna' });
    }
});

// Promote user to admin
app.put('/api/users/:id/promote', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await query(
            'UPDATE users SET role = "admin" WHERE id = ?',
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
        }
        
        res.json({ success: true, message: 'Pengguna berhasil dijadikan admin' });
        
    } catch (error) {
        console.error('Promote user error:', error);
        res.status(500).json({ error: 'Gagal menjadikan pengguna sebagai admin' });
    }
});

// Reset user password (admin only)
app.put('/api/users/:id/reset-password', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Generate new password
        const newPassword = 'password123';
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        const result = await query(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
        }
        
        res.json({ 
            success: true, 
            message: 'Password berhasil direset',
            newPassword: newPassword // Only for admin to see
        });
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Gagal mereset password' });
    }
});

// ==================== DASHBOARD STATS ENDPOINTS ====================

// Get dashboard statistics (admin only)
app.get('/api/admin/stats', isAdmin, async (req, res) => {
    try {
        // Query database secara paralel untuk efisiensi
        const [transResult, revenueResult, prodResult, usersResult] = await Promise.all([
            query('SELECT COUNT(*) as count FROM transactions'),
            query("SELECT SUM(total_amount) as total FROM transactions WHERE status = 'paid'"),
            query('SELECT COUNT(*) as count FROM products WHERE is_active = TRUE'),
            query('SELECT COUNT(*) as count FROM users')
        ]);

        // Kirim response dengan pengecekan null/undefined
        res.json({
            total_transactions: transResult[0]?.count || 0,
            total_revenue: parseFloat(revenueResult[0]?.total) || 0,
            total_products: prodResult[0]?.count || 0,
            total_users: usersResult[0]?.count || 0
        });
    } catch (error) {
        console.error('Stats Error:', error); // Log ini penting untuk debugging
        res.status(500).json({ error: 'Gagal memuat statistik' });
    }
});

app.get('/api/admin/recent-transactions', async (req, res) => {
    try {
        // Query disesuaikan dengan skema tabel: transactions
        const recentRows = await query(`
            SELECT transaction_code, customer_name, total_amount, status, created_at 
            FROM transactions 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        res.json(recentRows);
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ error: 'Gagal mengambil transaksi terbaru' });
    }
});


// ==================== PDF GENERATION ENDPOINT ====================

// Generate PDF invoice yang lebih menarik
app.get('/api/generate-pdf/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Ambil data transaksi
        const transactions = await query(`
            SELECT t.*, u.name as user_name, u.email as user_email
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.id = ?
        `, [id]);
        
        if (transactions.length === 0) {
            return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
        }
        
        const transaction = transactions[0];
        const items = await query(`SELECT * FROM transaction_items WHERE transaction_id = ?`, [id]);
        
        // 2. Inisialisasi PDF
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${transaction.transaction_code}.pdf`);
        doc.pipe(res);

        // --- STYLING & COLORS ---
        const primaryColor = '#4a2d00'; // Cokelat Tua Kedai Dimesem
        const secondaryColor = '#8d6e63';
        const accentColor = '#fcf8f3'; // Background krem muda

        // --- HEADER BACKGROUND ---
        doc.rect(0, 0, 600, 130).fill(primaryColor);
        
        // --- LOGO / TITLE ---
        doc.fillColor('#ffffff')
           .font('Helvetica-Bold')
           .fontSize(25)
           .text('KEDAI DIMESEM', 50, 45);
        
        doc.fontSize(10)
           .font('Helvetica')
           .text('Dimsum Lezat & Berkualitas Terbaik', 50, 75, { opacity: 0.8 });

        // --- INVOICE LABEL ---
        doc.fontSize(30)
           .font('Helvetica-Bold')
           .text('INVOICE', 350, 45, { align: 'right', width: 200 });
        
        doc.fontSize(10)
           .font('Helvetica')
           .text(`#${transaction.transaction_code}`, 350, 80, { align: 'right', width: 200 });

        // --- CUSTOMER & ORDER INFO ---
        doc.fillColor('#444444').font('Helvetica');
        let infoTop = 150;

        // Kolom Kiri: Customer
        doc.fontSize(10).fillColor(secondaryColor).font('Helvetica-Bold').text('DITAGIHKAN KEPADA:', 50, infoTop);
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(12).text(transaction.customer_name.toUpperCase(), 50, infoTop + 15);
        doc.font('Helvetica').fontSize(10).fillColor('#444444')
           .text(transaction.customer_email || '-', 50, infoTop + 32)
           .text(transaction.customer_phone || '-', 50, infoTop + 45)
           .text(transaction.customer_address, 50, infoTop + 58, { width: 200 });

        // Kolom Kanan: Detail Transaksi
        doc.fontSize(10).fillColor(secondaryColor).font('Helvetica-Bold').text('DETAIL TRANSAKSI:', 350, infoTop);
        doc.fillColor('#444444').font('Helvetica');
        doc.text(`Tanggal Periksa:`, 350, infoTop + 15);
        doc.text(`${new Date(transaction.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 450, infoTop + 15, { align: 'right' });
        
        doc.text(`Metode Bayar:`, 350, infoTop + 30);
        doc.text(`${transaction.payment_method.toUpperCase()}`, 450, infoTop + 30, { align: 'right' });
        
        doc.text(`Status:`, 350, infoTop + 45);
        const statusColor = transaction.status === 'paid' ? '#2e7d32' : '#ed6c02';
        doc.fillColor(statusColor).font('Helvetica-Bold').text(`${transaction.status === 'paid' ? 'LUNAS' : 'PENDING'}`, 450, infoTop + 45, { align: 'right' });

        // --- TABLE ITEMS ---
        let tableTop = 260;
        doc.rect(50, tableTop, 500, 25).fill(primaryColor); // Header Tabel
        
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
        doc.text('PRODUK', 60, tableTop + 7);
        doc.text('HARGA', 250, tableTop + 7, { width: 100, align: 'right' });
        doc.text('QTY', 360, tableTop + 7, { width: 50, align: 'center' });
        doc.text('TOTAL', 450, tableTop + 7, { width: 90, align: 'right' });

        let itemY = tableTop + 35;
        doc.fillColor('#000000').font('Helvetica');

        items.forEach((item, i) => {
            // Beri warna zebra selang seling
            if (i % 2 !== 0) {
                doc.rect(50, itemY - 5, 500, 20).fill(accentColor);
            }
            
            doc.fillColor('#000000');
            doc.text(item.product_name, 60, itemY);
            doc.text(`Rp ${item.price.toLocaleString('id-ID')}`, 250, itemY, { width: 100, align: 'right' });
            doc.text(item.quantity.toString(), 360, itemY, { width: 50, align: 'center' });
            doc.text(`Rp ${item.subtotal.toLocaleString('id-ID')}`, 450, itemY, { width: 90, align: 'right' });
            
            itemY += 22;
        });

        // --- SUMMARY ---
        doc.moveTo(50, itemY).lineTo(550, itemY).strokeColor('#eeeeee').stroke();
        itemY += 15;

        const subtotal = transaction.total_amount - 10000;
        
        // Subtotal
        doc.fontSize(10).fillColor('#666666').text('Subtotal', 350, itemY);
        doc.fillColor('#000000').text(`Rp ${subtotal.toLocaleString('id-ID')}`, 450, itemY, { align: 'right' });
        
        // Ongkir
        itemY += 18;
        doc.fillColor('#666666').text('Biaya Pengiriman', 350, itemY);
        doc.fillColor('#000000').text(`Rp 10.000`, 450, itemY, { align: 'right' });

        // Total
        itemY += 25;
        doc.rect(340, itemY - 10, 210, 30).fill(accentColor);
        doc.fontSize(12).fillColor(primaryColor).font('Helvetica-Bold').text('TOTAL AKHIR', 350, itemY);
        doc.text(`Rp ${transaction.total_amount.toLocaleString('id-ID')}`, 450, itemY, { align: 'right' });

        // --- FOOTER ---
        const footerY = 750;
        doc.rect(0, 810, 600, 40).fill(primaryColor);
        
        doc.fillColor('#444444').font('Helvetica').fontSize(9)
           .text('Terima kasih telah memesan di Kedai Dimesem!', 50, footerY, { align: 'center', width: 500 });
        doc.text('Simpan invoice ini sebagai bukti pembayaran yang sah.', 50, footerY + 12, { align: 'center', width: 500 });
        
        doc.fillColor('#ffffff').fontSize(8)
           .text('www.kedaidimesem.com | Hubungi Kami: 0878-XXXX-XXXX', 50, 825, { align: 'center', width: 500 });

        // Finalisasi
        doc.end();
        
    } catch (error) {
        console.error('Generate PDF error:', error);
        res.status(500).json({ error: 'Gagal membuat PDF invoice' });
    }
});

// Endpoint Baru: Generate Report Admin
app.get('/api/admin/generate-report', async (req, res) => {
    try {
        const { type, period } = req.query;
        let querySql = "";
        let dateFilter = "";

        // 1. Logika Filter Periode
        if (period === 'today') {
            dateFilter = "AND DATE(t.created_at) = CURDATE()";
        } else if (period === 'week') {
            dateFilter = "AND t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        } else if (period === 'month') {
            dateFilter = "AND t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        } else if (period === 'year') {
            dateFilter = "AND YEAR(t.created_at) = YEAR(CURDATE())";
        }

        // 2. Logika Jenis Laporan
        if (type === 'transactions') {
            querySql = `SELECT t.* FROM transactions t WHERE 1=1 ${dateFilter} ORDER BY t.created_at DESC`;
        } else if (type === 'sales') {
            querySql = `SELECT ti.*, t.transaction_code, t.created_at, p.name as product_name 
                        FROM transaction_items ti 
                        JOIN transactions t ON ti.transaction_id = t.id 
                        LEFT JOIN products p ON ti.product_id = p.id
                        WHERE t.status = 'paid' ${dateFilter} ORDER BY t.created_at DESC`;
        } else if (type === 'products') {
            querySql = "SELECT * FROM products ORDER BY category ASC";
        }

        if (!querySql) return res.status(400).json({ error: "Tipe tidak dikenali" });

        const data = await query(querySql);
        if (data.length === 0) return res.status(404).send("Data tidak ditemukan.");

        // --- PROSES PDF ---
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=laporan-${type}.pdf`);
        doc.pipe(res);

        // HEADER: Kotak Berwarna
        doc.rect(0, 0, 612, 100).fill('#4b3621'); // Warna Coklat Gelap
        doc.fillColor('#ffffff').fontSize(20).text('DIMSUM KITCHEN - LAPORAN', 50, 40);
        doc.fontSize(10).text(`Jenis: ${type.toUpperCase()} | Periode: ${period.toUpperCase()}`, 50, 65);
        doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 50, 80);

        doc.moveDown(4);
        doc.fillColor('#333333');

        // TABEL LOGIC
        const tableTop = 150;
        const itemCodeX = 50;
        const nameX = 150;
        const dateX = 350;
        const amountX = 450;

        // Tabel Header
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('KODE/ID', itemCodeX, tableTop);
        doc.text('KETERANGAN', nameX, tableTop);
        doc.text('TANGGAL', dateX, tableTop);
        doc.text('TOTAL', amountX, tableTop, { align: 'right' });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#aaaaaa').stroke();

        // Tabel Rows
        let currentY = tableTop + 25;
        let grandTotal = 0;

        doc.font('Helvetica');
        data.forEach((item, i) => {
            const label = item.transaction_code || `PRD-${item.id}`;
            const desc = item.customer_name || item.product_name || item.name;
            const date = item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-';
            const amount = parseFloat(item.total_amount || item.price || 0);
            grandTotal += amount;

            // Zebra Striping (Baris selang-seling abu-abu)
            if (i % 2 === 0) {
                doc.rect(50, currentY - 5, 500, 20).fill('#f9f9f9').fillColor('#333333');
            }

            doc.text(label, itemCodeX, currentY);
            doc.text(desc.substring(0, 30), nameX, currentY);
            doc.text(date, dateX, currentY);
            doc.text(`Rp ${amount.toLocaleString('id-ID')}`, amountX, currentY, { align: 'right' });

            currentY += 20;

            // Jika halaman penuh, tambah halaman baru
            if (currentY > 700) {
                doc.addPage();
                currentY = 50;
            }
        });

        // FOOTER: Total Keseluruhan
        doc.moveDown();
        doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('GRAND TOTAL:', nameX, currentY + 10);
        doc.fillColor('#4b3621').text(`Rp ${grandTotal.toLocaleString('id-ID')}`, amountX, currentY + 10, { align: 'right' });

        doc.end();

    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ==================== STATIC PAGES ====================

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/admin', isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/payment', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'payment.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Terjadi kesalahan server',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    testConnection();
});

module.exports = app;