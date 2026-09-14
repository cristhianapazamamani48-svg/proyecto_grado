const { PrismaClient } = require('@prisma/client');

const passwords = ['postgres', 'postgrespassword', 'admin', 'root', '123456', 'password', '1234', 'master', 'uub'];

async function testPass() {
  for (const pass of passwords) {
    const url = `postgresql://postgres:${pass}@127.0.0.1:5432/uub_evaluaciones?schema=public`;
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      await prisma.$connect();
      console.log(`SUCCESS! Password is: '${pass}'`);
      await prisma.$disconnect();
      return pass;
    } catch (err) {
      console.log(`Failed for '${pass}': ${err.message}`);
      await prisma.$disconnect();
    }
  }
}

testPass();
