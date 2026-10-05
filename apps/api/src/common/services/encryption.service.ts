import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const rawKey =
      process.env.ENCRYPTION_KEY ||
      'social_matters_crm_default_32byte_master_encryption_key_2026';
    
    // Ensure the key is exactly 32 bytes (256 bits) using SHA-256
    this.key = crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypt a plaintext string or object using AES-256-GCM
   * Returns a compact string in format: iv:authTag:ciphertext (all hex encoded)
   */
  encrypt(data: string | Record<string, any>): string {
    try {
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
      const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');

      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (err: any) {
      this.logger.error('Encryption failed', err.stack);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt an AES-256-GCM encrypted string
   * Throws if authentication tag doesn't match (tamper proof)
   */
  decrypt<T = any>(cipherString: string): T {
    try {
      // If data is unencrypted legacy plaintext JSON or string, parse and return safely
      if (!cipherString.includes(':') || cipherString.startsWith('{') || cipherString.startsWith('[')) {
        try {
          return JSON.parse(cipherString);
        } catch {
          return cipherString as any;
        }
      }

      const [ivHex, authTagHex, encryptedHex] = cipherString.split(':');
      if (!ivHex || !authTagHex || !encryptedHex) {
        throw new Error('Invalid ciphertext format');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted as any;
      }
    } catch (err: any) {
      this.logger.error('Decryption failed or data tampered', err.message);
      throw new Error('Failed to decrypt credentials');
    }
  }
}
