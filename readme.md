## OOP DI SCRIPT.JS
Abstraksi pada Pengelolaan State (Cart)
Fungsi updateCartCount adalah bentuk abstraksi UI:

JavaScript

function updateCartCount() {
    const cart = getCart(); // Mengambil data
    // Logika manipulasi DOM yang rumit
    if (cartCount) { ... }
}

Letak Abstraksinya: Saat ada produk ditambah ke keranjang, kita tinggal panggil updateCartCount(). Kita tidak perlu menulis ulang logika manipulasi DOM (seperti classList.remove('hidden')) di setiap tombol beli.


## OOP DI BAGIAN SERVER.JS
Konsep Encapsulation (Enkapsulasi) pada Database Pool

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    ...
});

Penjelasan: Objek pool adalah sebuah entitas yang membungkus (encapsulate) detail koneksi database. Anda tidak perlu mengatur socket atau TCP secara manual setiap kali ingin query. Anda cukup memanggil method pool.execute() atau pool.getConnection(). Semua kerumitan koneksi disembunyikan di dalam objek pool.