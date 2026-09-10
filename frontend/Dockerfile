# ─────────────────────────────────────────────────────────────────
# LandWatch NER Frontend — Dockerfile
# Build React app, serve with Nginx
# ─────────────────────────────────────────────────────────────────

FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --silent

COPY . .

# Set backend URL for production build
ARG VITE_API_URL=https://your-backend.onrender.com
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ─── Nginx runtime ───────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Single-page app: all routes → index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
