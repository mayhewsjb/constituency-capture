import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";

const dbUrl =
  process.env.DATABASE_URL ||
  `file:${path.join(process.cwd(), "dev.db")}`;

const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = "admin@constituency-capture.gov.uk";
const ADMIN_PASSWORD = "AdminPass123!";

const SAMPLE_CONSTITUENCIES = [
  { name: "Cities of London and Westminster", mpName: "Nickie Aiken" },
  { name: "Islington North", mpName: "Jeremy Corbyn" },
  { name: "Sheffield Central", mpName: "Paul Blomfield" },
  { name: "Bristol West", mpName: "Thangam Debbonaire" },
  { name: "Brighton Pavilion", mpName: "Caroline Lucas" },
  { name: "Manchester Central", mpName: "Lucy Powell" },
  { name: "Leeds Central", mpName: "Alex Sobel" },
  { name: "Birmingham Ladywood", mpName: "Shabana Mahmood" },
  { name: "Edinburgh South West", mpName: "Joanna Cherry" },
  { name: "Cardiff Central", mpName: "Jo Stevens" },
];

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const existingAdmin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash,
        role: "admin",
        status: "active",
      },
    });
    console.log(`Admin user created: ${ADMIN_EMAIL}`);
  } else {
    console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
  }

  // Seed sample constituencies
  for (const c of SAMPLE_CONSTITUENCIES) {
    const existing = await prisma.constituency.findUnique({
      where: { name: c.name },
    });
    if (!existing) {
      await prisma.constituency.create({ data: c });
      console.log(`Created constituency: ${c.name}`);
    }
  }

  // Create admin settings record if not exists
  const existingSettings = await prisma.adminSettings.findFirst();
  if (!existingSettings) {
    await prisma.adminSettings.create({
      data: { defaultDigestTime: "08:00" },
    });
    console.log("Created default admin settings (digest time: 08:00)");
  }

  console.log("\nSeed complete!");
  console.log(`\nAdmin credentials:`);
  console.log(`  Email: ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
