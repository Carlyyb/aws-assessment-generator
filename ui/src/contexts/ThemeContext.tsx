import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { MantineProvider, MantineThemeOverride, createTheme } from '@mantine/core';
import { UserProfile } from './userProfile';
import { generateClient } from 'aws-amplify/api';
import { getSettings } from '../graphql/queries';
import { upsertSettings } from '../graphql/mutations';
import { logoManager } from '../utils/logoManager';

const client = generateClient();

// 保留旧接口用于向后兼容
export interface CustomTheme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  logo?: string;
  logoUrl?: string;
  createdBy: string;
  isDefault: boolean;
}

// 新的详细主题接口，支持设计令牌
export interface DetailedTheme {
  id: string;
  name: string;
  isDefault?: boolean;
  isCustom?: boolean;
  createdBy?: string;
  logoUrl?: string;

  // 设计令牌 (Design Tokens)
  colors: {
    // 全局颜色
    'color-background-body-content': string;
    'color-text-body-default': string;
    'color-text-link-default': string;
    'color-border-divider-default': string;

    // 顶部导航栏
    'color-background-top-navigation': string;
    'color-text-top-navigation-title': string;

    // 按钮 - 主要
    'color-background-button-primary-default': string;
    'color-text-button-primary-default': string;
    'color-background-button-primary-hover': string;
    'color-background-button-primary-active': string;

    // 按钮 - 普通
    'color-background-button-normal-default': string;
    'color-text-button-normal-default': string;
    'color-border-button-normal-default': string;
    'color-background-button-normal-hover': string;

    // 输入框
    'color-border-input-default': string;
    'color-border-item-focused': string;
    'color-background-input-default': string;

    // 容器和表面
    'color-background-container-content': string;
    'color-background-layout-main': string;
    
    // 状态颜色
    'color-text-status-info': string;
    'color-text-status-success': string;
    'color-text-status-warning': string;
    'color-text-status-error': string;

    // 侧边导航
    'color-background-side-navigation': string;
    'color-text-side-navigation-link': string;
    'color-background-side-navigation-item-selected': string;
  };
}

// 全局Logo配置接口
export interface GlobalLogoConfig {
  logoUrl?: string;
  lastUpdated: string;
  updatedBy: string;
}

export interface ThemeContextType {
  currentTheme: DetailedTheme;
  availableThemes: DetailedTheme[];
  globalLogo: string;
  setTheme: (themeId: string) => void;
  setGlobalLogo: (logoUrl: string) => void;
  deleteGlobalLogo: () => Promise<void>;
  canCustomizeTheme: (userProfile?: UserProfile) => boolean;
  saveCustomTheme: (theme: Omit<DetailedTheme, 'id' | 'createdBy'>) => Promise<void>;
  updateCustomTheme: (themeId: string, themeData: Partial<DetailedTheme['colors']>) => Promise<void>;
  deleteCustomTheme: (themeId: string) => void;
}

// 辅助函数：将旧主题转换为新的详细主题格式
const convertToDetailedTheme = (oldTheme: CustomTheme): DetailedTheme => {
  return {
    id: oldTheme.id,
    name: oldTheme.name,
    isDefault: oldTheme.isDefault,
    isCustom: !oldTheme.isDefault,
    createdBy: oldTheme.createdBy,
    logoUrl: oldTheme.logoUrl,
    colors: {
      // 全局颜色
      'color-background-body-content': oldTheme.backgroundColor,
      'color-text-body-default': oldTheme.textColor,
      'color-text-link-default': oldTheme.primaryColor,
      'color-border-divider-default': oldTheme.textColor === '#ffffff' ? '#414d5c' : '#e9ebed',

      // 顶部导航栏
      'color-background-top-navigation': oldTheme.primaryColor,
      'color-text-top-navigation-title': '#ffffff',

      // 按钮 - 主要
      'color-background-button-primary-default': oldTheme.primaryColor,
      'color-text-button-primary-default': '#ffffff',
      'color-background-button-primary-hover': oldTheme.primaryColor === 'rgb(53, 117, 201)' ? '#2a5a9b' : adjustColorBrightness(oldTheme.primaryColor, -20),
      'color-background-button-primary-active': oldTheme.primaryColor === 'rgb(53, 117, 201)' ? '#1e4378' : adjustColorBrightness(oldTheme.primaryColor, -30),

      // 按钮 - 普通
      'color-background-button-normal-default': 'transparent',
      'color-text-button-normal-default': oldTheme.secondaryColor,
      'color-border-button-normal-default': oldTheme.secondaryColor,
      'color-background-button-normal-hover': oldTheme.secondaryColor,

      // 输入框
      'color-border-input-default': oldTheme.textColor === '#ffffff' ? '#414d5c' : '#e9ebed',
      'color-border-item-focused': oldTheme.primaryColor,
      'color-background-input-default': oldTheme.backgroundColor,

      // 容器和表面
      'color-background-container-content': oldTheme.backgroundColor,
      'color-background-layout-main': oldTheme.backgroundColor,
      
      // 状态颜色
      'color-text-status-info': '#0972d3',
      'color-text-status-success': '#037f0c',
      'color-text-status-warning': '#b7651b',
      'color-text-status-error': '#d13212',

      // 侧边导航
      'color-background-side-navigation': oldTheme.backgroundColor === '#161616' ? '#16191f' : '#fafafa',
      'color-text-side-navigation-link': oldTheme.textColor,
      'color-background-side-navigation-item-selected': oldTheme.primaryColor,
    }
  };
};

