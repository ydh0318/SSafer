FROM node:22-alpine AS frontend-builder
WORKDIR /app

COPY Frontend/package.json Frontend/package-lock.json* ./
RUN npm ci --frozen-lockfile 2>/dev/null || npm install

COPY Frontend/ ./

ARG VITE_API_BASE_URL=https://k14b105.p.ssafy.io/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY Infra/docker/dockerfiles/nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
