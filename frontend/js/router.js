// Dual-Mode SPA Router (Supports both Path Routing and Hash Fallback)
export class Router {
    constructor(routes) {
        this.routes = routes;
        this.currentRoute = null;
        
        window.addEventListener('popstate', () => this.resolve());
        window.addEventListener('hashchange', () => this.resolve());
        
        // Intercept internal link clicks globally
        document.addEventListener('click', (e) => {
            const anchor = e.target.closest('a[data-link]');
            if (anchor) {
                e.preventDefault();
                this.navigate(anchor.getAttribute('href'));
            }
        });
    }

    resolve() {
        // Read hash first if present (e.g. /#/breakdown), else read pathname (e.g. /breakdown)
        let path = window.location.hash ? window.location.hash.slice(1) : window.location.pathname;
        if (!path) path = '/';

        let matched = null;
        let params = {};

        for (const route of this.routes) {
            const pattern = route.path.replace(/:([\w]+)/g, '([\\w-]+)');
            const regex = new RegExp(`^${pattern}$`);
            const match = path.match(regex);
            if (match) {
                matched = route;
                const paramNames = [...route.path.matchAll(/:([\w]+)/g)].map(m => m[1]);
                paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
                break;
            }
        }

        if (!matched) {
            matched = this.routes.find(r => r.path === '/') || this.routes[0];
        }

        this.currentRoute = matched;
        const container = document.getElementById('page-container');
        if (container) {
            container.innerHTML = '';
            matched.render(container, params);
        }

        // Update sidebar active state
        document.querySelectorAll('.nav-item').forEach(item => {
            const routePath = item.dataset.route;
            const isActive = routePath === '/' ? path === '/' : path.startsWith(routePath);
            item.classList.toggle('active', isActive);
        });
    }

    navigate(path) {
        // Set both hash and pushState for 100% server compatibility
        window.location.hash = path;
        this.resolve();
    }
}
