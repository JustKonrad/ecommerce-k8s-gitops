# ---------- Stage 1: build the React app ----------
FROM node:18-alpine AS build
WORKDIR /app

# API base URL is baked at build time (CRA reads REACT_APP_* at build)
ARG REACT_APP_API_URL=http://ecommerce.local
ENV REACT_APP_API_URL=$REACT_APP_API_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- Stage 2: serve with a non-root nginx ----------
# nginx-unprivileged runs as UID 101 and listens on 8080 (no root needed)
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 8080
