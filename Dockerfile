FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create directories for data and uploads
RUN mkdir -p /app/data /app/uploads

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
