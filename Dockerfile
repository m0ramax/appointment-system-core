FROM node:22.12-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG BUILD_DATE
RUN npx prisma generate && npx nest build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
