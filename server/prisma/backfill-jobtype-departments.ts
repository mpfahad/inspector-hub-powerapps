/**
 * Assign JobType.departmentId from linked jobs or name heuristics (CM-018).
 * Run after schema push adds the column. Safe to re-run.
 *
 * Usage: npx tsx prisma/backfill-jobtype-departments.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function guessDeptCode(name: string, code: string): string {
  const hay = `${name} ${code}`.toLowerCase();
  if (hay.includes('lift') || hay.includes('rope') || hay.includes('gear')) return 'LIFT';
  if (hay.includes('rig') || hay.includes('compex') || hay.includes('ex ')) return 'RIGS';
  if (hay.includes('ndt') || hay.includes('ultrasonic') || hay.includes('paut') || hay.includes('ut')) return 'NDT';
  if (hay.includes('elec') || hay.includes('compex')) return 'ELEC';
  if (hay.includes('weld')) return 'MECH';
  if (hay.includes('vessel') || hay.includes('mech') || hay.includes('pvi')) return 'MECH';
  return 'HOLD';
}

async function main() {
  const depts = await prisma.department.findMany();
  const byCode = new Map(depts.map((d) => [d.code, d]));
  const byId = new Map(depts.map((d) => [d.id, d]));
  const fallback =
    byCode.get('HOLD') ?? byCode.get('LIFT') ?? depts[0];
  if (!fallback) throw new Error('No departments found — seed first');

  const types = await prisma.jobType.findMany({
    include: {
      jobs: { select: { departmentId: true }, take: 50 },
    },
  });

  let updated = 0;
  for (const type of types) {
    let departmentId = type.departmentId;
    if (!departmentId) {
      const counts = new Map<number, number>();
      for (const j of type.jobs) {
        counts.set(j.departmentId, (counts.get(j.departmentId) ?? 0) + 1);
      }
      let best: number | null = null;
      let bestN = 0;
      for (const [id, n] of counts) {
        if (n > bestN) {
          best = id;
          bestN = n;
        }
      }
      if (best != null) {
        departmentId = best;
      } else {
        const code = guessDeptCode(type.name, type.code);
        departmentId = byCode.get(code)?.id ?? fallback.id;
      }
      await prisma.jobType.update({
        where: { id: type.id },
        data: { departmentId },
      });
      updated += 1;
      const dept = byId.get(departmentId);
      console.log(`  ${type.code} → ${dept?.name ?? departmentId}`);
    }
  }

  console.log(`Backfilled ${updated} job type(s); ${types.length} total`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
