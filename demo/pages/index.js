import React from 'react'
import Head from 'next/head'
import MicroContainer from 'react-micro-container'
import Editor from '../components/editor'
import Previewer from '../components/previewer'
import App from 'grommet/components/App'
import Split from 'grommet/components/Split'
import Box from 'grommet/components/Box'

export default class extends MicroContainer {
  constructor (props) {
    super(props)
    this.state = {
      md: ""
    }
  }

  componentDidMount () {
    this.subscribe({
      updateMd: this.updateMd,
    });
  }

  updateMd (str) {
    this.setState({ md: str });
  }

  render () {
    return (
      <App>
        <Head>
          <title>My styled page</title>
          <link href="/static/main.css" rel="stylesheet" />
        </Head>
        <Split separator={true}>

          <Box
            justify="center"
            align="center"
            wrap={true}
            margin="none">
            <Editor dispatch={this.dispatch} {...this.state} />
          </Box>
          <Box
            justify="center"
            align="center"
            wrap={true}
            margin="none"
          >
            <Previewer dispatch={this.dispatch} {...this.state} />
          </Box>
        </Split>
      </App>
    )
  }
}
