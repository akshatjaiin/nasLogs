// Clean HTML5 History Router (No '#' in URLs)
export class Router {
    constructor(routes) {
        this.routes = routes;
        this.currentRoute = null;
        this._renderGen = 0;  // Generation counter to prevent async race conditions
        
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
        // Always read clean path, fallback to '/' if hash was present
        let path = window.location.pathname || '/';
        if (window.location.hash && window.location.hash.startsWith('#/')) {
            path = window.location.hash.slice(1);
            window.history.replaceState(null, '', path);
        }

        let matched = null;
        let params = {};

        for (const route of this.routes) {
            const pattern = route.path.replace(/:(\w+)/g, '([\\w-]+)');
            const regex = new RegExp(`^${pattern}$`);
            const match = path.match(regex);
            if (match) {
                matched = route;
                const paramNames = [...route.path.matchAll(/:(\w+)/g)].map(m => m[1]);
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
            // Increment generation — any in-flight render from a previous route will bail out
            const gen = ++this._renderGen;
            container.innerHTML = '';
            
            // Wrap render to guard against stale async completions
            const originalRender = matched.render;
            const guardedContainer = new Proxy(container, {
                set: (target, prop, value) => {
                    if (prop === 'innerHTML' && this._renderGen !== gen) return true; // stale render, discard
                    target[prop] = value;
                    return true;
                }
            });
            originalRender(container, params);
        }

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
        }
        this.resolve();
    }
}
