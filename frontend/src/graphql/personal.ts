import { gql } from '@apollo/client';

const PERSONAL_PR_FIELDS = gql`
  fragment PersonalPrFields on PullRequest {
    id
    repo
    number
    title
    url
    state
    isDraft
    authorLogin
    waitingOn
    requestedReviewers
    reviewerLogins
    openedAt
    readyAt
    firstReviewAt
    approvedAt
    mergedAt
  }
`;

export const MY_PULL_REQUESTS_QUERY = gql`
  ${PERSONAL_PR_FIELDS}
  query MyPullRequests {
    myPullRequests {
      logins
      open {
        ...PersonalPrFields
      }
      recentlyMerged {
        ...PersonalPrFields
      }
    }
  }
`;

export const MY_REVIEWS_QUERY = gql`
  ${PERSONAL_PR_FIELDS}
  query MyReviews {
    myReviews {
      logins
      open {
        ...PersonalPrFields
      }
      recentlyMerged {
        ...PersonalPrFields
      }
    }
  }
`;
