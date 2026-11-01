FROM node:20-alpine
WORKDIR /app
COPY . .
RUN node scripts/fetch-fonts.mjs || true
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
