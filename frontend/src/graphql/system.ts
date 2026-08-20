import { gql } from '@apollo/client';

export const REPOS_QUERY = gql`
  query Repos {
    repos {
      id
      name
      createdAt
    }
  }
`;

export const ADD_REPO = gql`
  mutation AddRepo($name: String!) {
    addRepo(name: $name) {
      id
      name
      createdAt
    }
  }
`;

export const AREA_RULES_QUERY = gql`
  query AreaRules($repo: String!) {
    areaRules(repo: $repo) {
      id
      repo
      pattern
      area
      risk
    }
  }
`;

export const ADD_AREA_RULE = gql`
  mutation AddAreaRule($input: AddAreaRuleInput!) {
    addAreaRule(input: $input) {
      id
      repo
      pattern
      area
      risk
    }
  }
`;

export const UPDATE_AREA_RULE = gql`
  mutation UpdateAreaRule($id: ID!, $input: UpdateAreaRuleInput!) {
    updateAreaRule(id: $id, input: $input) {
      id
      repo
      pattern
      area
      risk
    }
  }
`;

export const DELETE_AREA_RULE = gql`
  mutation DeleteAreaRule($id: ID!) {
    deleteAreaRule(id: $id)
  }
`;

export const ASSIGNMENT_PERFORMANCE_QUERY = gql`
  query AssignmentPerformance {
    assignmentPerformance {
      totals {
        recorded
        decided
        agreements
        awaiting
        assigned
        autoAssigned
        manualAssigned
        liveAssigned
        peoplePicked
        agreementRate
        coverageRate
        medianDecisionSeconds
      }
      weekly {
        week
        weekStart
        recorded
        decided
        agreements
        assigned
        agreementRate
      }
      byArea {
        area
        recorded
        decided
        agreements
        agreementRate
      }
      spread {
        displayName
        picks
      }
    }
  }
`;

export const ASSIGNMENT_COMPARISON_QUERY = gql`
  query AssignmentComparison {
    assignmentComparison {
      recorded
      awaiting
      decided
      agreements
      agreementRate
      rows {
        id
        repo
        prNumber
        prTitle
        prUrl
        area
        suggestedName
        suggestedLogin
        reason
        signals {
          areaRank
          areaPool
          openReviewRequests
          reviewsLast14Days
        }
        actualNames
        matched
        generatedAt
        resolvedAt
      }
    }
  }
`;
