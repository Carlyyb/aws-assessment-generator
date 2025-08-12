import { useContext } from 'react';
import { useOutlet, useNavigate } from 'react-router-dom';
import { ContentLayout, Container, Header, Box, SpaceBetween, Button } from '@cloudscape-design/components';
import { titlise } from '../helpers';
import { RoutesContext } from '../contexts/routes';
import { getText } from '../i18n/lang';

export default () => {
  const outlet = useOutlet();
  if (outlet) return outlet;

  const navigate = useNavigate();
  const routes = useContext(RoutesContext);

  const [{ children: childRoutes }] = routes;
  const paths = childRoutes!.map(({ path }: any) => path);

  return (
    <ContentLayout>
      <Container
        header={
          <SpaceBetween size="l">
            <Header variant="h1">{getText('pages.home.title')}</Header>
          </SpaceBetween>
        }
      >
        <Box padding="xxxl">
          <SpaceBetween size="l" alignItems="center">
            <SpaceBetween size="l" direction="horizontal">
              {paths?.map((path: any) => (
                <Button key={`button-${path}`} onClick={() => navigate(path)}>
                  <Box variant="h2" padding="m">
                    {getText(`pages.home.buttons.${path}`) || titlise(path)}
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
