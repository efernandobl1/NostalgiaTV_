(function(window) {
    // Vacío = mismo origen: el frontend llama a /api, /uploads y /hubs a través de
    // Nginx, sin depender de ninguna IP ni dominio. Funciona en cualquier host que
    // apunte a la VPS. Si necesitaras apuntar a otra API, poné aquí su URL absoluta.
    window.__env = {
        apiUrl: ''
    };
})(window);
