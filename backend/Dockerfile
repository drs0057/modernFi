FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
# Use the lockfile when it is present so installs match what was tested.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]
