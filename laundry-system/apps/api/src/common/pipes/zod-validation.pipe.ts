import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { type ZodType } from 'zod';

/**
 * ZodValidationPipe — validates body/query/params against a Zod schema.
 *
 * Usage:
 *   @Body(new ZodValidationPipe(LoginInputSchema)) dto: LoginInput
 *
 * Acepta schemas con `.transform()` (input ≠ output).
 */
@Injectable()
export class ZodValidationPipe<TOutput, TInput = TOutput> implements PipeTransform {
  constructor(private readonly schema: ZodType<TOutput, any, TInput>) {}

  transform(value: unknown): TOutput {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Datos inválidos',
        errors: result.error.flatten().fieldErrors,
        statusCode: 400,
      });
    }
    return result.data;
  }
}