import { spawn, execSync } from "node:child_process";

function runStep(title, command) {
  console.log(`\n🚀 [PrintGoo ERP] ${title}...`);
  execSync(command, { stdio: "inherit" });
}

async function main() {
  try {
    // 1. Docker konteynerlarni (PostgreSQL 17, Redis 7, MinIO S3, Python Doc-Service) ishga tushirish
    runStep(
      "1/4 Docker konteynerlar (PostgreSQL 17, Redis 7, MinIO S3, Python Doc-Service) yoqilmoqda",
      "docker compose -f docker-compose.dev.yml up -d --build --wait"
    );

    // 2. Ma'lumotlar bazasi sxemasini (Drizzle ORM) sinxronlash
    runStep(
      "2/4 PostgreSQL ma'lumotlar bazasi jadvallari yangilanmoqda (db:push)",
      "npm run db:push"
    );

    // 3. Boshlang'ich ma'lumotlarni (Seed) tekshirish va yuklash
    runStep(
      "3/4 Boshlang'ich ma'lumotlar (Seed) yuklanmoqda",
      "npm run db:seed"
    );

    // 4. Next.js (Frontend + Backend API) va BullMQ Background Worker'ni parallel ishga tushirish
    console.log(
      "\n✅ [PrintGoo ERP] 4/4 Next.js (Frontend + Backend) va Background Worker ishga tushirilmoqda...\n"
    );

    const isWin = process.platform === "win32";
    const nextProc = spawn(isWin ? "npm.cmd" : "npm", ["run", "dev"], {
      stdio: "inherit",
      shell: true,
    });

    const workerProc = spawn(isWin ? "npm.cmd" : "npm", ["run", "worker:dev"], {
      stdio: "inherit",
      shell: true,
    });

    const shutdown = () => {
      nextProc.kill();
      workerProc.kill();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error(
      "\n❌ [PrintGoo ERP] Ishga tushirishda xatolik yuz berdi. Docker Desktop ishlayotganini tekshiring."
    );
    process.exit(1);
  }
}

main();
