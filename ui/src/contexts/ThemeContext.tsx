import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MantineProvider, MantineThemeOverride, createTheme } from '@mantine/core';
import { UserProfile } from './userProfile';
import { generateClient } from 'aws-amplify/api';
import { getSettings } from '../graphql/queries';
import { upsertSettings } from '../graphql/mutations';

const client = generateClient();

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

// 全局Logo配置接口
export interface GlobalLogoConfig {
  logoUrl?: string;
  lastUpdated: string;
  updatedBy: string;
}

export interface ThemeContextType {
  currentTheme: CustomTheme;
  availableThemes: CustomTheme[];
  globalLogo: string;
  setTheme: (theme: CustomTheme) => void;
  setGlobalLogo: (logoUrl: string) => void;
  canCustomizeTheme: (userProfile?: UserProfile) => boolean;
  saveCustomTheme: (theme: Omit<CustomTheme, 'id' | 'createdBy'>) => void;
  deleteCustomTheme: (themeId: string) => void;
}

const defaultThemes: CustomTheme[] = [
  {
    id: 'default',
    name: 'Cloudscape Light',
    primaryColor: '#0972d3',
    secondaryColor: '#ff9900',
    backgroundColor: '#ffffff',
    textColor: '#000716',
    createdBy: 'system',
    isDefault: true,
  },
  {
    id: 'dark',
    name: 'Cloudscape Dark',
    primaryColor: '#0972d3',
    secondaryColor: '#ff9900',
    backgroundColor: '#161616',
    textColor: '#ffffff',
    createdBy: 'system',
    isDefault: true,
  },
  {
    id: 'education',
    name: 'Education Blue',
    primaryColor: '#1976d2',
    secondaryColor: '#42a5f5',
    backgroundColor: '#fafafa',
    textColor: '#000716',
    createdBy: 'system',
    isDefault: true,
  },
  {
    id: 'emerald',
    name: 'Emerald Professional',
    primaryColor: '#037f0c',
    secondaryColor: '#0891b2',
    backgroundColor: '#ffffff',
    textColor: '#000716',
    createdBy: 'system',
    isDefault: true,
  },
  {
    id: 'warm',
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
  const [currentTheme, setCurrentTheme] = useState<CustomTheme>(defaultThemes[0]);
  const [availableThemes, setAvailableThemes] = useState<CustomTheme[]>(defaultThemes);
  const [globalLogo, setGlobalLogoState] = useState<string>('');

  // 检查用户是否可以自定义主题
  const canCustomizeTheme = (user?: UserProfile): boolean => {
    return user?.group !== 'students'; 
  };

  // 从云端加载设置
  const loadSettingsFromCloud = async () => {
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
              setAvailableThemes([...defaultThemes, ...themeSettings.customThemes]);
            }
            if (themeSettings.currentTheme) {
              setCurrentTheme(themeSettings.currentTheme);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading settings from cloud:', error);
      // 降级到localStorage
    }
  };

  // 从 localStorage 加载保存的主题和全局Logo，然后从云端同步
  useEffect(() => {
    const savedThemes = localStorage.getItem('customThemes');
    const savedCurrentTheme = localStorage.getItem('currentTheme');
    const savedGlobalLogo = localStorage.getItem('globalLogo');
    
    if (savedThemes) {
      try {
        const customThemes = JSON.parse(savedThemes);
        setAvailableThemes([...defaultThemes, ...customThemes]);
      } catch (error) {
        console.error('Error loading custom themes:', error);
      }
    }

    if (savedCurrentTheme) {
      try {
        const theme = JSON.parse(savedCurrentTheme);
        setCurrentTheme(theme);
      } catch (error) {
        console.error('Error loading current theme:', error);
      }
    }

    if (savedGlobalLogo) {
      try {
        const logoConfig = JSON.parse(savedGlobalLogo);
        console.log('🔍 Loading logo from localStorage:', {
          savedGlobalLogo: savedGlobalLogo.substring(0, 100) + '...',
          logoConfig,
          logoUrl: logoConfig.logoUrl?.substring(0, 50) + '...'
        });
        setGlobalLogoState(logoConfig.logoUrl || '');
      } catch (error) {
        console.error('❌ Error loading global logo:', error);
      }
    } else {
      console.log('🔍 No saved logo found in localStorage');
    }

    // 从云端加载最新设置
    loadSettingsFromCloud();
  }, []);

  // 设置全局Logo并保存到云端
  const setGlobalLogo = async (logoUrl: string) => {
    console.log('🔍 Setting global logo:', {
      logoLength: logoUrl.length,
      logoPreview: logoUrl.substring(0, 50) + '...',
      logoType: logoUrl.startsWith('data:') ? 'base64' : 'url'
    });
    
    setGlobalLogoState(logoUrl);
    const logoConfig: GlobalLogoConfig = {
      logoUrl,
      lastUpdated: new Date().toISOString(),
      updatedBy: userProfile?.email || 'unknown',
    };
    
    const logoConfigString = JSON.stringify(logoConfig);
    localStorage.setItem('globalLogo', logoConfigString);
    console.log('✅ Logo saved to localStorage:', {
      configLength: logoConfigString.length,
      updatedBy: logoConfig.updatedBy
    });
    
    // 保存到云端
    try {
      await client.graphql({
        query: upsertSettings,
        variables: {
          input: {
            uiLang: 'zh', // 保持当前语言设置
            globalLogo: logoUrl,
            themeSettings: JSON.stringify({
              customThemes: availableThemes.filter(theme => !theme.isDefault),
              currentTheme: currentTheme,
            }),
          },
        },
      });
      console.log('Global logo saved to cloud successfully');
    } catch (error) {
      console.error('Error saving global logo to cloud:', error);
      // 如果云端保存失败，至少保存到localStorage
    }
  };

  // 设置主题
  const setTheme = (theme: CustomTheme) => {
    setCurrentTheme(theme);
    localStorage.setItem('currentTheme', JSON.stringify(theme));
  };

  // 保存自定义主题
  const saveCustomTheme = (themeData: Omit<CustomTheme, 'id' | 'createdBy'>) => {
    if (!canCustomizeTheme(userProfile)) {
      throw new Error('You do not have permission to create custom themes');
    }

    const newTheme: CustomTheme = {
      ...themeData,
      id: `custom_${Date.now()}`,
      createdBy: userProfile?.email || 'unknown',
      isDefault: false,
    };

    const customThemes = availableThemes.filter(theme => !theme.isDefault);
    const updatedCustomThemes = [...customThemes, newTheme];
    const allThemes = [...defaultThemes, ...updatedCustomThemes];
    
    setAvailableThemes(allThemes);
    localStorage.setItem('customThemes', JSON.stringify(updatedCustomThemes));
  };

  // 删除自定义主题
  const deleteCustomTheme = (themeId: string) => {
    if (!canCustomizeTheme(userProfile)) {
      throw new Error('You do not have permission to delete custom themes');
    }

    const customThemes = availableThemes.filter(
      theme => !theme.isDefault && theme.id !== themeId
    );
    const allThemes = [...defaultThemes, ...customThemes];
    
    setAvailableThemes(allThemes);
    localStorage.setItem('customThemes', JSON.stringify(customThemes));

    // 如果删除的是当前主题，切换到默认主题
    if (currentTheme.id === themeId) {
      setTheme(defaultThemes[0]);
    }
  };

  // 创建 Mantine 主题配置
  const mantineTheme: MantineThemeOverride = createTheme({
    primaryColor: 'brand',
    colors: {
      brand: [
        currentTheme.primaryColor + '0D', // lightest
        currentTheme.primaryColor + '1A',
        currentTheme.primaryColor + '33',
        currentTheme.primaryColor + '4D',
        currentTheme.primaryColor + '66',
        currentTheme.primaryColor,          // main color
        currentTheme.primaryColor + 'CC',
        currentTheme.primaryColor + 'B3',
        currentTheme.primaryColor + '99',
        currentTheme.primaryColor + '80',   // darkest
      ],
    },
    other: {
      secondaryColor: currentTheme.secondaryColor,
      backgroundColor: currentTheme.backgroundColor,
      textColor: currentTheme.textColor,
      logoUrl: currentTheme.logoUrl,
    },
  });

  // 应用全局 CSS 变量
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', currentTheme.primaryColor);
    root.style.setProperty('--secondary-color', currentTheme.secondaryColor);
    root.style.setProperty('--background-color', currentTheme.backgroundColor);
    root.style.setProperty('--text-color', currentTheme.textColor);
    
    // 应用全局Logo
    root.style.setProperty('--global-logo-url', globalLogo ? `url(${globalLogo})` : 'none');
  }, [currentTheme, globalLogo]);

  const contextValue: ThemeContextType = {
    currentTheme,
    availableThemes,
    globalLogo,
    setTheme,
    setGlobalLogo,
    canCustomizeTheme,
    saveCustomTheme,
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
