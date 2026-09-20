# Multi-stage Dockerfile for ClauseWise single-service Cloud Run deployment
# Backend and frontend served from a single container on $PORT (default 8080).

# ==============================================================================
# Stage 1: Build Frontend (Vite + React + Tailwind CSS + shadcn/ui)
# ==============================================================================
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

# Install frontend dependencies cleanly
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source and build production bundle (outputs to frontend/dist)
COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Compile Backend TypeScript
# ==============================================================================
FROM node:20-slim AS backend-builder
WORKDIR /app/backend

# Install all backend dependencies (including devDependencies needed for tsc)
COPY backend/package*.json ./
RUN npm ci

# Copy backend source and compile TypeScript to JavaScript (outputs to backend/dist)
COPY backend/ ./
RUN npm run build

# ==============================================================================
# Stage 3: Production Runtime
# Slim base image with zero devDependencies and no source TypeScript files.
# ==============================================================================
FROM node:20-slim AS runner
WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=8080

# Install production dependencies only
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled backend JavaScript from backend-builder
COPY --from=backend-builder /app/backend/dist ./dist

# Copy runtime reference clauses data (ground-truth patterns for severity engine)
COPY reference-clauses /app/reference-clauses

# Copy built frontend assets into the location the Express server serves from
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Expose Cloud Run default port
EXPOSE 8080

# Run compiled Express server
CMD ["node", "dist/server.js"]
