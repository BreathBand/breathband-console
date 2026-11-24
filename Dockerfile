# Cloud Run (or any container host) alternative to Firebase Hosting.
# Builds the static export and serves it with nginx on $PORT (8080).
#
#   docker build --build-arg NEXT_PUBLIC_BACKEND=local -t breathband-console .
#   docker run -p 8080:8080 breathband-console

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* values are inlined at build time, so they are build args.
ARG NEXT_PUBLIC_BACKEND=local
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_APP_ID
RUN npm run build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html
EXPOSE 8080
