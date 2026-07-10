import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface PresignedPutResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresAt: number;
}

/**
 * StorageService — S3-compatible object storage via presigned URLs.
 *
 * Usa AWS SDK v3 contra un endpoint S3-compatible (MinIO local, o S3
 * en prod). La API nunca recibe el archivo — genera una URL prefirmada
 * para que el cliente haga PUT directo al bucket.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicHost: string;
  private readonly presignExpires: number;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.getOrThrow<string>('S3_ENDPOINT');
    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    const accessKey = this.config.getOrThrow<string>('S3_ACCESS_KEY');
    const secretKey = this.config.getOrThrow<string>('S3_SECRET_KEY');

    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    this.publicHost = this.config.get<string>('S3_PUBLIC_HOST', '');
    this.presignExpires = this.config.get<number>('S3_PRESIGN_EXPIRES_SECONDS', 300);

    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });
  }

  /**
   * Genera una URL prefirmada para que el cliente suba un archivo.
   *
   * @param key  Key del objeto en el bucket (ej: tenants/{id}/logo/{uuid}.png)
   * @param contentType  MIME type del archivo a subir
   * @returns  uploadUrl (PUT), key, publicUrl, expiresAt (timestamp ms)
   */
  async getPresignedPutUrl(
    key: string,
    contentType: string,
  ): Promise<PresignedPutResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const expiresIn = this.presignExpires;
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });

    const publicUrl = this.getPublicUrl(key);
    const expiresAt = Date.now() + expiresIn * 1000;

    this.logger.log(`Presigned PUT: ${key} (expires in ${expiresIn}s)`);

    return { uploadUrl, key, publicUrl, expiresAt };
  }

  /**
   * Devuelve la URL pública para acceder al recurso.
   *
   * Si `S3_PUBLIC_HOST` está configurado, usa ese hostname (reverse
   * proxy / CDN en prod). Si no, construye la URL del endpoint directo
   * (MinIO local).
   */
  getPublicUrl(key: string): string {
    if (this.publicHost) {
      const base = this.publicHost.replace(/\/$/, '');
      return `${base}/${this.bucket}/${key}`;
    }
    // MinIO local: endpoint ya incluye host:port
    const endpoint = this.config.getOrThrow<string>('S3_ENDPOINT');
    const base = endpoint.replace(/\/$/, '');
    return `${base}/${this.bucket}/${key}`;
  }

  /**
   * Elimina un objeto del bucket. No usado en MVP pero disponible para
   * limpieza futura (cambio de logo: delete el viejo).
   */
  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.client.send(command);
    this.logger.log(`Deleted: ${key}`);
  }
}
