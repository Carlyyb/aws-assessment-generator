import React, { useState } from 'react';
import {
  Button,
  Modal,
  SpaceBetween,
  FormField,
  Input,
  ColumnLayout,
  Container,
  Header,
  Select,
  Box,
  Tabs,
  Flashbar,
  FlashbarProps,
} from '@cloudscape-design/components';
import { DetailedTheme, useTheme } from '../contexts/ThemeContext';
import { useUserProfile } from '../contexts/userProfile';

export const EnhancedThemeSettings: React.FC = () => {
  const { 
    currentTheme, 
    availableThemes, 
    setTheme, 
    saveCustomTheme, 
    updateCustomTheme, 
    deleteCustomTheme, 
    globalLogo, 
    setGlobalLogo,
    deleteGlobalLogo,
    canCustomizeTheme 
  } = useTheme();
  const userProfile = useUserProfile();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTheme, setEditingTheme] = useState<DetailedTheme | null>(null);
  const [notifications, setNotifications] = useState<FlashbarProps.MessageDefinition[]>([]);
  const [logoUrl, setLogoUrl] = useState(globalLogo || '');
  const [formData, setFormData] = useState<Omit<DetailedTheme, 'id' | 'isDefault' | 'createdBy'>>({
    name: '',
    logoUrl: globalLogo || '',
    isCustom: true,
    colors: {
      // 全局颜色
      'color-background-body-content': '#ffffff',
      'color-text-body-default': '#16191f',
      'color-text-link-default': '#0073bb',
      'color-border-divider-default': '#e9ebed',

      // 顶部导航栏
      'color-background-top-navigation': '#232f3e',
      'color-text-top-navigation-title': '#ffffff',

      // 按钮 - 主要
      'color-background-button-primary-default': '#3575c9',
      'color-text-button-primary-default': '#ffffff',
      'color-background-button-primary-hover': '#2a5a9b',
      'color-background-button-primary-active': '#1e4378',

      // 按钮 - 普通
      'color-background-button-normal-default': 'transparent',
      'color-text-button-normal-default': '#ff9900',
      'color-border-button-normal-default': '#ff9900',
      'color-background-button-normal-hover': '#ff9900',

      // 输入框
      'color-border-input-default': '#e9ebed',
      'color-border-item-focused': '#3575c9',
      'color-background-input-default': '#ffffff',

      // 容器和表面
      'color-background-container-content': '#ffffff',
      'color-background-layout-main': '#ffffff',
      
      // 状态颜色
      'color-text-status-info': '#0972d3',
      'color-text-status-success': '#037f0c',
      'color-text-status-warning': '#b7651b',
      'color-text-status-error': '#d13212',

      // 侧边导航
      'color-background-side-navigation': '#fafafa',
      'color-text-side-navigation-link': '#16191f',
      'color-background-side-navigation-item-selected': '#3575c9',
    }
  });

  const canCustomize = canCustomizeTheme(userProfile);

  const addNotification = (notification: Omit<FlashbarProps.MessageDefinition, 'id'>) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { ...notification, id }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // 当打开模态框进行编辑时，填充表单数据
  const handleStartEdit = (theme: DetailedTheme) => {
    setEditingTheme(theme);
    setFormData({
      name: theme.name,
      logoUrl: theme.logoUrl || globalLogo || '',
      isCustom: true,
      colors: { ...theme.colors },
    });
    setIsModalVisible(true);
  };
  
  const handleCreateNew = () => {
    setEditingTheme(null);
    // 使用当前主题作为新主题的基础
    setFormData({
      name: '我的自定义主题',
      logoUrl: globalLogo || '',
      isCustom: true,
      colors: { ...currentTheme.colors },
    });
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    try {
      if (editingTheme) {
        // 更新逻辑
        await updateCustomTheme(editingTheme.id, formData.colors);
        addNotification({
          type: 'success',
          header: '主题更新成功',
          content: `主题 "${formData.name}" 已成功更新。`,
        });
      } else {
        // 创建逻辑
        await saveCustomTheme(formData);
        addNotification({
          type: 'success',
          header: '主题创建成功',
          content: `主题 "${formData.name}" 已成功创建并应用。`,
        });
      }
      setIsModalVisible(false);
    } catch (error) {
      addNotification({
        type: 'error',
        header: '操作失败',
        content: error instanceof Error ? error.message : '未知错误',
      });
    }
  };

  const handleDelete = async (themeId: string) => {
    try {
      deleteCustomTheme(themeId);
      addNotification({
        type: 'success',
        header: '主题删除成功',
        content: '自定义主题已成功删除。',
      });
    } catch (error) {
      addNotification({
        type: 'error',
        header: '删除失败',
        content: error instanceof Error ? error.message : '未知错误',
      });
    }
  };

  const handleLogoUpload = async () => {
    try {
      if (logoUrl !== globalLogo) {
        await setGlobalLogo(logoUrl);
        addNotification({
          type: 'success',
          header: 'Logo更新成功',
          content: '全局Logo已成功更新。',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        header: 'Logo更新失败',
        content: error instanceof Error ? error.message : '未知错误',
      });
    }
  };

  const handleLogoDelete = async () => {
    try {
      await deleteGlobalLogo();
      setLogoUrl('');
      addNotification({
        type: 'success',
        header: 'Logo删除成功',
        content: '全局Logo已成功删除。',
      });
    } catch (error) {
      addNotification({
        type: 'error',
        header: 'Logo删除失败',
        content: error instanceof Error ? error.message : '未知错误',
      });
    }
  };

  const renderColorInput = (label: string, token: keyof DetailedTheme['colors'], description?: string) => (
    <FormField label={label} description={description}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="color"
          value={formData.colors[token]}
          onChange={(e) =>
            setFormData(prev => ({ 
              ...prev, 
              colors: { ...prev.colors, [token]: e.target.value } 
            }))
          }
          style={{ width: '60px', height: '36px', padding: '2px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <Input
          value={formData.colors[token]}
          onChange={({ detail }) =>
            setFormData(prev => ({ 
              ...prev, 
              colors: { ...prev.colors, [token]: detail.value } 
            }))
          }
          placeholder="例如: #3575c9 或 rgb(53, 117, 201)"
        />
      </div>
    </FormField>
  );

  // 主题预览函数
  const renderThemePreview = () => {
    const previewStyle = Object.entries(formData.colors).reduce((acc: Record<string, string>, [token, value]) => {
      acc[`--${token}`] = value;
      return acc;
    }, {});

    return (
      <div 
        className="cloudscape-modern-theme"
        style={{
          ...previewStyle,
          padding: '16px',
          border: '2px solid var(--color-border-divider-default)',
          borderRadius: '8px',
          backgroundColor: 'var(--color-background-body-content)',
          color: 'var(--color-text-body-default)'
        }}
      >
        <SpaceBetween size="m">
          <Header variant="h3" description="以下是主题预览效果">
            主题预览
          </Header>
          
          <ColumnLayout columns={2}>
            <Box>
              <Box variant="h4">按钮样式</Box>
              <SpaceBetween size="s">
                <Button variant="primary">主要按钮</Button>
                <Button variant="normal">普通按钮</Button>
                <Button variant="link">链接按钮</Button>
              </SpaceBetween>
            </Box>
            
            <Box>
              <Box variant="h4">状态提示</Box>
              <SpaceBetween size="s">
                <div style={{ 
                  padding: '8px 12px', 
                  borderRadius: '4px', 
                  backgroundColor: 'var(--color-text-status-info)', 
                  color: 'white',
                  fontSize: '14px'
                }}>
                  信息提示
                </div>
                <div style={{ 
                  padding: '8px 12px', 
                  borderRadius: '4px', 
                  backgroundColor: 'var(--color-text-status-success)', 
                  color: 'white',
                  fontSize: '14px'
                }}>
                  成功提示
                </div>
                <div style={{ 
                  padding: '8px 12px', 
                  borderRadius: '4px', 
                  backgroundColor: 'var(--color-text-status-warning)', 
                  color: 'white',
                  fontSize: '14px'
                }}>
                  警告提示
                </div>
              </SpaceBetween>
            </Box>
          </ColumnLayout>
          
          <Box>
            <Box variant="h4">导航栏样式</Box>
            <div style={{
              backgroundColor: 'var(--color-background-top-navigation)',
              color: 'var(--color-text-top-navigation-title)',
              padding: '12px 16px',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}>
              顶部导航栏示例
            </div>
          </Box>
          
          <Box>
            <Box variant="h4">表单元素</Box>
            <ColumnLayout columns={2}>
              <FormField label="文本输入">
                <Input 
                  placeholder="输入文本..."
                  value="示例文本"
                  onChange={() => {}}
                  readOnly
                />
              </FormField>
              <FormField label="链接文本">
                <div style={{ color: 'var(--color-text-link-default)' }}>
                  这是一个链接示例
                </div>
              </FormField>
            </ColumnLayout>
          </Box>

          {/* Logo预览 */}
          {(formData.logoUrl || globalLogo) && (
            <Box>
              <Box variant="h4">Logo预览</Box>
              <div style={{
                backgroundColor: 'var(--color-background-top-navigation)',
                padding: '12px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img 
                  src={formData.logoUrl || globalLogo || ''} 
                  alt="Logo预览" 
                  style={{ 
                    maxHeight: '40px', 
                    maxWidth: '200px',
                    objectFit: 'contain'
                  }} 
                />
              </div>
            </Box>
          )}
        </SpaceBetween>
      </div>
    );
  };

  const customThemes = availableThemes.filter(theme => theme.isCustom);

  return (
    <SpaceBetween size="l">
      <Flashbar items={notifications} />
      
      <Container header={<Header variant="h2">主题设置</Header>}>
        <SpaceBetween size="l">
          <FormField label="当前主题">
            <Select
              selectedOption={{ label: currentTheme.name, value: currentTheme.id }}
              onChange={({ detail }) => setTheme(detail.selectedOption.value!)}
              options={availableThemes.map(th => ({ 
                label: th.name + (th.isCustom ? ' (自定义)' : ''),
                value: th.id 
              }))}
            />
          </FormField>
          
          {canCustomize && (
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" onClick={handleCreateNew}>创建自定义主题</Button>
              {currentTheme.isCustom && (
                <Button variant="normal" onClick={() => handleStartEdit(currentTheme)}>编辑当前主题</Button>
              )}
            </SpaceBetween>
          )}

          {/* 全局Logo设置 */}
          <Container header={<Header variant="h3">全局Logo设置</Header>}>
            <SpaceBetween size="m">
              {/* URL输入方式 */}
              <FormField 
                label="Logo URL" 
                description="请输入Logo的URL地址或base64编码的图片数据"
              >
                <Input
                  value={logoUrl}
                  onChange={({ detail }) => setLogoUrl(detail.value)}
                  placeholder="https://example.com/logo.png 或 data:image/..."
                />
              </FormField>
              <SpaceBetween direction="horizontal" size="s">
                <Button variant="primary" onClick={handleLogoUpload} disabled={logoUrl === globalLogo}>
                  更新Logo
                </Button>
                {globalLogo && (
                  <Button onClick={handleLogoDelete} variant="link">
                    删除当前Logo
                  </Button>
                )}
              </SpaceBetween>
              
              {/* Logo预览 */}
              {globalLogo && (
                <Box>
                  <div style={{ marginTop: '10px' }}>
                    <strong>当前Logo预览：</strong>
                    <br />
                    <img 
                      src={globalLogo} 
                      alt="当前Logo" 
                      style={{ 
                        maxHeight: '40px', 
                        maxWidth: '200px', 
                        objectFit: 'contain',
                        marginTop: '5px',
                        border: '1px solid #e9ebed',
                        borderRadius: '4px',
                        padding: '4px'
                      }} 
                    />
                  </div>
                </Box>
              )}
            </SpaceBetween>
          </Container>

          {/* 自定义主题管理 */}
          {canCustomize && customThemes.length > 0 && (
            <Container header={<Header variant="h3">自定义主题管理</Header>}>
              <SpaceBetween size="s">
                {customThemes.map(theme => (
                  <Box key={theme.id}>
                    <SpaceBetween direction="horizontal" size="s">
                      <div style={{ flex: 1 }}>
                        <strong>{theme.name}</strong>
                        {theme.id === currentTheme.id && (
                          <span style={{ color: '#037f0c', marginLeft: '8px' }}>(当前)</span>
                        )}
                      </div>
                      <Button 
                        variant="normal"
                        onClick={() => handleStartEdit(theme)}
                      >
                        编辑
                      </Button>
                      <Button 
                        variant="link"
                        onClick={() => handleDelete(theme.id)}
                      >
                        删除
                      </Button>
                    </SpaceBetween>
                  </Box>
                ))}
              </SpaceBetween>
            </Container>
          )}
        </SpaceBetween>
      </Container>

      <Modal
        onDismiss={() => setIsModalVisible(false)}
        visible={isModalVisible}
        header={editingTheme ? "编辑自定义主题" : "创建自定义主题"}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setIsModalVisible(false)}>取消</Button>
              <Button variant="primary" onClick={handleSave}>保存</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <form onSubmit={e => e.preventDefault()}>
          <SpaceBetween size="l">
            <FormField label="主题名称">
              <Input 
                value={formData.name} 
                onChange={({detail}) => setFormData(p => ({...p, name: detail.value}))} 
                placeholder="输入主题名称"
              />
            </FormField>
            
            <Tabs
              tabs={[
                {
                  label: "预览",
                  id: "preview",
                  content: renderThemePreview()
                },
                {
                  label: "全局颜色",
                  id: "global",
                  content: (
                    <ColumnLayout columns={2}>
                      {renderColorInput('页面背景色', 'color-background-body-content', '整个应用的主要背景色')}
                      {renderColorInput('正文文本色', 'color-text-body-default', '页面上大部分文字的颜色')}
                      {renderColorInput('链接文本色', 'color-text-link-default', '超链接的颜色')}
                      {renderColorInput('分割线颜色', 'color-border-divider-default', '分割线和边框的颜色')}
                    </ColumnLayout>
                  )
                },
                {
                  label: "按钮颜色",
                  id: "buttons",
                  content: (
                    <ColumnLayout columns={2}>
                      {renderColorInput('主要按钮背景', 'color-background-button-primary-default', '主要操作按钮的背景色')}
                      {renderColorInput('主要按钮文本', 'color-text-button-primary-default', '主要按钮上的文字颜色')}
                      {renderColorInput('主要按钮悬停', 'color-background-button-primary-hover', '鼠标悬停时的背景色')}
                      {renderColorInput('主要按钮激活', 'color-background-button-primary-active', '按钮被点击时的背景色')}
                      {renderColorInput('普通按钮边框', 'color-border-button-normal-default', '普通按钮的边框颜色')}
                      {renderColorInput('普通按钮文本', 'color-text-button-normal-default', '普通按钮的文字颜色')}
                      {renderColorInput('普通按钮悬停', 'color-background-button-normal-hover', '普通按钮悬停时的背景色')}
                    </ColumnLayout>
                  )
                },
                {
                  label: "导航栏",
                  id: "navigation",
                  content: (
                    <ColumnLayout columns={2}>
                      {renderColorInput('顶部导航背景', 'color-background-top-navigation', '顶部导航栏的背景色')}
                      {renderColorInput('顶部导航文字', 'color-text-top-navigation-title', '顶部导航栏的文字颜色')}
                      {renderColorInput('侧边导航背景', 'color-background-side-navigation', '侧边导航栏的背景色')}
                      {renderColorInput('侧边导航文字', 'color-text-side-navigation-link', '侧边导航栏的文字颜色')}
                      {renderColorInput('导航选中项', 'color-background-side-navigation-item-selected', '侧边导航栏选中项的背景色')}
                    </ColumnLayout>
                  )
                },
                {
                  label: "输入框和表单",
                  id: "forms",
                  content: (
                    <ColumnLayout columns={2}>
                      {renderColorInput('输入框边框', 'color-border-input-default', '输入框的默认边框颜色')}
                      {renderColorInput('聚焦边框', 'color-border-item-focused', '输入框获得焦点时的边框颜色')}
                      {renderColorInput('输入框背景', 'color-background-input-default', '输入框的背景色')}
                      {renderColorInput('容器背景', 'color-background-container-content', '内容容器的背景色')}
                      {renderColorInput('主要布局背景', 'color-background-layout-main', '主要布局区域的背景色')}
                    </ColumnLayout>
                  )
                },
                {
                  label: "状态颜色",
                  id: "status",
                  content: (
                    <ColumnLayout columns={2}>
                      {renderColorInput('信息状态', 'color-text-status-info', '信息提示的颜色')}
                      {renderColorInput('成功状态', 'color-text-status-success', '成功提示的颜色')}
                      {renderColorInput('警告状态', 'color-text-status-warning', '警告提示的颜色')}
                      {renderColorInput('错误状态', 'color-text-status-error', '错误提示的颜色')}
                    </ColumnLayout>
                  )
                }
              ]}
            />
          </SpaceBetween>
        </form>
      </Modal>
    </SpaceBetween>
  );
};
