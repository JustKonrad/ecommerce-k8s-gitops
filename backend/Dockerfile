# ---------- Stage 1: dependencies ----------
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Install only production dependencies for the runtime image
RUN npm ci --omit=dev

# ---------- Stage 2: runtime ----------
FROM node:18-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Copy prod deps and source
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

# Run as an unprivileged user (node user ships with the image)
USER node

EXPOSE 3001

# Container-level healthcheck hitting the /health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3001/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/index.js"]
