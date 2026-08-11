// HTML5 History API Router (Clean URLs without '#')
export class Router {
    constructor(routes) {
        this.routes = routes;
        this.currentRoute = null;
        window.addEventListener('popstate', () => this.resolve());
        
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
        const path = window.location.pathname || '/';
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
        const container = document.getElementById('main-content');
        container.innerHTML = '';
        matched.render(container, params);

        // Update sidebar active state
        document.querySelectorAll('.nav-item').forEach(item => {
            const routePath = item.dataset.route;
            const isActive = routePath === '/' ? path === '/' : path.startsWith(routePath);
            item.classList.toggle('active', isActive);
        });
    }

    navigate(path) {
        if (window.location.pathname !== path) {
            window.history.pushState(null, '', path);
            this.resolve();
        }
    }
}
