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

const TEAM_FIELDS = gql`
  fragment TeamFields on Team {
    id
    name
    leadPersonId
    memberIds
  }
`;

export const TEAMS_QUERY = gql`
  ${TEAM_FIELDS}
  query Teams {
    teams {
      ...TeamFields
    }
  }
`;

export const CREATE_TEAM = gql`
  ${TEAM_FIELDS}
  mutation CreateTeam($name: String!) {
    createTeam(name: $name) {
      ...TeamFields
    }
  }
`;

export const UPDATE_TEAM = gql`
  ${TEAM_FIELDS}
  mutation UpdateTeam($id: ID!, $input: UpdateTeamInput!) {
    updateTeam(id: $id, input: $input) {
      ...TeamFields
    }
  }
`;

export const DELETE_TEAM = gql`
  mutation DeleteTeam($id: ID!) {
    deleteTeam(id: $id)
  }
`;

export const SET_TEAM_MEMBERS = gql`
  ${TEAM_FIELDS}
  mutation SetTeamMembers($teamId: ID!, $personIds: [ID!]!) {
    setTeamMembers(teamId: $teamId, personIds: $personIds) {
      team {
        ...TeamFields
      }
      movedPersonIds
    }
  }
`;
