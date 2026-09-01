const socket = io();

socket.on('db_changed', () => {
    // Prevent UI refresh if the user is actively typing in a form to avoid data loss
    const activeElement = document.activeElement;
    if (activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName)) {
        return; 
    }

    // Fetch the latest HTML for the current page
    fetch(window.location.href, { headers: { 'X-Requested-With': 'XMLHttpRequest' }, cache: 'no-store' })
        .then(r => r.text())
        .then(html => {
            const parser = new DOMParser();
            const newDoc = parser.parseFromString(html, 'text/html');

            // Find the main data container (either .tab-content or .container)
            const currentMain = document.querySelector('.tab-content') || document.querySelector('.container') || document.querySelector('main');
            const newMain = newDoc.querySelector('.tab-content') || newDoc.querySelector('.container') || newDoc.querySelector('main');

            if (currentMain && newMain) {
                // If there are tabs, preserve the active tab state
                const activeTab = document.querySelector('.tab-pane.active');
                const activeTabId = activeTab ? activeTab.id : null;

                currentMain.innerHTML = newMain.innerHTML;

                // Restore active tab
                if (activeTabId) {
                    const tabs = document.querySelectorAll('.tab-pane');
                    tabs.forEach(t => t.classList.remove('show', 'active'));
                    const targetTab = document.getElementById(activeTabId);
                    if(targetTab) targetTab.classList.add('show', 'active');
                }
            }
        });
});

// Intercept all forms to submit via AJAX (prevents full page reloads)
document.addEventListener('submit', function(e) {
    if(e.target.tagName === 'FORM') {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = {};
        
        // Handle both standard form submission and active submit button value
        formData.forEach((value, key) => { data[key] = value; });
        if(e.submitter && e.submitter.name) {
            data[e.submitter.name] = e.submitter.value;
        }

        fetch(form.action, {
            method: form.method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(response => {
            if(response.ok || response.redirected) {
                // The db_changed event will automatically trigger the UI refresh
                // But just in case, we clear inputs
                form.reset();
            }
        }).catch(err => console.error("Form submit error:", err));
    }
});
