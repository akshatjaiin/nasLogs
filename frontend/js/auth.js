export const auth = {
    getToken() { return localStorage.getItem('nas_access_token'); },
    getRefresh() { return localStorage.getItem('nas_refresh_token'); },
    setTokens(access, refresh) {
        localStorage.setItem('nas_access_token', access);
        localStorage.setItem('nas_refresh_token', refresh);
    },
    clear() {
        localStorage.removeItem('nas_access_token');
        localStorage.removeItem('nas_refresh_token');
    },
    isLoggedIn() { return !!this.getToken(); },
    
    // Try to refresh the access token using the refresh token
    async tryRefresh() {
        const refresh = this.getRefresh();
        if (!refresh) return false;
        try {
            const resp = await fetch('/api/auth/refresh/', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({refresh})
            });
            if (!resp.ok) return false;
            const data = await resp.json();
            this.setTokens(data.access, data.refresh || refresh);
            return true;
        } catch { return false; }
    }
};
