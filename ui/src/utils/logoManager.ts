import { generateClient } from 'aws-amplify/api';
import { createGlobalLogo, updateGlobalLogo } from '../graphql/mutations';
import { getGlobalLogo } from '../graphql/queries';

const client = generateClient();

export interface LogoInfo {
  id: string;
  logoUrl: string;
  uploadedBy: string;
  uploadedAt: string;
}

/**
 * 简化的全局logo管理器
 * 使用数据库存储logo信息，支持base64格式
 * 确保只有一个全局logo
 */
export class LogoManager {
  private static instance: LogoManager;
  
  public static getInstance(): LogoManager {
    if (!LogoManager.instance) {
      LogoManager.instance = new LogoManager();
    }
    return LogoManager.instance;
  }

  /**
   * 将文件转换为base64格式并上传到数据库
   */
  async uploadGlobalLogo(file: File, uploadedBy: string = 'unknown'): Promise<string> {
    try {
      // 将文件转换为base64
      const base64Url = await this.fileToBase64(file);
      
      // 保存到数据库
      await this.saveLogoToDatabase(base64Url, uploadedBy);
      
      return base64Url;
    } catch (error) {
      console.error('Error uploading logo:', error);
      throw new Error('Failed to upload logo: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * 从URL上传logo（支持外部URL和base64）
   */
  async uploadGlobalLogoFromUrl(logoUrl: string, uploadedBy: string = 'unknown'): Promise<string> {
    try {
      let finalLogoUrl = logoUrl;

      // 如果是外部URL，下载并转换为base64
      if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
        const response = await fetch(logoUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch logo from URL: ${response.statusText}`);
        }
        const blob = await response.blob();
        finalLogoUrl = await this.blobToBase64(blob);
      }
      
      // 如果已经是base64或data URL，直接使用
      // 保存到数据库
      await this.saveLogoToDatabase(finalLogoUrl, uploadedBy);
      
      return finalLogoUrl;
    } catch (error) {
      console.error('Error uploading logo from URL:', error);
      throw new Error('Failed to upload logo from URL: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * 获取当前全局logo的URL
   */
  async getCurrentLogoUrl(): Promise<string> {
    try {
      const result = await client.graphql({
        query: getGlobalLogo,
      });

      if ('data' in result && result.data?.getGlobalLogo) {
        return result.data.getGlobalLogo.logoUrl || '';
      }

      return '';
    } catch (error) {
      console.error('Error getting current logo URL:', error);
      return '';
    }
  }

  /**
   * 删除当前全局logo
   */
  async deleteCurrentLogo(): Promise<void> {
    try {
      // 更新数据库，将logoUrl设为空
      await this.saveLogoToDatabase('', 'system');
      console.log('Current logo deleted successfully');
    } catch (error) {
      console.error('Error deleting current logo:', error);
      throw new Error('Failed to delete current logo: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * 检查是否有当前logo
   */
  async hasCurrentLogo(): Promise<boolean> {
    try {
      const url = await this.getCurrentLogoUrl();
      return url !== '';
    } catch (error) {
      console.error('Error checking for current logo:', error);
      return false;
    }
  }

  /**
   * 获取logo信息（用于调试和管理）
   */
  async getLogoInfo(): Promise<LogoInfo | null> {
    try {
      const result = await client.graphql({
        query: getGlobalLogo,
      });

      if ('data' in result && result.data?.getGlobalLogo) {
        const logo = result.data.getGlobalLogo;
        return {
          id: logo.id,
          logoUrl: logo.logoUrl || '',
          uploadedBy: logo.uploadedBy || 'unknown',
          uploadedAt: logo.uploadedAt || new Date().toISOString(),
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting logo info:', error);
      return null;
    }
  }

  /**
   * 保存logo到数据库
   */
  private async saveLogoToDatabase(logoUrl: string, uploadedBy: string): Promise<void> {
    try {
      // 首先尝试获取现有的logo记录
      const existingResult = await client.graphql({
        query: getGlobalLogo,
      });

      const timestamp = new Date().toISOString();

      if ('data' in existingResult && existingResult.data?.getGlobalLogo) {
        // 更新现有记录
        await client.graphql({
          query: updateGlobalLogo,
          variables: {
            input: {
              id: existingResult.data.getGlobalLogo.id,
              logoUrl: logoUrl,
              uploadedBy: uploadedBy,
              uploadedAt: timestamp,
            }
          }
        });
      } else {
        // 创建新记录
        await client.graphql({
          query: createGlobalLogo,
          variables: {
            input: {
              id: 'global-logo', // 固定ID，确保只有一个记录
              logoUrl: logoUrl,
              uploadedBy: uploadedBy,
              uploadedAt: timestamp,
            }
          }
        });
      }
    } catch (error) {
      console.error('Error saving logo to database:', error);
      throw error;
    }
  }

  /**
   * 将文件转换为base64 data URL
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * 将blob转换为base64 data URL
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });
  }
}

// 导出单例实例
export const logoManager = LogoManager.getInstance();
