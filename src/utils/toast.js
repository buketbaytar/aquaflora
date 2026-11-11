/** Erişilebilir bildirim (ekran okuyucular için aria-live) */
let container;

export function toast(message, type = 'info', ms = 3500) {
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-stack';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('role', 'status');
        document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast-notification toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('toast-out');
        setTimeout(() => el.remove(), 300);
    }, ms);
}
