// File: auth.js
// Tujuan: Menangani semua logika yang berkaitan dengan autentikasi,
//         termasuk login, logout, lupa password, dan manajemen sesi.
// Versi: FINAL - Dengan Validasi Sekolah per Situs

import { supabase } from './config.js';
import { showLoading, showStatusMessage, setupPasswordToggle } from './utils.js';
import { TARGET_SEKOLAH_ID } from './site.config.js'; // Impor ID sekolah target

/**
 * Memeriksa sesi pengguna saat ini dan mengarahkan mereka ke halaman yang sesuai.
 * Diekspor agar bisa digunakan oleh modul dashboard dan admin.
 */
export async function checkAuthenticationAndSetup() {
    const isPasswordRecovery = window.location.hash.includes('type=recovery');
    const { data: { session } } = await supabase.auth.getSession();
    const currentPath = window.location.pathname;

    if (!session && (currentPath.includes('dashboard.html') || currentPath.includes('superadmin.html'))) {
        window.location.replace('index.html');
        return;
    }

    if (session && (currentPath.includes('index.html') || currentPath.endsWith('/')) && !isPasswordRecovery) {
        const { data: userProfile } = await supabase
            .from('pengguna')
            .select('role')
            .eq('id', session.user.id)
            .single();

        const userRole = userProfile?.role?.trim().toLowerCase();

        if (userRole === 'super_admin') {
            window.location.replace('superadmin.html');
        } else {
            window.location.replace('dashboard.html');
        }
        return;
    }

    if (session) {
        const welcomeEl = document.getElementById('welcomeMessage');
        if (welcomeEl) {
             welcomeEl.textContent = `Selamat Datang, ${session.user.email}!`;
        }
    }
}

/**
 * Menyiapkan listener untuk event perubahan status autentikasi.
 * Diekspor agar bisa digunakan oleh modul dashboard dan admin.
 */
export function setupAuthListener() {
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            const loginBox = document.querySelector('.login-box');
            const resetContainer = document.getElementById('resetPasswordContainer');
            if (!loginBox || !resetContainer) return;
            
            loginBox.style.display = 'none';
            resetContainer.style.display = 'grid';
            
            const resetForm = document.getElementById('resetPasswordForm');
            resetForm.onsubmit = async (e) => {
                e.preventDefault();
                const newPassword = document.getElementById('newPassword').value;
                if (!newPassword || newPassword.length < 6) {
                    return showStatusMessage('Password baru minimal 6 karakter.', 'error');
                }

                showLoading(true);
                const { error } = await supabase.auth.updateUser({ password: newPassword });
                showLoading(false);

                if (error) {
                    return showStatusMessage(`Gagal memperbarui password: ${error.message}`, 'error');
                }
                
                showStatusMessage('Password berhasil diperbarui! Silakan login dengan password baru Anda.', 'success');

                setTimeout(() => {
                    window.location.hash = ''; 
                    window.location.reload();
                }, 3000);
            };
        }
    });
}

/**
 * Menangani proses login dengan validasi sekolah.
 */
async function handleLogin() {
    const usernameEl = document.getElementById('username');
    const passwordEl = document.getElementById('password');
    if (!usernameEl.value || !passwordEl.value) {
        return showStatusMessage("Email dan password harus diisi.", 'error');
    }
    showLoading(true);

    // Langkah 1: Coba otentikasi email dan password
    const { data: sessionData, error: loginError } = await supabase.auth.signInWithPassword({
        email: usernameEl.value,
        password: passwordEl.value,
    });

    if (loginError) {
        showLoading(false);
        return showStatusMessage(`Login Gagal: ${loginError.message}`, 'error');
    }

    // Langkah 2: Jika otentikasi berhasil, verifikasi profil dan sekolah pengguna
    if (sessionData.user) {
        const { data: userProfile, error: profileError } = await supabase
            .from('pengguna')
            .select('sekolah_id, role')
            .eq('id', sessionData.user.id)
            .single();

        if (profileError || !userProfile) {
            await supabase.auth.signOut(); // Langsung logout pengguna yang profilnya tidak ada
            showLoading(false);
            return showStatusMessage('Login Gagal: Profil pengguna tidak ditemukan.', 'error');
        }

        const isSuperAdmin = userProfile.role === 'super_admin';

        // Logika Kunci: Izinkan login HANYA JIKA pengguna adalah Super Admin ATAU
        // ID sekolah di profilnya cocok dengan ID sekolah yang dikonfigurasi untuk situs ini.
        if (isSuperAdmin || userProfile.sekolah_id === TARGET_SEKOLAH_ID) {
            // Login valid, lanjutkan ke pengalihan halaman yang benar
            showLoading(false); // Matikan loading sebelum redirect
            await checkAuthenticationAndSetup(); 
        } else {
            // Jika sekolah tidak cocok, gagalkan login dan logout paksa
            await supabase.auth.signOut(); 
            showLoading(false);
            return showStatusMessage('Login Gagal: Akun Anda tidak terdaftar untuk sekolah ini.', 'error');
        }
    } else {
         showLoading(false);
         return showStatusMessage('Login Gagal: Sesi tidak valid setelah login.', 'error');
    }
}

/**
 * Menangani proses logout.
 */
export async function handleLogout() {
    if (confirm('Apakah Anda yakin ingin logout?')) {
        showLoading(true);
        const { error } = await supabase.auth.signOut();
        showLoading(false);
        if (error) {
            alert('Gagal logout: ' + error.message);
        } else {
            window.location.replace('index.html');
        }
    }
}

/**
 * Menangani permintaan reset password.
 */
async function handleForgotPassword() {
    const emailEl = document.getElementById('username');
    const email = emailEl.value;

    if (!email) {
        return showStatusMessage('Silakan masukkan alamat email Anda terlebih dahulu, lalu klik "Lupa Password?".', 'error');
    }
    if (!confirm(`Anda akan mengirimkan link reset password ke alamat: ${email}. Lanjutkan?`)) {
        return;
    }

    showLoading(true);
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    showLoading(false);

    if (error) {
        return showStatusMessage(`Gagal mengirim email: ${error.message}`, 'error');
    }
    showStatusMessage('Email untuk reset password telah dikirim! Silakan periksa kotak masuk (dan folder spam) Anda.', 'success');
}

/**
 * Inisialisasi semua fungsi dan event listener yang diperlukan untuk Halaman Login.
 */
export async function initLoginPage() {
    // Pastikan TARGET_SEKOLAH_ID terisi. Jika tidak, ini adalah kesalahan konfigurasi.
    if (!TARGET_SEKOLAH_ID) {
        document.body.innerHTML = `<div style="padding: 20px; text-align: center; color: red;"><h1>Error Konfigurasi</h1><p>TARGET_SEKOLAH_ID tidak diatur di site.config.js. Aplikasi tidak dapat berjalan.</p></div>`;
        return;
    }
    
    setupPasswordToggle();
    
    if (window.location.hash.includes('type=recovery')) {
        const loginBox = document.querySelector('.login-box');
        const resetContainer = document.getElementById('resetPasswordContainer');
        if (loginBox && resetContainer) {
            loginBox.style.display = 'none';
            resetContainer.style.display = 'grid';
        }
    }
    
    setupAuthListener();
    await checkAuthenticationAndSetup();
    
    const loginForm = document.querySelector('.login-form-container form');
    if(loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            handleLogin();
        });
    }

    document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        handleForgotPassword();
    });
}