// 辅助函数：调整颜色亮度
const adjustColorBrightness = (color: string, percent: number): string => {
  // 简化的颜色调整函数
  if (color.startsWith('rgb(')) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const r = Math.max(0, Math.min(255, parseInt(match[1]) + (parseInt(match[1]) * percent / 100)));
      const g = Math.max(0, Math.min(255, parseInt(match[2]) + (parseInt(match[2]) * percent / 100)));
      const b = Math.max(0, Math.min(255, parseInt(match[3]) + (parseInt(match[3]) * percent / 100)));
      return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }
  }
  return color;
};

const defaultThemes: CustomTheme[] = [
  {
    id: 'yas-blue',
    name: 'YAS Blue (默认)',
    primaryColor: 'rgb(53, 117, 201)',
    secondaryColor: '#ff9900',
    backgroundColor: '#ffffff',
    textColor: '#000716',
    createdBy: 'system',
    isDefault: true,
  },
  {
    id: 'cloudscape-light',
    name: 'Cloudscape Light',
    primaryColor: '#0972d3',
    secondaryColor: '#ff9900',
    backgroundColor: '#ffffff',
    textColor: '#000716',
    createdBy: 'system',
    isDefault: true,
  },
  {
    id: 'cloudscape-dark',
    name: 'Cloudscape Dark',
    primaryColor: '#0972d3',
    secondaryColor: '#ff9900',
    backgroundColor: '#161616',
    textColor: '#ffffff',
    createdBy: 'system',
    isDefault: true,
  },
  {
    id: 'education-blue',
    name: 'Education Blue',
    primaryColor: '#1976d2',
    secondaryColor: '#42a5f5',
    backgroundColor: '#fafafa',
    textColor: '#000716',
    createdBy: 'system',
    isDefault: true,
  },
  {
    id: 'emerald-professional',
    name: 'Emerald Professional',
    primaryColor: '#037f0c',
    secondaryColor: '#0891b2',
    backgroundColor: '#ffffff',
    textColor: '#000716',
    createdBy: 'system',
    isDefault: true,
  },
  {
    id: 'warm-orange',
    name: 'Warm Orange',
    primaryColor: '#b7651b',
    secondaryColor: '#0972d3',
    backgroundColor: '#fffbf7',
    textColor: '#000716',
    createdBy: 'system',
    isDefault: true,
  },
];

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
  userProfile?: UserProfile;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, userProfile }) => {
  // 将旧主题转换为详细主题
  const detailedDefaultThemes = useMemo(() => 
    defaultThemes.map(convertToDetailedTheme), 
    [] // 空依赖数组意味着只在组件首次挂载时计算一次
  );
  
  
   const [currentTheme, setCurrentTheme] = useState<DetailedTheme>(detailedDefaultThemes[0]);
  const [availableThemes, setAvailableThemes] = useState<DetailedTheme[]>(detailedDefaultThemes);
  const [globalLogo, setGlobalLogoState] = useState<string>('');

  // 检查用户是否可以自定义主题
  const canCustomizeTheme = (user?: UserProfile): boolean => {
    return user?.group !== 'students'; 
  };

  // 从云端加载设置
  const loadSettingsFromCloud = useCallback(async () => {
    try {
      const result = await client.graphql({
        query: getSettings,
      });
      
      // 类型守卫：确保result是GraphQLResult类型
      if ('data' in result) {
        const settings = result.data?.getSettings;
        if (settings) {
          // 加载全局Logo
          if (settings.globalLogo) {
            setGlobalLogoState(settings.globalLogo);
          }
          
          // 加载主题设置
          if (settings.themeSettings) {
            const themeSettings = JSON.parse(settings.themeSettings);
            if (themeSettings.customThemes) {
              const customThemes = themeSettings.customThemes.map((theme: CustomTheme | DetailedTheme) => {
                // 如果是旧格式主题，转换为新格式
                if ('primaryColor' in theme && !('colors' in theme)) {
                  return convertToDetailedTheme(theme as CustomTheme);
                }
                return theme as DetailedTheme;
              });
              setAvailableThemes([...detailedDefaultThemes, ...customThemes]);
            }
            if (themeSettings.currentTheme) {
              const currentTheme = themeSettings.currentTheme;
              // 如果是旧格式主题，转换为新格式
              if ('primaryColor' in currentTheme && !('colors' in currentTheme)) {
                setCurrentTheme(convertToDetailedTheme(currentTheme as CustomTheme));
              } else {
                setCurrentTheme(currentTheme as DetailedTheme);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading settings from cloud:', error);
      // 降级到localStorage
    }
  }, [detailedDefaultThemes]);

  // 从 localStorage 加载保存的主题和全局Logo，然后从云端同步
  useEffect(() => {
    const savedThemes = localStorage.getItem('customThemes');
    const savedCurrentTheme = localStorage.getItem('currentTheme');
    const savedGlobalLogo = localStorage.getItem('globalLogo');
    
    if (savedThemes) {
      try {
        const customThemes = JSON.parse(savedThemes);
        const convertedThemes = customThemes.map((theme: CustomTheme | DetailedTheme) => {
          // 如果是旧格式主题，转换为新格式
          if ('primaryColor' in theme && !('colors' in theme)) {
            return convertToDetailedTheme(theme as CustomTheme);
          }
          return theme as DetailedTheme;
        });
        setAvailableThemes([...detailedDefaultThemes, ...convertedThemes]);
      } catch (error) {
        console.error('Error loading custom themes:', error);
      }
    }

    if (savedCurrentTheme) {
      try {
        const theme = JSON.parse(savedCurrentTheme);
        // 如果是旧格式主题，转换为新格式
        if (theme.primaryColor && !theme.colors) {
          setCurrentTheme(convertToDetailedTheme(theme));
        } else {
          setCurrentTheme(theme);
        }
      } catch (error) {
        console.error('Error loading current theme:', error);
      }
    }

    // 加载全局Logo，优先从S3加载
    const loadGlobalLogo = async () => {
      try {
        // 首先尝试从S3加载当前logo
        const s3LogoUrl = await logoManager.getCurrentLogoUrl();
        if (s3LogoUrl) {
          console.log('✅ Logo loaded from S3:', s3LogoUrl.substring(0, 50) + '...');
          setGlobalLogoState(s3LogoUrl);
          return;
        }
      } catch (error) {
        console.error('⚠️ Error loading logo from S3:', error);
      }

      // 如果S3没有logo，尝试从localStorage加载
      if (savedGlobalLogo) {
        try {
          const logoConfig = JSON.parse(savedGlobalLogo);
          console.log('🔍 Loading logo from localStorage (fallback):', {
            savedGlobalLogo: savedGlobalLogo.substring(0, 100) + '...',
            logoConfig,
            logoUrl: logoConfig.logoUrl?.substring(0, 50) + '...'
          });
          setGlobalLogoState(logoConfig.logoUrl || '');
        } catch (error) {
          //console.error('❌ Error loading global logo from localStorage:', error);
        }
      } else {
        //console.log('🔍 No saved logo found in localStorage');
      }
    };

    // 执行logo加载
    loadGlobalLogo();

    // 从云端加载最新设置
    loadSettingsFromCloud();
  }, [detailedDefaultThemes, loadSettingsFromCloud]);

  // 设置全局Logo并保存到S3
  const setGlobalLogo = async (logoUrl: string) => {
    console.log('🔍 Setting global logo:', {
      logoLength: logoUrl.length,
      logoPreview: logoUrl.substring(0, 50) + '...',
      logoType: logoUrl.startsWith('data:') ? 'base64' : 'url'
    });
    
    try {
      // 使用新的S3-based logo manager上传logo
      let s3LogoUrl: string;
      
      if (logoUrl.startsWith('data:') || logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
        // 对于data URL或外部URL，使用logoManager上传到S3
        s3LogoUrl = await logoManager.uploadGlobalLogoFromUrl(logoUrl);
        console.log('✅ Logo uploaded to S3:', s3LogoUrl);
      } else {
        // 如果已经是S3 URL，直接使用
        s3LogoUrl = logoUrl;
      }
      
      // 更新状态
      setGlobalLogoState(s3LogoUrl);
      
      // 保存配置到localStorage（用于备份）
      const logoConfig: GlobalLogoConfig = {
        logoUrl: s3LogoUrl,
        lastUpdated: new Date().toISOString(),
        updatedBy: userProfile?.email || 'unknown',
      };
      
      const logoConfigString = JSON.stringify(logoConfig);
      localStorage.setItem('globalLogo', logoConfigString);
      console.log('✅ Logo config saved to localStorage');
      
      // 保存到云端设置
      await client.graphql({
        query: upsertSettings,
        variables: {
          input: {
            uiLang: 'zh', // 保持当前语言设置
            globalLogo: s3LogoUrl,
            themeSettings: JSON.stringify({
              customThemes: availableThemes.filter(theme => !theme.isDefault),
              currentTheme: currentTheme,
            }),
          },
        },
      });
      console.log('✅ Global logo saved to cloud successfully');
      
    } catch (error) {
      console.error('❌ Error setting global logo:', error);
      // 如果S3上传失败，回退到原来的方式（保存URL到localStorage和云端）
      setGlobalLogoState(logoUrl);
      const logoConfig: GlobalLogoConfig = {
        logoUrl,
        lastUpdated: new Date().toISOString(),
        updatedBy: userProfile?.email || 'unknown',
      };
      
      const logoConfigString = JSON.stringify(logoConfig);
      localStorage.setItem('globalLogo', logoConfigString);
      
      try {
        await client.graphql({
          query: upsertSettings,
          variables: {
            input: {
              uiLang: 'zh',
              globalLogo: logoUrl,
              themeSettings: JSON.stringify({
                customThemes: availableThemes.filter(theme => !theme.isDefault),
                currentTheme: currentTheme,
              }),
            },
          },
        });
        console.log('⚠️ Fallback: Logo URL saved to cloud');
      } catch (cloudError) {
        console.error('❌ Error saving logo to cloud (fallback):', cloudError);
        throw new Error('Failed to save logo: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  };

  // 删除全局Logo
  const deleteGlobalLogo = async () => {
    console.log('🔍 Deleting global logo');
    
    try {
      await logoManager.deleteCurrentLogo();
      console.log('✅ Logo deleted from S3');
      
      // 清空状态
      setGlobalLogoState('');
      
      // 清空localStorage
      localStorage.removeItem('globalLogo');
      console.log('✅ Logo config removed from localStorage');
      
      // 更新云端设置
      await client.graphql({
        query: upsertSettings,
        variables: {
          input: {
            uiLang: 'zh',
            globalLogo: '',
            themeSettings: JSON.stringify({
              customThemes: availableThemes.filter(theme => !theme.isDefault),
              currentTheme: currentTheme,
            }),
          },
        },
      });
      console.log('✅ Global logo cleared from cloud successfully');
      
    } catch (error) {
      console.error('❌ Error deleting global logo:', error);
      throw new Error('Failed to delete logo: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // 设置主题
  const setTheme = (themeId: string) => {
    const theme = availableThemes.find(t => t.id === themeId);
    if (theme) {
      setCurrentTheme(theme);
      localStorage.setItem('currentTheme', JSON.stringify(theme));
    }
  };

  // 保存自定义主题
  const saveCustomTheme = async (themeData: Omit<DetailedTheme, 'id' | 'createdBy'>) => {
    if (!canCustomizeTheme(userProfile)) {
      throw new Error('You do not have permission to create custom themes');
    }

    const newTheme: DetailedTheme = {
      ...themeData,
      id: `custom_${Date.now()}`,
      createdBy: userProfile?.email || 'unknown',
      isDefault: false,
      isCustom: true,
    };

    const customThemes = availableThemes.filter(theme => !theme.isDefault);
    const allThemes = [...detailedDefaultThemes, ...customThemes, newTheme];
    setAvailableThemes(allThemes);
    setCurrentTheme(newTheme);
    
    // 保存到云端和localStorage
    await saveThemeToCloud(allThemes, newTheme);
  };

  // 更新自定义主题
  const updateCustomTheme = async (themeId: string, themeData: Partial<DetailedTheme['colors']>) => {
    if (!canCustomizeTheme(userProfile)) {
      throw new Error('You do not have permission to update custom themes');
    }

    const updatedThemes = availableThemes.map(theme => {
      if (theme.id === themeId && theme.isCustom) {
        const updatedTheme = {
          ...theme,
          colors: { ...theme.colors, ...themeData }
        };
        if (currentTheme.id === themeId) {
          setCurrentTheme(updatedTheme);
        }
        return updatedTheme;
      }
      return theme;
    });

    setAvailableThemes(updatedThemes);
    const currentUpdatedTheme = updatedThemes.find(t => t.id === themeId);
    if (currentUpdatedTheme) {
      await saveThemeToCloud(updatedThemes, currentUpdatedTheme);
    }
  };

  // 辅助函数：保存主题到云端
  const saveThemeToCloud = async (themes: DetailedTheme[], currentTheme: DetailedTheme) => {
    try {
      await client.graphql({
        query: upsertSettings,
        variables: {
          input: {
            uiLang: 'zh',
            globalLogo: globalLogo,
            themeSettings: JSON.stringify({
              customThemes: themes.filter(theme => !theme.isDefault),
              currentTheme: currentTheme,
            }),
          },
        },
      });
    } catch (error) {
      console.error('Error saving theme to cloud:', error);
    }
  };

  // 删除自定义主题
  const deleteCustomTheme = (themeId: string) => {
    if (!canCustomizeTheme(userProfile)) {
      throw new Error('You do not have permission to delete custom themes');
    }

    const customThemes = availableThemes.filter(
      theme => !theme.isDefault && theme.id !== themeId
    );
    const allThemes = [...detailedDefaultThemes, ...customThemes];
    
    setAvailableThemes(allThemes);

    // 如果删除的是当前主题，切换到默认主题
    if (currentTheme.id === themeId) {
      setTheme(detailedDefaultThemes[0].id);
    }
  };

  // 创建 Mantine 主题配置
  const mantineTheme: MantineThemeOverride = createTheme({
    primaryColor: 'brand',
    colors: {
      brand: [
        currentTheme.colors['color-background-button-primary-default'] + '0D', // lightest
        currentTheme.colors['color-background-button-primary-default'] + '1A',
        currentTheme.colors['color-background-button-primary-default'] + '33',
        currentTheme.colors['color-background-button-primary-default'] + '4D',
        currentTheme.colors['color-background-button-primary-default'] + '66',
        currentTheme.colors['color-background-button-primary-default'],          // main color
        currentTheme.colors['color-background-button-primary-default'] + 'CC',
        currentTheme.colors['color-background-button-primary-default'] + 'B3',
        currentTheme.colors['color-background-button-primary-default'] + '99',
        currentTheme.colors['color-background-button-primary-default'] + '80',   // darkest
      ],
    },
    other: {
      primaryColor: currentTheme.colors['color-background-button-primary-default'],
      secondaryColor: currentTheme.colors['color-text-button-normal-default'],
      backgroundColor: currentTheme.colors['color-background-body-content'],
      textColor: currentTheme.colors['color-text-body-default'],
      logoUrl: currentTheme.logoUrl,
    },
  });

  // 应用全局 CSS 变量
  useEffect(() => {
    const root = document.documentElement;
    
    // 设置所有设计令牌为CSS变量
    Object.entries(currentTheme.colors).forEach(([token, value]) => {
      root.style.setProperty(`--${token}`, value);
    });
    
    // 为了向后兼容，保留旧的变量名
    root.style.setProperty('--primary-color', currentTheme.colors['color-background-button-primary-default']);
    root.style.setProperty('--secondary-color', currentTheme.colors['color-text-button-normal-default']);
    root.style.setProperty('--background-color', currentTheme.colors['color-background-body-content']);
    root.style.setProperty('--text-color', currentTheme.colors['color-text-body-default']);
    
    // 应用全局Logo
    root.style.setProperty('--global-logo-url', globalLogo ? `url(${globalLogo})` : 'none');
  }, [currentTheme, globalLogo]);

  const contextValue: ThemeContextType = {
    currentTheme,
    availableThemes,
    globalLogo,
    setTheme,
    setGlobalLogo,
    deleteGlobalLogo,
    canCustomizeTheme,
    saveCustomTheme,
    updateCustomTheme,
    deleteCustomTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <MantineProvider theme={mantineTheme}>
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  );
};
