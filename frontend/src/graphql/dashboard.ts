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
      waitingCount
      lastSyncedAt
      weeklyPhases {
        week
        codingSeconds
        pickupSeconds
        reworkSeconds
        mergeSeconds
        prCount
      }
      stuckNow {
        repo
        number
        title
        url
        authorLogin
        waitingOn
        waitingSeconds
        requestedReviewers
        roundNumber
        openedAt
        readyAt
        firstReviewAt
        approvedAt
      }
    }
  }
`;

export const SYNC_NOW_MUTATION = gql`
  mutation SyncNow {
    syncNow
  }
`;

export const LAST_SYNCED_QUERY = gql`
  query LastSyncedAt {
    lastSyncedAt
  }
`;
