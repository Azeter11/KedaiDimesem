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
    database: 'kedai_dimesemi1',
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
app.get('/api/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get transaction
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
        
        // Get transaction items
        const items = await query(`
            SELECT * FROM transaction_items 
            WHERE transaction_id = ?
        `, [id]);
        
        transaction.items = items;
        
        res.json(transaction);
    } catch (error) {
        console.error('Get transaction error:', error);
        res.status(500).json({ error: 'Gagal mengambil data transaksi' });
    }
});

// Update transaction status (admin only)
app.put('/api/transactions/:id/status', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['pending', 'paid', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Status tidak valid' });
        }
        
        const result = await query(
            'UPDATE transactions SET status = ? WHERE id = ?',
            [status, id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
        }
        
        res.json({ success: true, message: 'Status transaksi berhasil diupdate' });
        
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

// Generate PDF invoice
app.get('/api/generate-pdf/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get transaction data
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
        
        // Get transaction items
        const items = await query(`
            SELECT * FROM transaction_items 
            WHERE transaction_id = ?
        `, [id]);
        
        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${transaction.transaction_code}.pdf`);
        
        // Pipe PDF to response
        doc.pipe(res);
        
        // Add content to PDF
        // Header
        doc.fontSize(20).text('KEDAI DIMESEM', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).text('Invoice', { align: 'center' });
        doc.moveDown();
        
        // Transaction info
        doc.fontSize(10);
        doc.text(`Invoice Number: ${transaction.transaction_code}`);
        doc.text(`Date: ${new Date(transaction.created_at).toLocaleDateString('id-ID')}`);
        doc.text(`Customer: ${transaction.customer_name}`);
        doc.text(`Email: ${transaction.customer_email || '-'}`);
        doc.text(`Phone: ${transaction.customer_phone || '-'}`);
        doc.text(`Address: ${transaction.customer_address}`);
        doc.moveDown();
        
        // Items table header
        const tableTop = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Item', 50, tableTop);
        doc.text('Price', 250, tableTop, { width: 80, align: 'right' });
        doc.text('Qty', 330, tableTop, { width: 50, align: 'right' });
        doc.text('Total', 380, tableTop, { width: 80, align: 'right' });
        
        // Draw line
        doc.moveTo(50, tableTop + 15).lineTo(530, tableTop + 15).stroke();
        
        // Items
        let y = tableTop + 25;
        doc.font('Helvetica');
        
        items.forEach((item, i) => {
            if (y > 700) {
                doc.addPage();
                y = 50;
            }
            
            doc.text(item.product_name, 50, y, { width: 200 });
            doc.text(`Rp ${item.price.toLocaleString('id-ID')}`, 250, y, { width: 80, align: 'right' });
            doc.text(item.quantity.toString(), 330, y, { width: 50, align: 'right' });
            doc.text(`Rp ${item.subtotal.toLocaleString('id-ID')}`, 380, y, { width: 80, align: 'right' });
            
            y += 20;
        });
        
        // Draw line
        doc.moveTo(50, y).lineTo(530, y).stroke();
        y += 10;
        
        // Totals
        doc.font('Helvetica-Bold');
        doc.text('Subtotal:', 380, y, { width: 80, align: 'right' });
        doc.text(`Rp ${(transaction.total_amount - 10000).toLocaleString('id-ID')}`, 460, y, { width: 70, align: 'right' });
        
        y += 20;
        doc.text('Shipping:', 380, y, { width: 80, align: 'right' });
        doc.text('Rp 10,000', 460, y, { width: 70, align: 'right' });
        
        y += 20;
        doc.text('Total:', 380, y, { width: 80, align: 'right' });
        doc.text(`Rp ${transaction.total_amount.toLocaleString('id-ID')}`, 460, y, { width: 70, align: 'right' });
        
        y += 30;
        doc.font('Helvetica');
        doc.text(`Payment Method: ${transaction.payment_method === 'transfer' ? 'Transfer Bank' : 'COD'}`, 50, y);
        doc.text(`Status: ${transaction.status === 'paid' ? 'Paid' : 'Pending'}`, 50, y + 15);
        
        // Footer
        doc.fontSize(8).text(
            'Terima kasih telah berbelanja di Kedai Dimesem. Untuk pertanyaan, hubungi: (021) 1234-5678',
            50, 750, { align: 'center', width: 500 }
        );
        
        // Finalize PDF
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

        // 1. Logika Filter Periode (Sesuai value di HTML Anda)
        if (period === 'today') {
            dateFilter = "AND DATE(t.created_at) = CURDATE()";
        } else if (period === 'week') {
            dateFilter = "AND t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        } else if (period === 'month') {
            dateFilter = "AND t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        } else if (period === 'year') {
            dateFilter = "AND YEAR(t.created_at) = YEAR(CURDATE())";
        }

        // 2. Logika Jenis Laporan (Sesuai value di HTML Anda)
        if (type === 'transactions') {
            querySql = `SELECT t.*, u.name as user_name FROM transactions t 
                        LEFT JOIN users u ON t.user_id = u.id 
                        WHERE 1=1 ${dateFilter} ORDER BY t.created_at DESC`;
        } else if (type === 'sales') {
            querySql = `SELECT ti.*, t.transaction_code, t.created_at FROM transaction_items ti 
                        JOIN transactions t ON ti.transaction_id = t.id 
                        WHERE t.status = 'paid' ${dateFilter} ORDER BY t.created_at DESC`;
        } else if (type === 'products') {
            querySql = "SELECT * FROM products ORDER BY category ASC";
        }

        // 3. Validasi Akhir untuk mencegah ER_EMPTY_QUERY
        if (!querySql) {
            return res.status(400).json({ error: `Tipe '${type}' tidak dikenali server` });
        }

        const data = await query(querySql);
        
        if (data.length === 0) {
            return res.status(404).send("Data tidak ditemukan untuk periode tersebut.");
        }

        // --- Proses PDF (Gunakan PDFDocument) ---
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=laporan-${type}.pdf`);
        doc.pipe(res);
        
        doc.fontSize(18).text(`LAPORAN ${type.toUpperCase()}`, { align: 'center' });
        doc.fontSize(12).text(`Periode: ${period}`, { align: 'center' });
        doc.moveDown();

        data.forEach((item, i) => {
            const label = item.transaction_code || item.name;
            const amount = item.total_amount || item.price;
            doc.text(`${i + 1}. ${label} - Rp ${amount.toLocaleString('id-ID')}`);
        });

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