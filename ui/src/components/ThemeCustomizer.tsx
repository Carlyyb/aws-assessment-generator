import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  ColorInput,
  Container,
  FileInput,
  Grid,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  ActionIcon,
  Image,
  Alert,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPalette, IconTrash, IconUpload, IconEye } from '@tabler/icons-react';
import { useTheme, CustomTheme } from '../contexts/ThemeContext';
import { getText } from '../i18n/lang';
import { useUserProfile } from '../contexts/userProfile';

interface ThemeCustomizerProps {
  opened: boolean;
  onClose: () => void;
}

export const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({ opened, onClose }) => {
  const { currentTheme, availableThemes, setTheme, canCustomizeTheme, saveCustomTheme, deleteCustomTheme } = useTheme();
  const userProfile = useUserProfile();
  const [previewOpened, { open: openPreview, close: closePreview }] = useDisclosure(false);
  
  const [formData, setFormData] = useState({
    name: '',
    primaryColor: '#232f3e',
    secondaryColor: '#ff9900',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    logoUrl: '',
  });

  const [previewTheme, setPreviewTheme] = useState<CustomTheme | null>(null);

  const canCustomize = canCustomizeTheme(userProfile);

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;

    // 这里应该上传到您的文件存储服务（如 S3）
    // 现在我们使用 FileReader 作为演示
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setFormData(prev => ({ ...prev, logoUrl: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveTheme = () => {
    if (!formData.name.trim()) {
      notifications.show({
        title: getText('common.error'),
        message: getText('theme.error.nameRequired'),
        color: 'red',
      });
      return;
    }

    try {
      saveCustomTheme({
        ...formData,
        isDefault: false,
      });
      notifications.show({
        title: getText('common.success'),
        message: getText('theme.success.saved'),
        color: 'green',
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
      notifications.show({
        title: getText('common.error'),
        message: getText('theme.error.saveFailed'),
        color: 'red',
      });
    }
  };

  const handlePreview = () => {
    const preview: CustomTheme = {
      id: 'preview',
      name: formData.name || 'Preview',
      primaryColor: formData.primaryColor,
      secondaryColor: formData.secondaryColor,
      backgroundColor: formData.backgroundColor,
      textColor: formData.textColor,
      logoUrl: formData.logoUrl,
      createdBy: userProfile?.email || 'preview',
      isDefault: false,
    };
    setPreviewTheme(preview);
    openPreview();
  };

  const handleDeleteTheme = (themeId: string) => {
    try {
      deleteCustomTheme(themeId);
      notifications.show({
        title: getText('common.success'),
        message: getText('theme.success.deleted'),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: getText('common.error'),
        message: getText('theme.error.deleteFailed'),
        color: 'red',
      });
    }
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group>
            <IconPalette size={24} />
            <Title order={3}>{getText('theme.title')}</Title>
          </Group>
        }
        size="xl"
      >
        <Container size="lg">
          <Stack gap="lg">
            {/* 当前主题选择 */}
            <Card withBorder>
              <Stack gap="md">
                <Title order={4}>{getText('theme.current.title')}</Title>
                <Select
                  label={getText('theme.current.select')}
                  value={currentTheme.id}
                  onChange={(value) => {
                    const theme = availableThemes.find(t => t.id === value);
                    if (theme) setTheme(theme);
                  }}
                  data={availableThemes.map(theme => ({
                    value: theme.id,
                    label: theme.name,
                  }))}
                />
                
                {/* 主题预览 */}
                <Box
                  style={{
                    padding: '16px',
                    backgroundColor: currentTheme.backgroundColor,
                    color: currentTheme.textColor,
                    border: `2px solid ${currentTheme.primaryColor}`,
                    borderRadius: '8px',
                  }}
                >
                  <Group justify="space-between">
                    <Text fw={500} c={currentTheme.primaryColor}>
                      {getText('theme.preview.title')}
                    </Text>
                    {currentTheme.logoUrl && (
                      <Image src={currentTheme.logoUrl} alt="Logo" h={30} fit="contain" />
                    )}
                  </Group>
                  <Text size="sm" c={currentTheme.secondaryColor}>
                    {getText('theme.preview.subtitle')}
                  </Text>
                </Box>
              </Stack>
            </Card>

            {/* 自定义主题创建 */}
            {canCustomize && (
              <Card withBorder>
                <Stack gap="md">
                  <Title order={4}>{getText('theme.custom.title')}</Title>
                  
                  <Grid>
                    <Grid.Col span={12}>
                      <TextInput
                        label={getText('theme.custom.name')}
                        placeholder={getText('theme.custom.namePlaceholder')}
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </Grid.Col>
                    
                    <Grid.Col span={6}>
                      <ColorInput
                        label={getText('theme.custom.primaryColor')}
                        value={formData.primaryColor}
                        onChange={(value) => setFormData(prev => ({ ...prev, primaryColor: value }))}
                      />
                    </Grid.Col>
                    
                    <Grid.Col span={6}>
                      <ColorInput
                        label={getText('theme.custom.secondaryColor')}
                        value={formData.secondaryColor}
                        onChange={(value) => setFormData(prev => ({ ...prev, secondaryColor: value }))}
                      />
                    </Grid.Col>
                    
                    <Grid.Col span={6}>
                      <ColorInput
                        label={getText('theme.custom.backgroundColor')}
                        value={formData.backgroundColor}
                        onChange={(value) => setFormData(prev => ({ ...prev, backgroundColor: value }))}
                      />
                    </Grid.Col>
                    
                    <Grid.Col span={6}>
                      <ColorInput
                        label={getText('theme.custom.textColor')}
                        value={formData.textColor}
                        onChange={(value) => setFormData(prev => ({ ...prev, textColor: value }))}
                      />
                    </Grid.Col>
                    
                    <Grid.Col span={12}>
                      <FileInput
                        label={getText('theme.custom.logo')}
                        placeholder={getText('theme.custom.logoPlaceholder')}
                        leftSection={<IconUpload size={16} />}
                        accept="image/*"
                        onChange={handleFileUpload}
                      />
                      {formData.logoUrl && (
                        <Box mt="xs">
                          <Image src={formData.logoUrl} alt="Logo preview" h={60} fit="contain" />
                        </Box>
                      )}
                    </Grid.Col>
                  </Grid>

                  <Group justify="space-between">
                    <Button variant="outline" leftSection={<IconEye size={16} />} onClick={handlePreview}>
                      {getText('theme.custom.preview')}
                    </Button>
                    <Button onClick={handleSaveTheme}>
                      {getText('theme.custom.save')}
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )}

            {/* 自定义主题列表 */}
            {canCustomize && (
              <Card withBorder>
                <Stack gap="md">
                  <Title order={4}>{getText('theme.custom.list')}</Title>
                  {availableThemes.filter(theme => !theme.isDefault).map(theme => (
                    <Group key={theme.id} justify="space-between" p="sm" style={{ border: '1px solid #e0e0e0', borderRadius: '4px' }}>
                      <Group>
                        <Box
                          w={20}
                          h={20}
                          style={{ backgroundColor: theme.primaryColor, borderRadius: '50%' }}
                        />
                        <Text>{theme.name}</Text>
                      </Group>
                      <Group>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setTheme(theme)}
                        >
                          {getText('theme.custom.apply')}
                        </Button>
                        <ActionIcon
                          color="red"
                          variant="outline"
                          onClick={() => handleDeleteTheme(theme.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  ))}
                  {availableThemes.filter(theme => !theme.isDefault).length === 0 && (
                    <Text c="dimmed" ta="center">
                      {getText('theme.custom.noCustomThemes')}
                    </Text>
                  )}
                </Stack>
              </Card>
            )}

            {/* 权限提示 */}
            {!canCustomize && (
              <Alert color="yellow">
                <Text>{getText('theme.permission.required')}</Text>
              </Alert>
            )}
          </Stack>
        </Container>
      </Modal>

      {/* 预览模态框 */}
      <Modal
        opened={previewOpened}
        onClose={closePreview}
        title={getText('theme.preview.modal.title')}
        size="lg"
      >
        {previewTheme && (
          <Box
            style={{
              padding: '24px',
              backgroundColor: previewTheme.backgroundColor,
              color: previewTheme.textColor,
              border: `2px solid ${previewTheme.primaryColor}`,
              borderRadius: '8px',
              minHeight: '200px',
            }}
          >
            <Group justify="space-between" mb="md">
              <Title order={3} c={previewTheme.primaryColor}>
                {getText('common.brand')}
              </Title>
              {previewTheme.logoUrl && (
                <Image src={previewTheme.logoUrl} alt="Logo" h={40} fit="contain" />
              )}
            </Group>
            
            <Text size="lg" c={previewTheme.secondaryColor} mb="md">
              {getText('theme.preview.description')}
            </Text>
            
            <Box
              p="md"
              style={{
                backgroundColor: previewTheme.primaryColor + '20',
                borderRadius: '4px',
              }}
            >
              <Text fw={500}>{getText('theme.preview.sampleContent')}</Text>
              <Text size="sm">{getText('theme.preview.sampleText')}</Text>
            </Box>
          </Box>
        )}
      </Modal>
    </>
  );
};
