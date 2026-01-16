-- Database: kedai_dimesem
CREATE DATABASE IF NOT EXISTS kedai_dimesem;
USE kedai_dimesem;

-- Table: users
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: products
CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image VARCHAR(255),
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: transactions (VERSI PERBAIKAN)
CREATE TABLE transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    transaction_code VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(100) NOT NULL, -- Kolom baru
    customer_phone VARCHAR(20) NOT NULL, -- Kolom baru
    customer_address TEXT NOT NULL,
    customer_note TEXT,                   -- Kolom baru
    payment_method ENUM('transfer', 'cod') NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    STATUS ENUM('pending', 'paid', 'cancelled', 'completed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Table: transaction_items
CREATE TABLE transaction_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    transaction_id INT,
    product_id INT,
    product_name VARCHAR(100) NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Insert sample admin user (password: admin123)
INSERT INTO users (name, email, password, role) VALUES 
('Admin Kedai', 'admin@kedai.com', '$2b$10$YourHashedPasswordHere', 'admin');

-- Insert sample products
INSERT INTO products (name, description, price, image, category) VALUES
('Dimsum Ayam', 'Dimsum dengan isian ayam pilihan', 25000, 'dimsum_ayam.jpg', 'dimsum'),
('Dimsum Udang', 'Dimsum dengan isian udang segar', 30000, 'dimsum_udang.jpg', 'dimsum'),
('Dimsum Keju', 'Dimsum dengan isian keju leleh', 28000, 'dimsum_keju.jpg', 'dimsum'),
('Dimsum Sayur', 'Dimsum sehat dengan isian sayuran', 22000, 'dimsum_sayur.jpg', 'dimsum'),
('Dimsum Sapi', 'Dimsum dengan isian daging sapi', 32000, 'dimsum_sapi.jpg', 'dimsum'),
('Dimsum Tahu', 'Dimsum dengan kulit tahu gurih', 18000, 'dimsum_tahu.jpg', 'dimsum'),
('Dimsum Jamur', 'Dimsum dengan isian jamur tiram', 26000, 'dimsum_jamur.jpg', 'dimsum'),
('Dimsum Pedas', 'Dimsum dengan bumbu pedas spesial', 27000, 'dimsum_pedas.jpg', 'dimsum');

-- Insert sample transaction
INSERT INTO transactions (user_id, transaction_code, customer_name, customer_address, payment_method, total_amount, status) VALUES
(1, 'TRX-2025-001', 'Budi Santoso', 'Jl. Merdeka No. 123, Jakarta', 'transfer', 75000, 'paid');

-- Insert sample transaction items
INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, price, subtotal) VALUES
(1, 1, 'Dimsum Ayam', 2, 25000, 50000),
(1, 2, 'Dimsum Udang', 1, 30000, 30000);