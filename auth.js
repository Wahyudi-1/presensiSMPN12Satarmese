// File: auth.js

// GANTI FUNGSI LAMA DENGAN INI
async function handleLogin() {
    const usernameEl = document.getElementById('username');
    const passwordEl = document.getElementById('password');
    if (!usernameEl.value || !passwordEl.value) {
        return showStatusMessage("Email dan password harus diisi.", 'error');
    }
    showLoading(true);

    // Langkah 1: Coba login seperti biasa
    const { data: sessionData, error: loginError } = await supabase.auth.signInWithPassword({
        email: usernameEl.value,
        password: passwordEl.value,
    });

    if (loginError) {
        showLoading(false);
        return showStatusMessage(`Login Gagal: ${loginError.message}`, 'error');
    }

    // Jika login berhasil, lakukan Langkah 2: Validasi Sekolah
    if (sessionData.user) {
        const { data: userProfile, error: profileError } = await supabase
            .from('pengguna')
            .select('sekolah_id, role')
            .eq('id', sessionData.user.id)
            .single();

        if (profileError || !userProfile) {
            await supabase.auth.signOut(); // Langsung logout pengguna
            showLoading(false);
            return showStatusMessage('Login Gagal: Profil pengguna tidak ditemukan.', 'error');
        }

        // =================================================================
        // INI ADALAH LOGIKA KUNCI PENCEGAHAN AKSES LINTAS-SITUS
        // =================================================================
        const isSuperAdmin = userProfile.role === 'super_admin';

        // Izinkan login JIKA pengguna adalah Super Admin ATAU sekolah_id mereka cocok
        if (isSuperAdmin || userProfile.sekolah_id === TARGET_SEKOLAH_ID) {
            // Login valid, lanjutkan ke pengalihan
            await checkAuthenticationAndSetup(); 
        } else {
            // Jika sekolah_id tidak cocok, gagalkan login dan logout paksa
            await supabase.auth.signOut(); 
            showLoading(false);
            return showStatusMessage('Login Gagal: Akun Anda tidak terdaftar untuk sekolah ini.', 'error');
        }
        // =================================================================

    } else {
         showLoading(false);
         return showStatusMessage('Login Gagal: Sesi tidak valid.', 'error');
    }
}
