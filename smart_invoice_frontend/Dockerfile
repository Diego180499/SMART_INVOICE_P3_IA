# Frontend estático de SmartInvoice servido con Nginx.
FROM nginx:1.27-alpine

# Configuración del servidor
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Archivos del sitio
COPY index.html env.js /usr/share/nginx/html/
COPY css/  /usr/share/nginx/html/css/
COPY js/   /usr/share/nginx/html/js/

# Entrypoint que inyecta API_URL en env.js al arrancar
COPY docker-entrypoint.sh /docker-entrypoint.d/40-smartinvoice-env.sh
RUN chmod +x /docker-entrypoint.d/40-smartinvoice-env.sh

EXPOSE 80
# La imagen base de nginx ya define CMD ["nginx", "-g", "daemon off;"]
