// Hash-based SPA router
export class Router {
    constructor(routes) {
        this.routes = routes;
        this.currentRoute = null;
        window.addEventListener('hashchange', () => this.resolve());
    }

    resolve() {
        const hash = window.location.hash.slice(1) || '/';
        let matched = null;
        let params = {};

        for (const route of this.routes) {
            const pattern = route.path.replace(/:([\w]+)/g, '([\\w-]+)');
            const regex = new RegExp(`^${pattern}$`);
            const match = hash.match(regex);
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
            item.classList.toggle('active', item.dataset.route === matched.path || 
                (hash.startsWith(item.dataset.route) && item.dataset.route !== '/'));
        });
    }

    navigate(path) {
        window.location.hash = path;
    }
}
