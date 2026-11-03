// Bug funcional 4.3 (antes corregido): este archivo creaba una SEGUNDA
// instancia independiente de PrismaClient (además de prisma/client.ts).
// Con Neon Postgres cada instancia abre su propio pool de conexiones, así
// que tener 2-3 instancias vivas al mismo tiempo multiplica el consumo de
// conexiones del plan sin ningún beneficio. Reexportamos el singleton
// compartido en vez de crear uno nuevo, para no tocar los imports
// existentes (`import { prisma } from '../config/db'` en health.controller.ts).
import prisma from '../prisma/client';

export { prisma };
