/**
 * Pure JavaScript keychain implementation
 * Replaces keytar to allow Bun compilation
 */

import { homedir } from "os";
import { join } from "path";
import * as fs from "fs/promises";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const KEYCHAIN_DIR = join(homedir(), ".kuuzuki", "keychain");
const SALT = "kuuzuki-keychain-v1";

interface KeychainEntry {
  service: string;
  account: string;
  password: string;
  created: Date;
  modified: Date;
}

class PureJSKeychain {
  private algorithm = "aes-256-gcm";
  private keyLength = 32;
  private ivLength = 16;
  private tagLength = 16;
  private machineId: string;

  constructor() {
    // Use machine-specific data as part of encryption key
    this.machineId = [
      process.platform,
      process.arch,
      homedir(),
      process.env.USER || process.env.USERNAME || "default"
    ].join("-");
  }

  private async ensureDir() {
    await fs.mkdir(KEYCHAIN_DIR, { recursive: true, mode: 0o700 });
  }

  private deriveKey(): Buffer {
    // Derive a key from machine-specific data
    return scryptSync(this.machineId, SALT, this.keyLength);
  }

  private encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const key = this.deriveKey();
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, key, iv);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const tag = (cipher as any).getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString("hex"),
      tag: tag.toString("hex")
    };
  }

  private decrypt(encrypted: string, iv: string, tag: string): string {
    const key = this.deriveKey();
    const decipher = createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(iv, "hex")
    );
    
    (decipher as any).setAuthTag(Buffer.from(tag, "hex"));
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  }

  private getFilePath(service: string, account: string): string {
    // Create a safe filename from service and account
    const safe = (str: string) => str.replace(/[^a-zA-Z0-9-_]/g, "_");
    return join(KEYCHAIN_DIR, `${safe(service)}_${safe(account)}.json`);
  }

  async setPassword(service: string, account: string, password: string): Promise<void> {
    await this.ensureDir();
    
    const { encrypted, iv, tag } = this.encrypt(password);
    const entry = {
      service,
      account,
      encrypted,
      iv,
      tag,
      created: new Date().toISOString(),
      modified: new Date().toISOString()
    };
    
    const filePath = this.getFilePath(service, account);
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2), { mode: 0o600 });
  }

  async getPassword(service: string, account: string): Promise<string | null> {
    try {
      const filePath = this.getFilePath(service, account);
      const data = await fs.readFile(filePath, "utf8");
      const entry = JSON.parse(data);
      
      if (entry.service !== service || entry.account !== account) {
        return null;
      }
      
      return this.decrypt(entry.encrypted, entry.iv, entry.tag);
    } catch (error) {
      return null;
    }
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(service, account);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async findCredentials(service: string): Promise<Array<{ account: string; password: string }>> {
    try {
      await this.ensureDir();
      const files = await fs.readdir(KEYCHAIN_DIR);
      const credentials: Array<{ account: string; password: string }> = [];
      
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        
        try {
          const data = await fs.readFile(join(KEYCHAIN_DIR, file), "utf8");
          const entry = JSON.parse(data);
          
          if (entry.service === service) {
            const password = this.decrypt(entry.encrypted, entry.iv, entry.tag);
            credentials.push({ account: entry.account, password });
          }
        } catch (error) {
          // Skip corrupted entries
          continue;
        }
      }
      
      return credentials;
    } catch (error) {
      return [];
    }
  }
}

// Export a compatible interface with keytar
export const keychain = new PureJSKeychain();

export default {
  setPassword: (service: string, account: string, password: string) => 
    keychain.setPassword(service, account, password),
  
  getPassword: (service: string, account: string) => 
    keychain.getPassword(service, account),
  
  deletePassword: (service: string, account: string) => 
    keychain.deletePassword(service, account),
  
  findCredentials: (service: string) => 
    keychain.findCredentials(service)
};