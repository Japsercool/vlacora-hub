FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY src ./src
COPY migrations ./migrations
RUN npm run check
ENV NODE_ENV=production
EXPOSE 8787
CMD ["npm", "start"]
