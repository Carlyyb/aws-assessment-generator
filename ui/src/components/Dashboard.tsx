import { LineChart, Box, Button } from '@cloudscape-design/components';
import { getText } from '../i18n/lang';

export type DashboardProps = {
  data: { x: Date; y: number }[];
};

export default (props: DashboardProps) => {
  const { data } = props;

  return (
    <LineChart
      series={[
        {
          title: getText('dashboard.score'),
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
      ariaLabel={getText('dashboard.chart_label')}
      hideFilter
      hideLegend
      xScaleType="time"
      xTitle={getText('dashboard.time_utc')}
      yTitle={getText('dashboard.score_percent')}
      empty={
        <Box textAlign="center" color="inherit">
          <b>{getText('dashboard.no_data_title')}</b>
          <Box variant="p" color="inherit">
            {getText('dashboard.no_data_message')}
          </Box>
        </Box>
      }
      noMatch={
        <Box textAlign="center" color="inherit">
          <b>{getText('dashboard.no_match_title')}</b>
          <Box variant="p" color="inherit">
            {getText('dashboard.no_match_message')}
          </Box>
          <Button>{getText('dashboard.clear_filter')}</Button>
        </Box>
      }
    />
  );
};
