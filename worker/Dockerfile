FROM mcr.microsoft.com/playwright:v1.48.0-noble
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 7860
ENV PORT=7860
CMD ["node", "dist/server.js"]
