import { gql } from '@apollo/client';

export const START_GITHUB_LINK = gql`
  mutation StartGithubLink {
    startGithubLink
  }
`;

export const GITHUB_LINK_AVAILABLE_QUERY = gql`
  query GithubLinkAvailable {
    githubLinkAvailable
  }
`;

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      name
      picture
      role
      permissions
    }
  }
`;
