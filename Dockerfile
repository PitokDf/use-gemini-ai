# ====================================================================================
# STAGE 1: Builder - Tahap untuk membangun aplikasi
# ====================================================================================
# Gunakan image Node.js versi LTS (Long-Term Support) berbasis Alpine untuk ukuran kecil
FROM node:18-alpine AS builder

# Set direktori kerja di dalam container
WORKDIR /app

# Salin package.json dan lock file terlebih dahulu untuk memanfaatkan cache Docker
# Gunakan wildcard (*) agar berfungsi untuk npm, yarn, atau pnpm
COPY package*.json ./
# COPY yarn.lock ./      # Jika menggunakan yarn

# Install dependencies. Pilih salah satu sesuai package manager Anda.
# Untuk PNPM:
RUN npm install -g pnpm && pnpm install
# Untuk NPM:
# RUN npm install
# Untuk YARN:
# RUN yarn install

# Salin sisa kode sumber aplikasi
COPY . .

# Bangun aplikasi Next.js untuk produksi
RUN npm run build

# ====================================================================================
# STAGE 2: Runner - Tahap untuk menjalankan aplikasi
# ====================================================================================
# Gunakan image Node.js yang sama persis dengan tahap builder
FROM node:18-alpine AS runner

WORKDIR /app

# Buat user dan group non-root untuk keamanan (best practice)
RUN addgroup -S nextjs
RUN adduser -S nextjs -G nextjs

# Salin hasil build dari tahap 'builder'
# Karena kita menggunakan output: 'standalone', kita hanya perlu menyalin folder-folder ini
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

# Ganti user ke non-root yang sudah dibuat
USER nextjs

# Expose port yang digunakan oleh Next.js
EXPOSE 3000

# Set environment variable untuk mode produksi
ENV NODE_ENV=production
ENV PORT=3000

# Perintah untuk menjalankan aplikasi
# Next.js dengan output standalone akan membuat file server.js
CMD ["node", "server.js"]