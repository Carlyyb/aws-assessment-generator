import React from 'react';
import {
  ContentLayout,
  Header,
  SpaceBetween,
  Box,
  Button,
  Cards,
  ColumnLayout,
  ProgressBar,
  Badge,
  Alert,
} from '@cloudscape-design/components';
import { useTheme } from '../contexts/ThemeContext';
import { getText } from '../i18n/lang';

const ThemeDemo: React.FC = () => {
  const { currentTheme, availableThemes } = useTheme();

  const sampleData = [
    { id: 1, name: getText('theme.preview.sampleContent'), status: 'Success', progress: 85 },
    { id: 2, name: getText('theme.preview.sampleText'), status: 'In Progress', progress: 60 },
    { id: 3, name: 'Theme System Demo', status: 'Pending', progress: 25 },
  ];

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description={getText('theme.preview.description')}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="primary">Primary Action</Button>
              <Button>Secondary Action</Button>
            </SpaceBetween>
          }
        >
          {getText('theme.title')} - {currentTheme.name}
        </Header>
      }
    >
      <SpaceBetween size="l">
        {/* 主题信息卡片 */}
        <Box>
          <Alert
            statusIconAriaLabel="Info"
            header="Current Theme Information"
          >
            <ColumnLayout columns={2} variant="text-grid">
              <div>
                <Box variant="strong">Theme Name:</Box>
                <Box>{currentTheme.name}</Box>
              </div>
              <div>
                <Box variant="strong">Primary Color:</Box>
                <Box>
                  <span 
                    style={{
                      display: 'inline-block',
                      width: '20px',
                      height: '20px',
                      backgroundColor: currentTheme.primaryColor,
                      marginRight: '8px',
                      borderRadius: '50%',
                      verticalAlign: 'middle'
                    }}
                  />
                  {currentTheme.primaryColor}
                </Box>
              </div>
              <div>
                <Box variant="strong">Secondary Color:</Box>
                <Box>
                  <span 
                    style={{
                      display: 'inline-block',
                      width: '20px',
                      height: '20px',
                      backgroundColor: currentTheme.secondaryColor,
                      marginRight: '8px',
                      borderRadius: '50%',
                      verticalAlign: 'middle'
                    }}
                  />
                  {currentTheme.secondaryColor}
                </Box>
              </div>
              <div>
                <Box variant="strong">Available Themes:</Box>
                <Box>{availableThemes.length} themes</Box>
              </div>
            </ColumnLayout>
          </Alert>
        </Box>

        {/* 示例卡片 */}
        <Cards
          cardDefinition={{
            header: item => (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{item.name}</span>
                <Badge color={item.status === 'Success' ? 'green' : item.status === 'In Progress' ? 'blue' : 'grey'}>
                  {item.status}
                </Badge>
              </div>
            ),
            sections: [
              {
                id: 'progress',
                header: 'Progress',
                content: item => (
                  <ProgressBar
                    value={item.progress}
                    additionalInfo={`${item.progress}% complete`}
                    description="Task completion progress"
                  />
                ),
              },
              {
                id: 'actions',
                header: 'Actions',
                content: () => (
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button variant="primary">View</Button>
                    <Button>Edit</Button>
                    <Button>Delete</Button>
                  </SpaceBetween>
                ),
              },
            ],
          }}
          cardsPerRow={[
            { cards: 1 },
            { minWidth: 500, cards: 2 },
            { minWidth: 800, cards: 3 },
          ]}
          items={sampleData}
          header={
            <Header
              counter={`(${sampleData.length})`}
              description="Sample data to demonstrate theme styling"
            >
              Sample Content
            </Header>
          }
          empty={
            <Box textAlign="center" color="inherit">
              <b>No resources</b>
              <Box variant="p" color="inherit">
                No resources to display.
              </Box>
            </Box>
          }
        />

        {/* 颜色演示 */}
        <Box>
          <Header variant="h2">Color Palette Demo</Header>
          <ColumnLayout columns={4} variant="text-grid">
            <Box>
              <Box textAlign="center">
                <div
                  style={{
                    width: '100%',
                    height: '60px',
                    backgroundColor: currentTheme.primaryColor,
                    marginBottom: '8px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                  }}
                >
                  Primary
                </div>
                <Box variant="small">{currentTheme.primaryColor}</Box>
              </Box>
            </Box>
            <Box>
              <Box textAlign="center">
                <div
                  style={{
                    width: '100%',
                    height: '60px',
                    backgroundColor: currentTheme.secondaryColor,
                    marginBottom: '8px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                  }}
                >
                  Secondary
                </div>
                <Box variant="small">{currentTheme.secondaryColor}</Box>
              </Box>
            </Box>
            <Box>
              <Box textAlign="center">
                <div
                  style={{
                    width: '100%',
                    height: '60px',
                    backgroundColor: currentTheme.backgroundColor,
                    border: '1px solid #ccc',
                    marginBottom: '8px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: currentTheme.textColor,
                    fontWeight: 'bold',
                  }}
                >
                  Background
                </div>
                <Box variant="small">{currentTheme.backgroundColor}</Box>
              </Box>
            </Box>
            <Box>
              <Box textAlign="center">
                <div
                  style={{
                    width: '100%',
                    height: '60px',
                    backgroundColor: currentTheme.textColor,
                    marginBottom: '8px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: currentTheme.backgroundColor,
                    fontWeight: 'bold',
                  }}
                >
                  Text
                </div>
                <Box variant="small">{currentTheme.textColor}</Box>
              </Box>
            </Box>
          </ColumnLayout>
        </Box>

        {/* Logo 演示 */}
        {currentTheme.logoUrl && (
          <Box>
            <Header variant="h2">Logo Display</Header>
            <div 
              style={{
                padding: '24px',
                border: '1px solid #ccc',
                borderRadius: '8px',
                backgroundColor: currentTheme.backgroundColor,
                textAlign: 'center',
              }}
            >
              <img 
                src={currentTheme.logoUrl} 
                alt="Custom Logo" 
                style={{ 
                  maxHeight: '100px',
                  maxWidth: '200px',
                  objectFit: 'contain'
                }} 
              />
              <Box variant="p" margin={{ top: 's' }}>
                Custom logo is displayed in the navigation header
              </Box>
            </div>
          </Box>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
};

export default ThemeDemo;
