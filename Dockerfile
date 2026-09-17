FROM mcr.microsoft.com/playwright:v1.50.1-noble

WORKDIR /app

# Install project dependencies
COPY package*.json ./
RUN npm ci

# Copy application source code
COPY tsconfig.json ./
COPY src ./src
COPY public ./public

# Build TypeScript to JavaScript
RUN npm run build

# Create storage directories
RUN mkdir -p storage/jobs

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["node", "dist/index.js"]
