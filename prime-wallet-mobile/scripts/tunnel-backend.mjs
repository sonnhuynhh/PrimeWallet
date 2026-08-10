/**
 * Mở tunnel ngrok tới backend local (port 8080) qua ngrok CLI.
 * Ghi URL vào .env — chạy: npm run tunnel:backend
 *
 * Yêu cầu: ngrok CLI + `ngrok config add-authtoken <token>`
 */
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const PORT = Number(process.env.BACKEND_PORT ?? 8080);

function writeApiUrl(url) {
  const envLine = `EXPO_PUBLIC_API_BASE_URL=${url}`;
  let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";

  if (/^EXPO_PUBLIC_API_BASE_URL=/m.test(envContent)) {
    envContent = envContent.replace(/^EXPO_PUBLIC_API_BASE_URL=.*$/m, envLine);
  } else {
    envContent = `${envContent.trimEnd()}\n${envLine}\n`;
  }

  fs.writeFileSync(ENV_PATH, envContent.endsWith("\n") ? envContent : `${envContent}\n`);
}

function fetchNgrokApi() {
  return new Promise((resolve, reject) => {
    const req = http.get("http://127.0.0.1:4040/api/tunnels", (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          const tunnel = data.tunnels?.find((t) => t.public_url?.startsWith("https://"));
          if (tunnel?.public_url) resolve(tunnel.public_url);
          else reject(new Error("Chưa có tunnel HTTPS"));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

function parseUrlFromLog(line) {
  const match = line.match(/url=(https:\/\/[^\s]+)/);
  return match?.[1] ?? null;
}

async function waitForTunnel(child, maxMs = 45000) {
  let fromLog = null;

  const onData = (chunk) => {
    const text = chunk.toString();
    process.stderr.write(text);
    for (const line of text.split(/\r?\n/)) {
      const url = parseUrlFromLog(line);
      if (url) fromLog = url;
    }
  };

  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);

  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (fromLog) return fromLog;
    try {
      return await fetchNgrokApi();
    } catch {
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  throw new Error("Không lấy được URL tunnel (kiểm tra ngrok config add-authtoken)");
}

async function main() {
  console.log(`\n🔌 Đang mở tunnel ngrok CLI → localhost:${PORT} ...\n`);

  const child = spawn("ngrok", ["http", String(PORT), "--log=stdout"], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  child.on("error", (err) => {
    console.error("❌ Không chạy được lệnh ngrok:", err.message);
    console.error("   Cài ngrok: https://ngrok.com/download\n");
    process.exit(1);
  });

  const url = await waitForTunnel(child);
  writeApiUrl(url);

  console.log("\n✅ Tunnel backend sẵn sàng:\n");
  console.log(`   ${url}`);
  console.log("\n📝 Đã ghi vào .env — chạy lại Expo (npm run start:tunnel hoặc npm start)\n");
  console.log("⚠️  Giữ terminal này mở. Ctrl+C để đóng tunnel.\n");

  process.on("SIGINT", () => {
    child.kill("SIGTERM");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("❌ Không mở được tunnel:", err.message);
  console.error("\nGợi ý:");
  console.error("  1. Backend đang chạy trên port", PORT);
  console.error("  2. Chạy: ngrok config add-authtoken <token>");
  console.error("  3. Nếu lỗi config cũ: ngrok config upgrade\n");
  process.exit(1);
});
