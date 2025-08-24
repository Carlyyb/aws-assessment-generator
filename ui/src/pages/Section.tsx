import { useContext } from 'react';
import { useOutlet, useNavigate } from 'react-router-dom';
import { ContentLayout, Container, Header, Box, SpaceBetween, Button, ColumnLayout } from '@cloudscape-design/components';
import { titlise } from '../helpers';
import { RoutesContext } from '../contexts/routes';
import { getText } from '../i18n/lang';

type SectionProps = { id: number };

const Section = (props: SectionProps) => {
  const outlet = useOutlet();
  const navigate = useNavigate();
  const routes = useContext(RoutesContext);
  
  if (outlet) return outlet;

  // 添加安全检查
  if (!routes || !routes[0] || !routes[0].children || !routes[0].children[props.id]) {
    return (
      <ContentLayout>
        <Container
          header={
            <SpaceBetween size="l">
              <Header variant="h1">Loading...</Header>
            </SpaceBetween>
          }
        >
          <Box padding="xxxl">
            <SpaceBetween size="l" alignItems="center">
              <Box>No content available</Box>
            </SpaceBetween>
          </Box>
        </Container>
      </ContentLayout>
    );
  }

  const { path: rootPath, children: childRoutes }: any = routes[0].children[props.id];

  // 添加 childRoutes 的安全检查
  if (!childRoutes || !Array.isArray(childRoutes)) {
    return (
      <ContentLayout>
        <Container
          header={
            <SpaceBetween size="l">
              <Header variant="h1">{getText(`teachers.section.${rootPath}`)}</Header>
            </SpaceBetween>
          }
        >
          <Box padding="xxxl">
            <SpaceBetween size="l" alignItems="center">
              <Box>No sub-sections available</Box>
            </SpaceBetween>
          </Box>
        </Container>
      </ContentLayout>
    );
  }

  const paths = childRoutes.map(({ path }: any) => path);
  return (
    <ContentLayout>
      <Container
        header={
          <SpaceBetween size="l">
            <Header variant="h1">{getText(`teachers.section.${rootPath}`)}</Header>
          </SpaceBetween>
        }
      >
        <Box padding="xxxl">
          <SpaceBetween size="l" alignItems="center">
            <ColumnLayout columns={3} variant="text-grid">
              {paths?.map((path: any) => (
                <Container key={`button-${path}`}>
                  <Box padding="l" textAlign="center">
                    <SpaceBetween size="m">
                      <Box variant="h4" color="text-label">
                        {getText(`teachers.section.buttons.${path}`) || titlise(path)}
                      </Box>
                      <Button 
                        variant="primary"
                        onClick={() => navigate(path)}
                        iconName="arrow-right"
                        fullWidth
                      >
                        进入
                      </Button>
                    </SpaceBetween>
                  </Box>
                </Container>
              ))}
            </ColumnLayout>
          </SpaceBetween>
        </Box>
      </Container>
    </ContentLayout>
  );
};

export default Section;
