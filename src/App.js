import React, { Component } from 'react'
import axios from 'axios'
import { ADD_STAR, GET_ISSUES_OF_REPOSITORY } from './queries'

const axiosGitHubGraphQL = axios.create({
  baseURL: 'https://api.github.com/graphql',
  headers: {
    Authorization: `bearer ${
      process.env.REACT_APP_GITHUB_PERSONAL_ACCESS_TOKEN
    }`
  }
})

const getIssuesOfRepository = (path, cursor) => {
  const [organization, repository] = path.split('/')

  return axiosGitHubGraphQL.post('', {
    query: GET_ISSUES_OF_REPOSITORY,
    variables: { organization, repository, cursor }
  })
}

const resolveIssuesQuery = (queryResult, cursor) => state => {
  const { data, errors } = queryResult.data

  if (!cursor) {
    return {
      organization: data.organization,
      errors
    }
  }

  const { edges: oldIssues } = state.organization.repository.issues
  const { edges: newIssues } = data.organization.repository.issues
  const updatedIssues = [...oldIssues, ...newIssues]

  return {
    organization: {
      ...data.organization,
      repository: {
        ...data.organization.repository,
        issues: {
          ...data.organization.repository.issues,
          edges: updatedIssues
        }
      }
    },
    errors
  }
}

const resolveAddStarMutation = mutationResult => state => {
  const { viewerHasStarred } = mutationResult.data.data.addStar.starrable

  const { totalCount } = state.organization.repository.stargazers

  return {
    ...state,
    organization: {
      ...state.organization,
      repository: {
        ...state.organization.repository,
        viewerHasStarred,
        stargazers: {
          totalCount: totalCount + 1
        }
      }
    }
  }
}

const addStarToRepository = repositoryId => {
  return axiosGitHubGraphQL.post('', {
    query: ADD_STAR,
    variables: { repositoryId }
  })
}

const TITLE = 'Getting repository info with graphql'

class App extends Component {
  state = {
    path: 'facebook/create-react-app',
    organization: null,
    errors: null
  }

  componentDidMount () {
    this.onFetchFromGitHub(this.state.path)
  }

  onStarRepository = (repositoryId, viewerHasStarred) => {
    addStarToRepository(repositoryId).then(mutationResult =>
      this.setState(resolveAddStarMutation(mutationResult))
    )
  }

  onFetchMoreIssues = () => {
    const { endCursor } = this.state.organization.repository.issues.pageInfo

    this.onFetchFromGitHub(this.state.path, endCursor)
  }

  onFetchFromGitHub = (path, cursor) => {
    getIssuesOfRepository(path, cursor).then(queryResult =>
      this.setState(resolveIssuesQuery(queryResult, cursor))
    )
  }

  onChange = event => {
    this.setState({ path: event.target.value })
  }

  onSubmit = event => {
    this.onFetchFromGitHub(this.state.path)
    event.preventDefault()
  }

  render () {
    const { path, organization, errors } = this.state

    return (
      <div className='App'>
        <h1>{TITLE}</h1>
        <form onSubmit={this.onSubmit}>
          <label htmlFor='url'>Show open issues for https://github.com/</label>
          <input
            id='url'
            type='text'
            onChange={this.onChange}
            style={{ width: '300px' }}
          />
          <button type='submit'>Search</button>
        </form>

        <hr />
        {organization ? (
          <Organization
            organization={organization}
            errors={errors}
            onFetchMoreIssues={this.onFetchMoreIssues}
            onStarRepository={this.onStarRepository}
          />
        ) : (
          <p>Carregando...</p>
        )}
      </div>
    )
  }
}

const Organization = ({
  organization,
  errors,
  onFetchMoreIssues,
  onStarRepository
}) => {
  if (errors) {
    return (
      <p>
        <strong>Something went wrong:</strong>
        {errors.map(error => error.message).join(' ')}
      </p>
    )
  }
  return (
    <div>
      <p>
        <strong>Issues from Organization:</strong>
        <a href={organization.url}>{organization.name}</a>
      </p>
      <Repository
        repository={organization.repository}
        onFetchMoreIssues={onFetchMoreIssues}
        onStarRepository={onStarRepository}
      />
    </div>
  )
}

const Repository = ({ repository, onFetchMoreIssues, onStarRepository }) => (
  <div>
    <p>
      <strong>In Repository:</strong>
      <a href={repository.url}>{repository.name}</a>
    </p>
    <button
      type='button'
      onClick={() =>
        onStarRepository(repository.id, repository.viewerHasStarred)
      }
    >
      {repository.stargazers.totalCount}
      {repository.viewerHasStarred ? ' Unstar' : ' Star'}
    </button>
    <ul>
      {repository.issues.edges.map(issue => (
        <li key={issue.node.id}>
          <a href={issue.node.url}>{issue.node.title}</a>
          <ul>
            {issue.node.reactions.edges.map(reaction => (
              <li key={reaction.node.id}>{reaction.node.content}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
    <hr />

    {repository.issues.pageInfo.hasNextPage && (
      <button onClick={onFetchMoreIssues}>More</button>
    )}
  </div>
)

export default App
