import { gql } from '@apollo/client';

const PERSON_FIELDS = gql`
  fragment PersonFields on Person {
    id
    email
    githubLogin
    displayName
    team
    timezone
    role
    active
    identities {
      id
      login
      source
    }
  }
`;

export const PEOPLE_QUERY = gql`
  ${PERSON_FIELDS}
  query People {
    people {
      ...PersonFields
    }
  }
`;

export const ROSTER_HEALTH_QUERY = gql`
  query RosterHealth {
    rosterHealth {
      unmappedLogins
    }
  }
`;

export const CREATE_PERSON = gql`
  ${PERSON_FIELDS}
  mutation CreatePerson($input: CreatePersonInput!) {
    createPerson(input: $input) {
      ...PersonFields
    }
  }
`;

export const UPDATE_PERSON = gql`
  ${PERSON_FIELDS}
  mutation UpdatePerson($id: ID!, $input: UpdatePersonInput!) {
    updatePerson(id: $id, input: $input) {
      ...PersonFields
    }
  }
`;

export const SET_PERSON_ACTIVE = gql`
  ${PERSON_FIELDS}
  mutation SetPersonActive($id: ID!, $active: Boolean!) {
    setPersonActive(id: $id, active: $active) {
      ...PersonFields
    }
  }
`;
