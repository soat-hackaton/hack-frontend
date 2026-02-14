FROM nginx:alpine

# Remove padrão
RUN rm -rf /usr/share/nginx/html/*

# Copia código fonte
COPY src/ /usr/share/nginx/html

# Permissões (opcional, mas boa prática)
RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]