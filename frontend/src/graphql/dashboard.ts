import { gql } from '@apollo/client';

export const DASHBOARD_QUERY = gql`
  query Dashboard($repo: String) {
    dashboard(repo: $repo) {
      reviewerWaitByRound {
        label
        medianSeconds
        p90Seconds
        sampleSize
      }
      authorWaitByRound {
        label
        medianSeconds
        p90Seconds
        sampleSize
      }
      cycleTime {
        label
        medianSeconds
        p90Seconds
        sampleSize
      }
      prCount
      slaMisses
      quality {
        approvedWithZeroCommentsRate
        revertRate
      }
    }
  }
`;
