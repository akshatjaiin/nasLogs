import { auth } from '../auth.js';

export function renderLogin(container) {
    let isLogin = true;

    function renderForm() {
        container.innerHTML = `
            <div class="login-page" style="display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: var(--bg-primary);">
                <div class="login-card" style="background-color: var(--bg-secondary); border: 1px solid var(--border-muted); border-radius: var(--radius-lg); padding: 2rem; width: 100%; max-width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div class="text-center mb-4">
                        <h1 style="color: var(--text-heading); font-family: var(--font-sans); margin-bottom: 0.5rem;">GressTrace</h1>
                        <p style="color: var(--text-secondary); font-family: var(--font-sans);">Egress Traffic & Cost Authentication</p>
                    </div>
                    
                    <div style="display: flex; border-bottom: 1px solid var(--border-muted); margin-bottom: 1.5rem;">
                        <button class="tab-btn ${isLogin ? 'active' : ''}" style="flex: 1; padding: 0.75rem; background: none; border: none; color: ${isLogin ? 'var(--accent)' : 'var(--text-secondary)'}; border-bottom: 2px solid ${isLogin ? 'var(--accent)' : 'transparent'}; cursor: pointer; font-family: var(--font-sans); font-weight: 500;" id="tab-login">Login</button>
                        <button class="tab-btn ${!isLogin ? 'active' : ''}" style="flex: 1; padding: 0.75rem; background: none; border: none; color: ${!isLogin ? 'var(--accent)' : 'var(--text-secondary)'}; border-bottom: 2px solid ${!isLogin ? 'var(--accent)' : 'transparent'}; cursor: pointer; font-family: var(--font-sans); font-weight: 500;" id="tab-register">Register</button>
                    </div>

                    <form id="auth-form" style="display: flex; flex-direction: column; gap: 1rem;">
                        <div id="error-message" style="color: var(--critical-content); font-size: 0.875rem; display: none;"></div>
                        
                        ${!isLogin ? `
                        <div class="form-group" style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <label style="color: var(--text-primary); font-size: 0.875rem;" for="org_name">Organization Name</label>
                            <input type="text" id="org_name" required style="padding: 0.5rem; background-color: var(--bg-tertiary); border: 1px solid var(--border-primary); color: var(--text-primary); border-radius: var(--radius-md); font-family: var(--font-sans);">
                        </div>
                        ` : ''}
                        
                        <div class="form-group" style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <label style="color: var(--text-primary); font-size: 0.875rem;" for="email">Email</label>
                            <input type="email" id="email" required style="padding: 0.5rem; background-color: var(--bg-tertiary); border: 1px solid var(--border-primary); color: var(--text-primary); border-radius: var(--radius-md); font-family: var(--font-sans);">
                        </div>
                        
                        <div class="form-group" style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <label style="color: var(--text-primary); font-size: 0.875rem;" for="password">Password</label>
                            <input type="password" id="password" required style="padding: 0.5rem; background-color: var(--bg-tertiary); border: 1px solid var(--border-primary); color: var(--text-primary); border-radius: var(--radius-md); font-family: var(--font-sans);">
                        </div>

                        <button type="submit" class="btn btn-primary" style="margin-top: 1rem; width: 100%; padding: 0.75rem; background-color: var(--accent); color: white; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 500; font-family: var(--font-sans);">${isLogin ? 'Login' : 'Register'}</button>
                    </form>
                </div>
            </div>
        `;

        const form = container.querySelector('#auth-form');
        const tabLogin = container.querySelector('#tab-login');
        const tabRegister = container.querySelector('#tab-register');
        const errorMsg = container.querySelector('#error-message');

        tabLogin.addEventListener('click', () => {
            if (!isLogin) {
                isLogin = true;
                renderForm();
            }
        });

        tabRegister.addEventListener('click', () => {
            if (isLogin) {
                isLogin = false;
                renderForm();
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = form.querySelector('#email').value;
            const password = form.querySelector('#password').value;
            
            const payload = { email, password };
            let endpoint = '/api/auth/login/';

            if (!isLogin) {
                payload.org_name = form.querySelector('#org_name').value;
                endpoint = '/api/auth/register/';
            }

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.detail || data.error || 'Authentication failed');
                }

                auth.setTokens(data.access, data.refresh);
                window.dispatchEvent(new CustomEvent('nas:auth:login'));
            } catch (err) {
                errorMsg.textContent = err.message;
                errorMsg.style.display = 'block';
            }
        });
    }

    renderForm();
}
