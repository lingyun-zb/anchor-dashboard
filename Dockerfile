# Use Node.js LTS
FROM node:22-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install --production

# Copy application code
COPY server.js ./
COPY index.html ./
COPY data/ ./data/

# Expose port (Fly.io sets PORT env var)
EXPOSE 3000

CMD ["node", "server.js"]
