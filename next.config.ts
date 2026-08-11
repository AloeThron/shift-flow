import type { NextConfig } from "next";

/** ค่าเริ่มต้น Next.js — runtime Node สำหรับ Prisma/Auth */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
