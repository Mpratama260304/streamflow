# ===========================================
# StreamFlow v2.1 - Optimized for Railway.com
# Multi-stage build for smaller image size
# ===========================================

# Stage 1: Build dependencies
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Production image
FROM node:20-slim AS production

# Set environment variables
ENV NODE_ENV=production \
    PORT=7575 \
    TZ=UTC

# Install ffmpeg and clean up in a single layer
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN groupadd -r streamflow && \
    useradd -r -g streamflow -d /app -s /sbin/nologin streamflow

WORKDIR /app

# Copy dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source code
COPY --chown=streamflow:streamflow . .

# Create required directories with proper permissions
RUN mkdir -p db logs temp public/uploads/videos public/uploads/thumbnails public/uploads/avatars && \
    chown -R streamflow:streamflow /app

# Switch to non-root user
USER streamflow

# Expose the application port
EXPOSE 7575

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:7575/api/server-time', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "app.js"] 