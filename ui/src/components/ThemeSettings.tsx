import React, { useState } from 'react';
import {
  Box,
  Button,
  Container,
  SpaceBetween,
  Header,
  FormField,
  Select,
  Input,
  ColumnLayout,
  ExpandableSection,
  Alert,
  Flashbar,
  FlashbarProps,
} from '@cloudscape-design/components';
import { useTheme } from '../contexts/ThemeContext';
import { getText } from '../i18n/lang';
import { useUserProfile } from '../contexts/userProfile';

export const ThemeSettings: React.FC = () => {
  const { currentTheme, availableThemes, globalLogo, setTheme, setGlobalLogo, canCustomizeTheme, saveCustomTheme, deleteCustomTheme } = useTheme();
  const userProfile = useUserProfile();
  const [notifications, setNotifications] = useState<FlashbarProps.MessageDefinition[]>([]);
  const [editingTheme, setEditingTheme] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    primaryColor: '#232f3e',
    secondaryColor: '#ff9900',
    backgroundColor: '#ffffff',
    textColor: '#000000',
  });
  
  const [logoUrl, setLogoUrl] = useState(globalLogo || '');
  const [previewTheme, setPreviewTheme] = useState(currentTheme);

  const canCustomize = canCustomizeTheme(userProfile);

  // 更新实时预览
  const updatePreview = (data: typeof formData, currentLogoUrl?: string) => {
    setPreviewTheme({
      id: 'preview',
      name: data.name || '预览主题',
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      backgroundColor: data.backgroundColor,
      textColor: data.textColor,
      logoUrl: currentLogoUrl !== undefined ? currentLogoUrl : logoUrl,
      createdBy: userProfile?.email || '',
      isDefault: false,
    });
  };

  // 开始编辑主题
  const startEditTheme = (theme: any) => {
    setEditingTheme(theme.id);
    const editData = {
      name: theme.name,
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor,
      backgroundColor: theme.backgroundColor,
      textColor: theme.textColor,
    };
    setFormData(editData);
    updatePreview(editData);
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingTheme(null);
    setFormData({
      name: '',
      primaryColor: '#232f3e',
      secondaryColor: '#ff9900',
      backgroundColor: '#ffffff',
      textColor: '#000000',
    });
    setPreviewTheme(currentTheme);
  };

  // 更新现有主题
  const updateCustomTheme = (themeId: string) => {
    if (!formData.name.trim()) {
      addNotification({
        type: 'error',
        content: getText('theme.error.nameRequired'),
      });
      return;
    }

    try {
      // 先删除旧主题，再保存新主题
      deleteCustomTheme(themeId);
      saveCustomTheme({
        ...formData,
        logoUrl: logoUrl,
        isDefault: false,
      });
      
      setEditingTheme(null);
      addNotification({
        type: 'success',
        content: '主题更新成功',
      });
      cancelEdit();
    } catch (error) {
      addNotification({
        type: 'error',
        content: '主题更新失败',
      });
    }
  };

  const addNotification = (notification: FlashbarProps.MessageDefinition) => {
    const id = Date.now().toString();
    setNotifications([
      ...notifications,
      {
        ...notification,
        id,
        dismissible: true,
        onDismiss: () => setNotifications(notifications => notifications.filter(n => n.id !== id)),
      },
    ]);
  };

  const handleSaveTheme = () => {
    if (!formData.name.trim()) {
      addNotification({
        type: 'error',
        content: getText('theme.error.nameRequired'),
      });
      return;
    }

    try {
      saveCustomTheme({
        ...formData,
        logoUrl: logoUrl,
        isDefault: false,
      });
      addNotification({
        type: 'success',
        content: getText('theme.success.saved'),
      });
      setFormData({
        name: '',
        primaryColor: '#232f3e',
        secondaryColor: '#ff9900',
        backgroundColor: '#ffffff',
        textColor: '#000000',
      });
    } catch (error) {
      addNotification({
        type: 'error',
        content: getText('theme.error.saveFailed'),
      });
    }
  };

  const handleDeleteTheme = (themeId: string) => {
    try {
      deleteCustomTheme(themeId);
      addNotification({
        type: 'success',
        content: getText('theme.success.deleted'),
      });
    } catch (error) {
      addNotification({
        type: 'error',
        content: getText('theme.error.deleteFailed'),
      });
    }
  };

  const themeOptions = availableThemes.map(theme => ({
    value: theme.id,
    label: theme.name,
  }));

  return (
    <Container>
      <SpaceBetween size="l">
        <Flashbar items={notifications} />
        
        {/* 全局Logo设置 */}
        {canCustomize && (
          <Container
            header={<Header variant="h2">Logo 设置</Header>}
          >
            <SpaceBetween size="m">
              <FormField label="网站 Logo" description="设置网站全局显示的 Logo">
                <SpaceBetween size="s">
                  <div>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.svg"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const files = Array.from(e.target.files);
                          if (files.length > 0) {
                            const file = files[0];
                            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'];
                            if (!allowedTypes.includes(file.type)) {
                              addNotification({
                                type: 'error',
                                content: '只支持 JPG、PNG、SVG 格式的图片文件',
                              });
                              return;
                            }
                            if (file.size > 5 * 1024 * 1024) {
                              addNotification({
                                type: 'error',
                                content: '文件大小不能超过 5MB',
                              });
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (e) => {
                              const url = e.target?.result as string;
                              setLogoUrl(url);
                              updatePreview(formData, url);
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                      style={{ marginBottom: '8px' }}
                    />
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      支持 JPG、PNG、SVG 格式，最大 5MB
                    </div>
                  </div>
                  <Input
                    value={logoUrl}
                    onChange={(e) => {
                      setLogoUrl(e.detail.value);
                      updatePreview(formData, e.detail.value);
                    }}
                    placeholder="或输入 Logo URL"
                  />
                  {logoUrl && (
                    <Box margin={{ top: 'xs' }}>
                      <img 
                        src={logoUrl} 
                        alt="Logo preview" 
                        style={{ height: '60px', objectFit: 'contain' }}
                      />
                    </Box>
                  )}
                  <Button
                    variant="primary"
                    onClick={() => {
                      // 保存全局Logo设置
                      setGlobalLogo(logoUrl);
                      addNotification({
                        type: 'success',
                        content: 'Logo 设置已保存到云端',
                      });
                    }}
                  >
                    保存 Logo 设置
                  </Button>
                </SpaceBetween>
              </FormField>
            </SpaceBetween>
          </Container>
        )}

        {/* 当前主题选择 */}
        <Container
          header={<Header variant="h2">{getText('theme.current.title')}</Header>}
        >
          <SpaceBetween size="m">
            <FormField label={getText('theme.current.select')}>
              <Select
                selectedOption={{ value: currentTheme.id, label: currentTheme.name }}
                onChange={({ detail }) => {
                  const theme = availableThemes.find(t => t.id === detail.selectedOption.value);
                  if (theme) setTheme(theme);
                }}
                options={themeOptions}
              />
            </FormField>
            
            {/* 主题预览 */}
            <Box>
              <div
                style={{
                  padding: '16px',
                  backgroundColor: previewTheme.backgroundColor,
                  color: previewTheme.textColor,
                  border: `2px solid ${previewTheme.primaryColor}`,
                  borderRadius: '8px',
                }}
              >
                <SpaceBetween size="s">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ 
                      fontWeight: 'bold', 
                      color: previewTheme.primaryColor,
                      fontSize: '16px'
                    }}>
                      {editingTheme ? `预览: ${previewTheme.name}` : getText('theme.preview.title')}
                    </div>
                    {previewTheme.logoUrl && (
                      <img 
                        src={previewTheme.logoUrl} 
                        alt="Logo" 
                        style={{ height: '30px', objectFit: 'contain' }}
                      />
                    )}
                  </div>
                  <div style={{ 
                    color: previewTheme.secondaryColor,
                    fontSize: '14px'
                  }}>
                    {editingTheme ? '这是实时预览效果' : getText('theme.preview.subtitle')}
                  </div>
                </SpaceBetween>
              </div>
            </Box>
          </SpaceBetween>
        </Container>

        {/* 自定义主题创建 */}
        {canCustomize && (
          <ExpandableSection 
            headerText={getText('theme.custom.title')}
            defaultExpanded={false}
          >
            <Container>
              <SpaceBetween size="m">
                <FormField label={getText('theme.custom.name')}>
                  <Input
                    value={formData.name}
                    onChange={(e) => {
                      const newData = { ...formData, name: e.detail.value };
                      setFormData(newData);
                      updatePreview(newData);
                    }}
                    placeholder={getText('theme.custom.namePlaceholder')}
                  />
                </FormField>
                
                <ColumnLayout columns={2}>
                  <FormField label={getText('theme.custom.primaryColor')}>
                    <Input
                      value={formData.primaryColor}
                      onChange={(e) => {
                        const newData = { ...formData, primaryColor: e.detail.value };
                        setFormData(newData);
                        updatePreview(newData);
                      }}
                    />
                  </FormField>
                  
                  <FormField label={getText('theme.custom.secondaryColor')}>
                    <Input
                      value={formData.secondaryColor}
                      onChange={(e) => {
                        const newData = { ...formData, secondaryColor: e.detail.value };
                        setFormData(newData);
                        updatePreview(newData);
                      }}
                    />
                  </FormField>
                  
                  <FormField label={getText('theme.custom.backgroundColor')}>
                    <Input
                      value={formData.backgroundColor}
                      onChange={(e) => {
                        const newData = { ...formData, backgroundColor: e.detail.value };
                        setFormData(newData);
                        updatePreview(newData);
                      }}
                    />
                  </FormField>
                  
                  <FormField label={getText('theme.custom.textColor')}>
                    <Input
                      value={formData.textColor}
                      onChange={(e) => {
                        const newData = { ...formData, textColor: e.detail.value };
                        setFormData(newData);
                        updatePreview(newData);
                      }}
                    />
                  </FormField>
                </ColumnLayout>

                <SpaceBetween direction="horizontal" size="s">
                  {editingTheme ? (
                    <>
                      <Button variant="primary" onClick={() => updateCustomTheme(editingTheme)}>
                        更新主题
                      </Button>
                      <Button variant="normal" onClick={cancelEdit}>
                        取消编辑
                      </Button>
                    </>
                  ) : (
                    <Button variant="primary" onClick={handleSaveTheme}>
                      {getText('theme.custom.save')}
                    </Button>
                  )}
                </SpaceBetween>
              </SpaceBetween>
            </Container>
          </ExpandableSection>
        )}

        {/* 自定义主题列表 */}
        {canCustomize && (
          <ExpandableSection 
            headerText={getText('theme.custom.list')}
            defaultExpanded={false}
          >
            <Container>
              <SpaceBetween size="s">
                {availableThemes.filter(theme => !theme.isDefault).map(theme => (
                  <div key={theme.id} style={{ 
                    padding: '12px', 
                    border: '1px solid #e0e0e0', 
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          backgroundColor: theme.primaryColor,
                          borderRadius: '50%',
                        }}
                      />
                      <span>{theme.name}</span>
                    </div>
                    <SpaceBetween direction="horizontal" size="s">
                      <Button
                        variant="normal"
                        onClick={() => setTheme(theme)}
                      >
                        {getText('theme.custom.apply')}
                      </Button>
                      <Button
                        variant="normal"
                        onClick={() => startEditTheme(theme)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="normal"
                        onClick={() => handleDeleteTheme(theme.id)}
                      >
                        {getText('common.actions.delete')}
                      </Button>
                    </SpaceBetween>
                  </div>
                ))}
                {availableThemes.filter(theme => !theme.isDefault).length === 0 && (
                  <div style={{ textAlign: 'center', color: '#6b7280', fontStyle: 'italic' }}>
                    {getText('theme.custom.noCustomThemes')}
                  </div>
                )}
              </SpaceBetween>
            </Container>
          </ExpandableSection>
        )}

        {/* 权限提示 */}
        {!canCustomize && (
          <Alert type="info">
            {getText('theme.permission.required')}
          </Alert>
        )}
      </SpaceBetween>
    </Container>
  );
};