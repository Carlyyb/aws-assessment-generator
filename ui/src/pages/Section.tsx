import { useContext } from 'react';
import { useOutlet, useNavigate } from 'react-router-dom';
import { ContentLayout, Container, Header, Box, SpaceBetween, Button } from '@cloudscape-design/components';
import { titlise } from '../helpers';
import { RoutesContext } from '../contexts/routes';
import { getText } from '../i18n/lang';

type SectionProps = { id: number };

export default (props: SectionProps) => {
  const outlet = useOutlet();
  if (outlet) return outlet;

  const navigate = useNavigate();
  const routes = useContext(RoutesContext);

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
            <SpaceBetween size="l" direction="horizontal">
              {paths?.map((path: any) => (
                <Button key={`button-${path}`} onClick={() => navigate(path)}>
                  <Box variant="h2" padding="m">
                    {getText(`teachers.section.buttons.${path}`) || titlise(path)}
                  </Box>
                </Button>
              ))}
            </SpaceBetween>
          </SpaceBetween>
        </Box>
      </Container>
    </ContentLayout>
  );
};
