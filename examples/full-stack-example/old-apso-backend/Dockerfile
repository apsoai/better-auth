# Base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Install Apso CLI globally
RUN npm install -g apso-cli

# Copy application files
COPY . .

# Generate Apso backend code
RUN apso generate

# Build the application
RUN npm run build

# Expose port
EXPOSE 3001

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
CMD ["npm", "run", "start:dev"]