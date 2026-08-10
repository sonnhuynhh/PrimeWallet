/**
 * In URL API gợi ý theo nền tảng dev — chạy: npm run dev:api-url
 */
import os from "node:os";

function lanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "192.168.x.x";
}

const ip = lanIp();
const port = process.env.BACKEND_PORT ?? 8080;

console.log("\n📱 Cấu hình API cho Prime Wallet Mobile\n");
console.log("Android Emulator:");
console.log(`  EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:${port}\n`);
console.log("iOS Simulator:");
console.log(`  EXPO_PUBLIC_API_BASE_URL=http://localhost:${port}\n`);
console.log("Điện thoại thật (cùng WiFi):");
console.log(`  EXPO_PUBLIC_API_BASE_URL=http://${ip}:${port}\n`);
console.log("Điện thoại khác mạng / 4G (tunnel):");
console.log("  npm run tunnel:backend   → tự ghi .env\n");
console.log("Expo tunnel (bundle JS qua internet):");
console.log("  npm run start:tunnel\n");
