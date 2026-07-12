/**
 * BranchRepo — acceso a la tabla de sucursales.
 */
import { getDb, type BranchSnapshot } from '../schema';

const db = () => getDb();

export const branchRepo = {
  async listByTenant(tenantId: string): Promise<BranchSnapshot[]> {
    return db()
      .branches.where('tenantId')
      .equals(tenantId)
      .filter((r) => r.active)
      .sortBy('isMain');
  },

  async findById(id: string, tenantId: string): Promise<BranchSnapshot | null> {
    return (
      (await db().branches.get(id)) ?? null
    );
  },

  async findMain(tenantId: string): Promise<BranchSnapshot | null> {
    const all = await db()
      .branches.where('tenantId')
      .equals(tenantId)
      .filter((r) => r.isMain && r.active)
      .toArray();
    return all[0] ?? null;
  },

  async put(branch: BranchSnapshot): Promise<void> {
    await db().branches.put(branch);
  },

  async bulkPut(branches: BranchSnapshot[]): Promise<void> {
    if (branches.length === 0) return;
    await db().branches.bulkPut(branches);
  },

  async delete(id: string): Promise<void> {
    await db().branches.delete(id);
  },

  async clearTenant(tenantId: string): Promise<void> {
    await db().branches.where('tenantId').equals(tenantId).delete();
  },
};
