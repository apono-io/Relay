import { gql } from '@apollo/client';

export const RELAY_ASSIGNMENTS_QUERY = gql`
  query RelayAssignments {
    relayAssignments {
      repo
      number
      login
      displayName
      shadow
      trigger
      assignedAt
      area
      reason
      signals {
        areaRank
        areaPool
        openReviewRequests
        reviewsLast14Days
      }
    }
  }
`;

export const ASSIGN_REVIEWER = gql`
  mutation AssignReviewer($repo: String!, $number: Int!) {
    assignReviewer(repo: $repo, number: $number) {
      repo
      number
      login
      displayName
      shadow
      trigger
      assignedAt
      area
      reason
      signals {
        areaRank
        areaPool
        openReviewRequests
        reviewsLast14Days
      }
    }
  }
`;

export const RESET_ASSIGNMENT = gql`
  mutation ResetAssignment($repo: String!, $number: Int!) {
    resetAssignment(repo: $repo, number: $number)
  }
`;

export const ASSIGNMENT_SETTINGS_QUERY = gql`
  query AssignmentSettings {
    assignmentSettings {
      actuallyAssign
    }
  }
`;

export const SET_ACTUALLY_ASSIGN = gql`
  mutation SetActuallyAssign($enabled: Boolean!) {
    setActuallyAssign(enabled: $enabled) {
      actuallyAssign
    }
  }
`;

export const MY_SETTINGS_QUERY = gql`
  query MySettings {
    mySettings {
      assignmentMode
    }
  }
`;

export const SET_MY_ASSIGNMENT_MODE = gql`
  mutation SetMyAssignmentMode($mode: String!) {
    setMyAssignmentMode(mode: $mode) {
      assignmentMode
    }
  }
`;
