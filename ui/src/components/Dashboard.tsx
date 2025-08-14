import { LineChart, Box, Button } from '@cloudscape-design/components';
import { getText } from '../i18n/lang';

export type DashboardProps = {
  data: { x: Date; y: number }[];
};

export function Dashboard(props: DashboardProps) {
  const { data } = props;

  return (
    <LineChart
      series={[
        {
          title: getText('students.dashboard.score'),
          type: 'line',
          data,
        },
      ]}
      yDomain={[0, 100]}
      i18nStrings={{
        xTickFormatter: (e) =>
          e
            .toLocaleDateString('en-GB', {
              month: 'short',
              day: 'numeric',
            })
            .split(',')
            .join('\n'),
      }}
      ariaLabel={getText('students.dashboard.chart_label')}
      hideFilter
      hideLegend
      xScaleType="time"
      xTitle={getText('students.dashboard.time_utc')}
      yTitle={getText('students.dashboard.score_percent')}
      empty={
        <Box textAlign="center" color="inherit">
          <b>{getText('students.dashboard.no_data.title')}</b>
          <Box variant="p" color="inherit">
            {getText('students.dashboard.no_data.message')}
          </Box>
        </Box>
      }
      noMatch={
        <Box textAlign="center" color="inherit">
          <b>{getText('students.dashboard.no_match.title')}</b>
          <Box variant="p" color="inherit">
            {getText('students.dashboard.no_match.message')}
          </Box>
          <Button>{getText('students.dashboard.clear_filter')}</Button>
        </Box>
      }
    />
  );
}

export default Dashboard;
