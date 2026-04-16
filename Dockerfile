FROM node:22.12-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG BUILD_DATE
RUN npx prisma generate
RUN npx nest build
RUN ls -la /app/dist/ && echo "dist OK"

EXPOSE 3000

CMD ["sh", "-c", "echo '=== dist contents ===' && ls /app/dist/ 2>&1 || echo 'dist MISSING' && npm run start:prod"]
