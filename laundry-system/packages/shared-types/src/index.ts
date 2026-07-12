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
  // Logo — subido desde el módulo de configuración
  logoUrl: z.string().max(500).optional(),
  // Datos fiscales — paso 1 del onboarding
  fiscalName: z.string().min(2).max(120).optional(),
  fiscalAddress: z.string().min(5).max(200).optional(),
  fiscalTaxId: z.string().min(8).max(20).optional(),
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

/** Campos que se pueden editar desde el módulo de configuración. */
export const UpdateTenantInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  fiscalName: z.string().min(2).max(120).optional(),
  fiscalAddress: z.string().min(5).max(200).optional(),
  fiscalTaxId: z.string().min(8).max(20).optional(),
  whatsappPhone: z.string().min(10).max(15).optional(),
  logoUrl: z.string().max(500).optional(),
});
export type UpdateTenantInput = z.infer<typeof UpdateTenantInputSchema>;

/* =========================================================================
 * Branch (sucursal) — multi-sucursal desde MVP
 * ========================================================================= */

export const BranchSchema = z.object({
  id: UuidSchema,
  tenantId: TenantIdSchema,
  name: z.string().min(1).max(120),
  address: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  isMain: z.boolean().default(false),
  active: z.boolean().default(true),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Branch = z.infer<typeof BranchSchema>;

export const CreateBranchInputSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  isMain: z.boolean().default(false),
});
export type CreateBranchInput = z.infer<typeof CreateBranchInputSchema>;

export const UpdateBranchInputSchema = CreateBranchInputSchema.partial();
export type UpdateBranchInput = z.infer<typeof UpdateBranchInputSchema>;

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
  // Datos fiscales opcionales (clientes finales sin datos fiscales son OK).
  /** RFC (Registro Federal de Contribuyentes, México). 12-13 chars. */
  rfc: z.string().max(13).optional(),
  /** Razón social (para facturación). */
  legalName: z.string().max(120).optional(),
  deletedAt: TimestampSchema.nullable().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Customer = z.infer<typeof CustomerSchema>;

/**
 * Input para crear un customer. El server genera id, tenantId, createdAt,
 * updatedAt, deletedAt. Si el name ya existe activo en el tenant → 409.
 *
 * Regla de contacto: al menos uno de `phone` o `email` debe estar presente
 * (ambos pueden estar vacíos o solo string vacío — eso NO cuenta).
 */
export const CreateCustomerInputSchema = z
  .object({
    /** Si está presente, el server lo usa en vez de generar (offline-first). */
    id: UuidSchema.optional(),
    name: z.string().min(1).max(120),
    phone: z
      .string()
      .trim()
      .max(30)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    email: z
      .string()
      .trim()
      .max(200)
      .email()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    address: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    notes: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    rfc: z
      .string()
      .trim()
      .max(13)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    legalName: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  })
  .refine(
    (data) => Boolean(data.phone) || Boolean(data.email),
    {
      message: 'Indicá al menos un teléfono o un correo',
      path: ['phone'],
    },
  );
export type CreateCustomerInput = z.infer<typeof CreateCustomerInputSchema>;

export const UpdateCustomerInputSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    phone: z
      .string()
      .trim()
      .max(30)
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : v === null ? null : undefined)),
    email: z
      .string()
      .trim()
      .max(200)
      .email()
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v && v.length > 0 ? v : v === null ? null : undefined)),
    address: z
      .string()
      .trim()
      .max(200)
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : v === null ? null : undefined)),
    notes: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : v === null ? null : undefined)),
    rfc: z
      .string()
      .trim()
      .max(13)
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : v === null ? null : undefined)),
    legalName: z
      .string()
      .trim()
      .max(120)
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : v === null ? null : undefined)),
  })
  .refine(
    (data) => {
      // Si el cliente explícitamente está actualizando, permitimos que
      // phone y email sean ambos null (representa "borrar el contacto").
      // El backend ignora los nulls en su update — los campos quedan
      // como están en DB. Si quiere validar "al menos uno", lo hace
      // el service layer.
      return true;
    },
  );
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
  /** Si está presente, el server lo usa en vez de generar (offline-first). */
  id: UuidSchema.optional(),
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
  /**
   * Si está presente, el server lo usa en vez de generar. Usado por el
   * cliente offline-first para que la row local y la del server
   * compartan el mismo id (evita duplicación al hacer merge).
   */
  id: UuidSchema.optional(),
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
  branchId: UuidSchema.optional(),
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

export const PaymentMethodSchema = z.enum([
  'cash',
  'card',
  'transfer',
  'points',
  'other',
]);
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

/**
 * Input para crear un Payment. El server genera id, tenantId, createdAt,
 * updatedAt. Si está presente `id`, el server lo usa (offline-first).
 *
 * `amount` es positivo y menor o igual al balance pendiente del pedido
 * al momento de crearlo (validación server-side; cliente puede enviar
 * cualquier monto positivo y el server ajustará si excede).
 */
export const CreatePaymentInputSchema = z.object({
  /** Si está presente, el server lo usa en vez de generar (offline-first). */
  id: UuidSchema.optional(),
  orderId: UuidSchema,
  method: PaymentMethodSchema,
  amount: z.number().positive(),
  reference: z.string().max(80).optional(),
});
export type CreatePaymentInput = z.infer<typeof CreatePaymentInputSchema>;

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
  'tenant',
  'pending_upload',
  'branch',
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
  /**
   * Hint del cliente: precio unitario. Si está presente, el server
   * lo usa como fallback cuando el servicio no existe en el catálogo.
   * Si el servicio SÍ existe, el server usa el valor del catálogo
   * (source of truth).
   */
  unitPrice: z.number().nonnegative().optional(),
  /**
   * Hint del cliente: nombre denormalizado del servicio. Mismo
   * comportamiento que unitPrice: fallback si el server no conoce
   * el serviceId.
   */
  serviceName: z.string().max(80).optional(),
  /**
   * Hint del cliente: unidad de medida (kg o piece). Fallback si el
   * server no conoce el serviceId.
   */
  unit: ServiceUnitSchema.optional(),
});
export type CreateOrderItemInput = z.infer<typeof CreateOrderItemInputSchema>;

export const CreateOrderInputSchema = z.object({
  customerId: UuidSchema.optional(),
  customerName: z.string().min(1).max(120).optional(),
  customerPhone: z.string().max(30).optional(),
  isNewCustomer: z.boolean().default(false),
  branchId: UuidSchema.optional(),
  items: z.array(CreateOrderItemInputSchema).min(1),
  estimatedDeliveryAt: TimestampSchema.optional(),
  notes: z.string().max(500).optional(),
});
export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;

/* =========================================================================
 * Storage / Presigned Uploads (MinIO)
 * ========================================================================= */

export const ALLOWED_LOGO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/svg+xml',
] as const;

export const PresignLogoUploadRequestSchema = z.object({
  contentType: z.enum(ALLOWED_LOGO_MIME_TYPES),
  filename: z.string().min(1).max(120),
});
export type PresignLogoUploadRequest = z.infer<
  typeof PresignLogoUploadRequestSchema
>;

export const PresignLogoUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  key: z.string().min(1),
  publicUrl: z.string().url(),
  expiresAt: TimestampSchema,
});
export type PresignLogoUploadResponse = z.infer<
  typeof PresignLogoUploadResponseSchema
>;