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
  const { currentTheme, availableThemes, setTheme, canCustomizeTheme, saveCustomTheme, deleteCustomTheme } = useTheme();
  const userProfile = useUserProfile();
  const [notifications, setNotifications] = useState<FlashbarProps.MessageDefinition[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    primaryColor: '#232f3e',
    secondaryColor: '#ff9900',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    logoUrl: '',
  });

  const canCustomize = canCustomizeTheme(userProfile);

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
        logoUrl: '',
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
                  backgroundColor: currentTheme.backgroundColor,
                  color: currentTheme.textColor,
                  border: `2px solid ${currentTheme.primaryColor}`,
                  borderRadius: '8px',
                }}
              >
                <SpaceBetween size="s">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ 
                      fontWeight: 'bold', 
                      color: currentTheme.primaryColor,
                      fontSize: '16px'
                    }}>
                      {getText('theme.preview.title')}
                    </div>
                    {currentTheme.logoUrl && (
                      <img 
                        src={currentTheme.logoUrl} 
                        alt="Logo" 
                        style={{ height: '30px', objectFit: 'contain' }}
                      />
                    )}
                  </div>
                  <div style={{ 
                    color: currentTheme.secondaryColor,
                    fontSize: '14px'
                  }}>
                    {getText('theme.preview.subtitle')}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.detail.value }))}
                    placeholder={getText('theme.custom.namePlaceholder')}
                  />
                </FormField>
                
                <ColumnLayout columns={2}>
                  <FormField label={getText('theme.custom.primaryColor')}>
                    <Input
                      value={formData.primaryColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.detail.value }))}
                    />
                  </FormField>
                  
                  <FormField label={getText('theme.custom.secondaryColor')}>
                    <Input
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.detail.value }))}
                    />
                  </FormField>
                  
                  <FormField label={getText('theme.custom.backgroundColor')}>
                    <Input
                      value={formData.backgroundColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, backgroundColor: e.detail.value }))}
                    />
                  </FormField>
                  
                  <FormField label={getText('theme.custom.textColor')}>
                    <Input
                      value={formData.textColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, textColor: e.detail.value }))}
                    />
                  </FormField>
                </ColumnLayout>

                <FormField label={getText('theme.custom.logo')}>
                  <Input
                    value={formData.logoUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, logoUrl: e.detail.value }))}
                    placeholder={getText('theme.custom.logoPlaceholder')}
                  />
                  {formData.logoUrl && (
                    <Box margin={{ top: 'xs' }}>
                      <img 
                        src={formData.logoUrl} 
                        alt="Logo preview" 
                        style={{ height: '60px', objectFit: 'contain' }}
                      />
                    </Box>
                  )}
                </FormField>

                <Button variant="primary" onClick={handleSaveTheme}>
                  {getText('theme.custom.save')}
                </Button>
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
