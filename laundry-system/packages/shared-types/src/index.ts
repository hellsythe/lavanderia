import { z } from 'zod';

/* =========================================================================
 * Common primitives
 * ========================================================================= */

export const UuidSchema = z.string().uuid();
export const TenantIdSchema = UuidSchema;
export const UserIdSchema = UuidSchema;

export const TimestampSchema = z.number().int().nonnegative();

/* =========================================================================
 * Tenant (Lavandería SaaS cliente)
 * ========================================================================= */

export const TenantPlanSchema = z.enum(['trial', 'starter', 'pro', 'enterprise']);
export type TenantPlan = z.infer<typeof TenantPlanSchema>;

export const TenantSchema = z.object({
  id: TenantIdSchema,
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/),
  plan: TenantPlanSchema,
  // Datos fiscales — paso 1 del onboarding
  fiscalName: z.string().min(2).max(120).optional(),
  fiscalAddress: z.string().min(5).max(200).optional(),
  fiscalTaxId: z.string().min(8).max(20).optional(),
  // Datos de sucursal — paso 2 del onboarding
  branchName: z.string().min(2).max(120).optional(),
  branchAddress: z.string().min(5).max(200).optional(),
  branchPhone: z.string().min(8).max(30).optional(),
  // WhatsApp — paso 3 del onboarding
  whatsappPhone: z.string().min(10).max(15).optional(),
  whatsappVerifiedAt: TimestampSchema.optional(),
  // Progreso del onboarding
  onboardingStep: z.number().int().min(0).max(3).default(0),
  onboardingCompletedAt: TimestampSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Tenant = z.infer<typeof TenantSchema>;

/* =========================================================================
 * User
 * ========================================================================= */

export const UserRoleSchema = z.enum([
  'super_admin', // SaaS owner
  'tenant_admin', // dueño lavandería
  'operator', // cajero
  'delivery', // domiciliario (futuro)
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: UserIdSchema,
  tenantId: TenantIdSchema,
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: UserRoleSchema,
  active: z.boolean().default(true),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type User = z.infer<typeof UserSchema>;

/* =========================================================================
 * Customer (cliente final de la lavandería)
 * ========================================================================= */

export const CustomerSchema = z.object({
  id: UuidSchema,
  tenantId: TenantIdSchema,
  name: z.string().min(1).max(120),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  address: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  deletedAt: TimestampSchema.nullable().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Customer = z.infer<typeof CustomerSchema>;

/**
 * Input para crear un customer. El server genera id, tenantId, createdAt,
 * updatedAt, deletedAt. Si el name ya existe activo en el tenant → 409.
 */
export const CreateCustomerInputSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});
export type CreateCustomerInput = z.infer<typeof CreateCustomerInputSchema>;

export const UpdateCustomerInputSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  address: z.string().max(200).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInputSchema>;

/* =========================================================================
 * Service (catálogo de servicios: lavar, planchar, etc.)
 * ========================================================================= */

export const ServiceUnitSchema = z.enum(['kg', 'piece']);
export type ServiceUnit = z.infer<typeof ServiceUnitSchema>;

export const ServiceSchema = z.object({
  id: UuidSchema,
  tenantId: TenantIdSchema,
  categoryId: UuidSchema.nullable().optional(),
  name: z.string().min(1).max(80),
  description: z.string().max(300).nullable().optional(),
  unit: ServiceUnitSchema,
  unitPrice: z.number().nonnegative(),
  /** Cantidad mínima al cargar este servicio en un pedido. Default 1. */
  minQuantity: z.number().int().min(1).default(1),
  active: z.boolean().default(true),
  deletedAt: TimestampSchema.nullable().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Service = z.infer<typeof ServiceSchema>;

export const ServiceCategorySchema = z.object({
  id: UuidSchema,
  tenantId: TenantIdSchema,
  name: z.string().min(1).max(60),
  deletedAt: TimestampSchema.nullable().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type ServiceCategory = z.infer<typeof ServiceCategorySchema>;

export const CreateServiceInputSchema = z.object({
  categoryId: UuidSchema.nullable().optional(),
  name: z.string().min(1).max(80),
  description: z.string().max(300).nullable().optional(),
  unit: ServiceUnitSchema,
  unitPrice: z.number().nonnegative(),
  /** Default 1. Validación: integer >= 1. */
  minQuantity: z.number().int().min(1).default(1),
  active: z.boolean().default(true),
});
export type CreateServiceInput = z.infer<typeof CreateServiceInputSchema>;

export const UpdateServiceInputSchema = z.object({
  categoryId: UuidSchema.nullable().optional(),
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(300).nullable().optional(),
  unit: ServiceUnitSchema.optional(),
  unitPrice: z.number().nonnegative().optional(),
  minQuantity: z.number().int().min(1).optional(),
  active: z.boolean().optional(),
});
export type UpdateServiceInput = z.infer<typeof UpdateServiceInputSchema>;

export const CreateServiceCategoryInputSchema = z.object({
  name: z.string().min(1).max(60),
});
export type CreateServiceCategoryInput = z.infer<typeof CreateServiceCategoryInputSchema>;

export const UpdateServiceCategoryInputSchema = z.object({
  name: z.string().min(1).max(60).optional(),
});
export type UpdateServiceCategoryInput = z.infer<typeof UpdateServiceCategoryInputSchema>;

/* =========================================================================
 * Order (pedido / orden)
 * ========================================================================= */

export const OrderStatusSchema = z.enum([
  'received', // recibido
  'in_process', // en proceso
  'ready', // listo
  'delivered', // entregado
  'cancelled', // cancelado
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderItemSchema = z.object({
  id: UuidSchema,
  orderId: UuidSchema,
  serviceId: UuidSchema,
  serviceName: z.string(), // denormalizado para offline + tickets
  unit: ServiceUnitSchema,
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
  notes: z.string().max(200).optional(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderSchema = z.object({
  id: UuidSchema,
  tenantId: TenantIdSchema,
  code: z.string().regex(/^ORD-\d{4,}$/), // ORD-0001
  customerId: UuidSchema,
  customerName: z.string(), // denormalizado
  status: OrderStatusSchema,
  total: z.number().nonnegative(),
  paid: z.number().nonnegative().default(0),
  balance: z.number().nonnegative().default(0),
  estimatedDeliveryAt: TimestampSchema.optional(),
  deliveredAt: TimestampSchema.optional(),
  notes: z.string().max(500).optional(),
  items: z.array(OrderItemSchema).default([]),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Order = z.infer<typeof OrderSchema>;

/* =========================================================================
 * Payment
 * ========================================================================= */

export const PaymentMethodSchema = z.enum(['cash', 'card', 'transfer', 'other']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentSchema = z.object({
  id: UuidSchema,
  tenantId: TenantIdSchema,
  orderId: UuidSchema,
  method: PaymentMethodSchema,
  amount: z.number().positive(),
  reference: z.string().max(80).optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Payment = z.infer<typeof PaymentSchema>;

/* =========================================================================
 * Onboarding (Negocio / Sucursal / WhatsApp)
 * ========================================================================= */

/** Paso 1: datos fiscales del negocio. */
export const OnboardingNegocioInputSchema = z.object({
  fiscalName: z.string().min(2).max(120),
  fiscalAddress: z.string().min(5).max(200),
  fiscalTaxId: z.string().min(8).max(20).optional(),
});
export type OnboardingNegocioInput = z.infer<typeof OnboardingNegocioInputSchema>;

/** Paso 2: primera sucursal física. */
export const OnboardingSucursalInputSchema = z.object({
  branchName: z.string().min(2).max(120),
  branchAddress: z.string().min(5).max(200),
  branchPhone: z.string().min(8).max(30),
  /** Si true, el cliente copió address del paso 1 (no se persiste en el server). */
  sameAsFiscal: z.boolean().optional(),
});
export type OnboardingSucursalInput = z.infer<typeof OnboardingSucursalInputSchema>;

/** Paso 3: verificación de WhatsApp (demo). */
export const OnboardingWhatsappInputSchema = z.object({
  whatsappPhone: z.string().min(10).max(15),
  whatsappCode: z.string().length(6),
});
export type OnboardingWhatsappInput = z.infer<typeof OnboardingWhatsappInputSchema>;

/**
 * Body del PATCH /api/tenants/:id durante onboarding.
 * Discriminated union — el campo `step` (1|2|3) selecciona el schema.
 */
export const OnboardingStepInputSchema = z.discriminatedUnion('step', [
  OnboardingNegocioInputSchema.extend({ step: z.literal(1) }),
  OnboardingSucursalInputSchema.extend({ step: z.literal(2) }),
  OnboardingWhatsappInputSchema.extend({ step: z.literal(3) }),
]);
export type OnboardingStepInput = z.infer<typeof OnboardingStepInputSchema>;

/* =========================================================================
 * Auth
 * ========================================================================= */

export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RegisterInputSchema = z.object({
  tenantName: z.string().min(2).max(100),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: UserSchema,
  tenant: TenantSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/* =========================================================================
 * Sync (offline-first operation log)
 * ========================================================================= */

export const SyncOpTypeSchema = z.enum(['create', 'update', 'delete']);
export type SyncOpType = z.infer<typeof SyncOpTypeSchema>;

export const SyncEntityTypeSchema = z.enum([
  'customer',
  'service',
  'service_category',
  'order',
  'payment',
]);
export type SyncEntityType = z.infer<typeof SyncEntityTypeSchema>;

export const SyncOperationSchema = z.object({
  uuid: z.string(), // UUID v7 generado en cliente
  entity: SyncEntityTypeSchema,
  entityId: UuidSchema,
  op: SyncOpTypeSchema,
  payload: z.record(z.unknown()), // datos del registro
  timestamp: TimestampSchema,
});
export type SyncOperation = z.infer<typeof SyncOperationSchema>;

export const SyncPushBatchSchema = z.object({
  operations: z.array(SyncOperationSchema).max(500),
});
export type SyncPushBatch = z.infer<typeof SyncPushBatchSchema>;

export const SyncPullRequestSchema = z.object({
  since: TimestampSchema.optional(),
});
export type SyncPullRequest = z.infer<typeof SyncPullRequestSchema>;

export const SyncChangeSchema = z.object({
  entity: SyncEntityTypeSchema,
  entityId: UuidSchema,
  op: SyncOpTypeSchema,
  payload: z.record(z.unknown()),
  updatedAt: TimestampSchema,
  tombstone: z.boolean().default(false),
});
export type SyncChange = z.infer<typeof SyncChangeSchema>;

export const SyncPullResponseSchema = z.object({
  changes: z.array(SyncChangeSchema),
  serverTime: TimestampSchema,
});
export type SyncPullResponse = z.infer<typeof SyncPullResponseSchema>;

/* =========================================================================
 * POS — Crear pedido desde el POS
 * ========================================================================= */

export const CreateOrderItemInputSchema = z.object({
  serviceId: UuidSchema,
  quantity: z.number().positive(),
  notes: z.string().max(200).optional(),
});
export type CreateOrderItemInput = z.infer<typeof CreateOrderItemInputSchema>;

export const CreateOrderInputSchema = z.object({
  customerId: UuidSchema.optional(),
  customerName: z.string().min(1).max(120).optional(),
  customerPhone: z.string().max(30).optional(),
  isNewCustomer: z.boolean().default(false),
  items: z.array(CreateOrderItemInputSchema).min(1),
  estimatedDeliveryAt: TimestampSchema.optional(),
  notes: z.string().max(500).optional(),
});
export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;