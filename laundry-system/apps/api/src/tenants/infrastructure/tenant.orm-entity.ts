import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'tenants' })
export class TenantOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  slug!: string;

  @Column({
    type: 'enum',
    enum: ['trial', 'starter', 'pro', 'enterprise'],
    default: 'trial',
  })
  plan!: 'trial' | 'starter' | 'pro' | 'enterprise';

  // ── Onboarding: datos fiscales (paso 1) ───────────────────────────────
  @Column({ type: 'varchar', length: 120, nullable: true })
  fiscalName!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  fiscalAddress!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  fiscalTaxId!: string | null;

  // ── Onboarding: sucursal (paso 2) ──────────────────────────────────────
  @Column({ type: 'varchar', length: 120, nullable: true })
  branchName!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  branchAddress!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  branchPhone!: string | null;

  // ── Onboarding: WhatsApp (paso 3) ──────────────────────────────────────
  @Column({ type: 'varchar', length: 30, nullable: true })
  whatsappPhone!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  whatsappVerifiedAt!: Date | null;

  // ── Progreso del onboarding ────────────────────────────────────────────
  @Column({ type: 'smallint', default: 0 })
  onboardingStep!: number;

  @Column({ type: 'timestamptz', nullable: true })
  onboardingCompletedAt!: Date | null;

  // ── Logo ───────────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}